package document

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// DefaultAliquotaISS is the fallback ISS rate (2%) used when no municipality
// mapping is found and no override is provided. LC 116/2003 Art. 8 minimum.
const DefaultAliquotaISS = 2.0

const (
	issCacheTTL     = 30 * 24 * time.Hour // 30 days — rates change rarely
	muniCacheTTL    = 24 * time.Hour      // 24 h — active status changes rarely
	issCachePrefix  = "iss:aliq"
	muniCachePrefix = "muni:ativo"
)

// ISSLookup provides ISS rate lookup with Redis cache and DB backing.
// When created via NewISSLookupFromRates the lookup runs in-memory (test mode).
type ISSLookup struct {
	db    *pgxpool.Pool
	redis *redis.Client

	// legacyRates is populated only by NewISSLookupFromRates.
	// When non-nil, DB/Redis are not used and all legacy methods work in-memory.
	legacyRates map[string]float64 // ibge → default aliquota
}

// AliquotaResult holds a resolved ISS rate and the source of the resolution.
type AliquotaResult struct {
	Aliquota float64
	// Fonte is one of: "nbs_especifico" | "padrao_municipio" | "informada_cliente"
	Fonte string
}

// ErrAliquotaNaoEncontrada is returned by GetAliquota when no rate is mapped
// in the database for the given municipality + NBS code combination.
type ErrAliquotaNaoEncontrada struct {
	IBGE string
	NBS  string
}

func (e ErrAliquotaNaoEncontrada) Error() string {
	return fmt.Sprintf(
		"alíquota ISS não mapeada para município %s / NBS %s — "+
			"informe aliquota_iss no request (range válido: 2.00%% a 5.00%%)",
		e.IBGE, e.NBS,
	)
}

// NewISSLookup creates a DB + Redis-backed ISSLookup.
// Pass a nil redis client to disable caching (DB-only mode).
func NewISSLookup(_ context.Context, db *pgxpool.Pool, rdb *redis.Client) (*ISSLookup, error) {
	return &ISSLookup{db: db, redis: rdb}, nil
}

// NewISSLookupFromRates creates a lightweight in-memory ISSLookup intended
// for unit tests and local development scenarios without a database.
// All municipalities present in the map are considered active.
func NewISSLookupFromRates(rates map[string]float64) *ISSLookup {
	return &ISSLookup{legacyRates: rates}
}

// ─── New context-aware methods (DB + Redis backed) ───────────────────────────

// GetAliquota resolves the ISS rate for a given IBGE municipality code and NBS
// service code using a 3-level fallback:
//
//  1. NBS-specific rate in iss_aliquotas (best match)
//  2. Municipality default rate in iss_aliquotas (codigo_nbs IS NULL)
//  3. Returns ErrAliquotaNaoEncontrada when neither is found
//
// Results are cached in Redis for issCacheTTL. When created via
// NewISSLookupFromRates (no DB), only the in-memory legacyRates are used.
func (l *ISSLookup) GetAliquota(ctx context.Context, ibge, nbs string) (*AliquotaResult, error) {
	// ── Test/legacy path ────────────────────────────────────────────────────
	if l.db == nil {
		if v, ok := l.legacyRates[ibge]; ok {
			return &AliquotaResult{Aliquota: v, Fonte: "padrao_municipio"}, nil
		}
		return nil, ErrAliquotaNaoEncontrada{IBGE: ibge, NBS: nbs}
	}

	// ── Redis cache — NBS-specific key ───────────────────────────────────────
	if l.redis != nil {
		cacheKey := fmt.Sprintf("%s:%s:%s", issCachePrefix, ibge, nbs)
		if val, err := l.redis.Get(ctx, cacheKey).Float64(); err == nil {
			return &AliquotaResult{Aliquota: val, Fonte: "nbs_especifico"}, nil
		}
	}

	// ── Redis cache — municipality default key ───────────────────────────────
	defaultKey := fmt.Sprintf("%s:%s:default", issCachePrefix, ibge)
	if l.redis != nil {
		if val, err := l.redis.Get(ctx, defaultKey).Float64(); err == nil {
			return &AliquotaResult{Aliquota: val, Fonte: "padrao_municipio"}, nil
		}
	}

	// ── DB lookup: NBS-specific wins over municipality default ───────────────
	// ORDER BY codigo_nbs NULLS LAST → NBS-specific row (non-null) sorts first.
	row := l.db.QueryRow(ctx, `
		SELECT aliquota, codigo_nbs IS NOT NULL AS especifico
		FROM iss_aliquotas
		WHERE ibge = $1
		  AND (codigo_nbs = $2 OR codigo_nbs IS NULL)
		  AND vigencia_ini <= CURRENT_DATE
		  AND (vigencia_fim IS NULL OR vigencia_fim >= CURRENT_DATE)
		ORDER BY codigo_nbs NULLS LAST
		LIMIT 1
	`, ibge, nbs)

	var aliquota float64
	var especifico bool
	if err := row.Scan(&aliquota, &especifico); err != nil {
		return nil, ErrAliquotaNaoEncontrada{IBGE: ibge, NBS: nbs}
	}

	// ── Populate Redis cache ─────────────────────────────────────────────────
	if l.redis != nil {
		key := defaultKey
		if especifico {
			key = fmt.Sprintf("%s:%s:%s", issCachePrefix, ibge, nbs)
		}
		_ = l.redis.Set(ctx, key, aliquota, issCacheTTL)
	}

	fonte := "padrao_municipio"
	if especifico {
		fonte = "nbs_especifico"
	}
	return &AliquotaResult{Aliquota: aliquota, Fonte: fonte}, nil
}

// MunicipioAtivo reports whether the IBGE municipality code is active in
// municipios_nfse (i.e., participates in NFS-e Nacional).
// Results are cached in Redis for muniCacheTTL.
// When the DB is nil (test mode), all municipalities in legacyRates are active.
func (l *ISSLookup) MunicipioAtivo(ctx context.Context, ibge string) (bool, error) {
	// ── Test/legacy path ────────────────────────────────────────────────────
	if l.db == nil {
		_, ok := l.legacyRates[ibge]
		return ok, nil
	}

	// ── Redis cache ──────────────────────────────────────────────────────────
	if l.redis != nil {
		cacheKey := fmt.Sprintf("%s:%s", muniCachePrefix, ibge)
		if val, err := l.redis.Get(ctx, cacheKey).Bool(); err == nil {
			return val, nil
		}
	}

	// ── DB lookup ────────────────────────────────────────────────────────────
	var ativo bool
	err := l.db.QueryRow(ctx,
		`SELECT ativo FROM municipios_nfse WHERE ibge = $1`, ibge,
	).Scan(&ativo)
	if err != nil {
		// Not found in municipios_nfse → not enabled
		return false, nil
	}

	// ── Cache result ─────────────────────────────────────────────────────────
	if l.redis != nil {
		cacheKey := fmt.Sprintf("%s:%s", muniCachePrefix, ibge)
		_ = l.redis.Set(ctx, cacheKey, ativo, muniCacheTTL)
	}
	return ativo, nil
}

// ─── Legacy methods (backward-compatible, use legacyRates) ───────────────────

// GetAliquotaDefault returns the default ISS rate for the given municipality.
// Falls back to DefaultAliquotaISS when the municipality is not mapped.
// Deprecated: use GetAliquota for the context-aware DB+Redis version.
func (l *ISSLookup) GetAliquotaDefault(municipioIBGE string) float64 {
	if l.legacyRates != nil {
		if v, ok := l.legacyRates[municipioIBGE]; ok {
			return v
		}
	}
	return DefaultAliquotaISS
}

// Resolve returns the effective ISS rate for a request.
// If aliquotaOverride > 0 it is returned as-is (client override).
// Otherwise the municipality default (or 2% global fallback) is used.
// This method uses legacyRates only — prefer GetAliquota for production.
func (l *ISSLookup) Resolve(municipioIBGE string, aliquotaOverride float64) float64 {
	if aliquotaOverride > 0 {
		return aliquotaOverride
	}
	return l.GetAliquotaDefault(municipioIBGE)
}

// IsHabilitado reports whether a municipality is present in legacyRates.
// Deprecated: use MunicipioAtivo for the DB-backed version.
func (l *ISSLookup) IsHabilitado(municipioIBGE string) bool {
	if l.legacyRates != nil {
		_, ok := l.legacyRates[municipioIBGE]
		return ok
	}
	return false
}

// MunicipioInfo holds the ISS rate and IBGE code for the legacy handler path.
type MunicipioInfo struct {
	IBGE     string
	Aliquota float64
}

// ListAll returns all municipalities from legacyRates sorted by IBGE code.
// Used by the legacy MunicipioHandler path (in-memory, test mode).
func (l *ISSLookup) ListAll() []MunicipioInfo {
	out := make([]MunicipioInfo, 0, len(l.legacyRates))
	for ibge, aliq := range l.legacyRates {
		out = append(out, MunicipioInfo{IBGE: ibge, Aliquota: aliq})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].IBGE < out[j].IBGE })
	return out
}
