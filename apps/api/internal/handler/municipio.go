package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/gofiber/fiber/v2"
)

// MunicipioEntry holds the data returned for a single municipality in GET /v1/municipios.
type MunicipioEntry struct {
	IBGE        string
	Nome        string
	UF          string
	DataAdesao  string   // "2006-01-02" or ""
	AliqPadrao  *float64 // nil when no default rate is mapped
	NBSMapeadas bool     // true when NBS-specific rates exist for this municipality
}

// MunicipioLister is the interface used by MunicipioHandler to retrieve municipalities.
// Allows test stubs without a real database.
type MunicipioLister interface {
	// ListAtivos returns all active municipalities, optionally filtered by UF (2 chars).
	// atualizado is the most recent updated_at in municipios_nfse (used for the cache header).
	ListAtivos(ctx context.Context, uf string) (entries []MunicipioEntry, atualizado time.Time, err error)
}

// MunicipioHandler serves GET /v1/municipios.
type MunicipioHandler struct {
	lister MunicipioLister
}

// NewMunicipioHandler creates a MunicipioHandler backed by the provided lister.
func NewMunicipioHandler(l MunicipioLister) *MunicipioHandler {
	return &MunicipioHandler{lister: l}
}

// ListMunicipios handles GET /v1/municipios.
// Optional query param ?uf=AM filters by 2-char state abbreviation.
// Response: {"municipios": [...], "total": N, "atualizado_em": "..."}
func (h *MunicipioHandler) ListMunicipios(c *fiber.Ctx) error {
	if h.lister == nil {
		return c.JSON(fiber.Map{"municipios": []fiber.Map{}, "total": 0})
	}

	uf := strings.ToUpper(c.Query("uf"))
	if uf != "" {
		if _, ok := ufToIBGEPrefix[uf]; !ok {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":   "INVALID_UF",
				"message": "UF inválida — use sigla de dois caracteres (ex: AM, SP)",
			})
		}
	}

	entries, atualizado, err := h.lister.ListAtivos(c.Context(), uf)
	if err != nil {
		return internalError(c, "erro ao consultar municípios")
	}

	items := make([]fiber.Map, 0, len(entries))
	for _, e := range entries {
		item := fiber.Map{
			"ibge":                   e.IBGE,
			"nome":                   e.Nome,
			"uf":                     e.UF,
			"aliquotas_nbs_mapeadas": e.NBSMapeadas,
		}
		if e.DataAdesao != "" {
			item["data_adesao"] = e.DataAdesao
		}
		if e.AliqPadrao != nil {
			item["aliquota_padrao"] = *e.AliqPadrao
		}
		items = append(items, item)
	}

	return c.JSON(fiber.Map{
		"municipios":    items,
		"total":         len(items),
		"atualizado_em": atualizado.UTC().Format(time.RFC3339),
	})
}

// ─── DB-backed implementation ─────────────────────────────────────────────────

const muniListCacheTTL = 24 * time.Hour

// DBMunicipioLister queries municipios_nfse + iss_aliquotas with Redis caching.
type DBMunicipioLister struct {
	db    *pgxpool.Pool
	redis *redis.Client
}

// NewDBMunicipioLister creates a DB-backed MunicipioLister.
// Pass a nil redis client to disable caching.
func NewDBMunicipioLister(db *pgxpool.Pool, rdb *redis.Client) *DBMunicipioLister {
	return &DBMunicipioLister{db: db, redis: rdb}
}

// ListAtivos queries municipios_nfse active municipalities, filtered by UF when non-empty.
// Results are cached in Redis for 24 h under the key "municipios:lista:{uf}".
func (l *DBMunicipioLister) ListAtivos(ctx context.Context, uf string) ([]MunicipioEntry, time.Time, error) {
	cacheKey := fmt.Sprintf("municipios:lista:%s", uf)

	// ── Redis cache ──────────────────────────────────────────────────────────
	if l.redis != nil {
		if raw, err := l.redis.Get(ctx, cacheKey).Bytes(); err == nil {
			var cached cachedMuniList
			if json.Unmarshal(raw, &cached) == nil {
				return cached.Entries, cached.AtualizadoEm, nil
			}
		}
	}

	// ── DB query ─────────────────────────────────────────────────────────────
	rows, err := l.db.Query(ctx, `
		SELECT
			m.ibge,
			m.nome,
			m.uf,
			m.data_adesao,
			a.aliquota                                        AS aliquota_padrao,
			EXISTS (
				SELECT 1 FROM iss_aliquotas x
				WHERE x.ibge = m.ibge
				  AND x.codigo_nbs IS NOT NULL
				  AND x.vigencia_ini <= CURRENT_DATE
				  AND (x.vigencia_fim IS NULL OR x.vigencia_fim >= CURRENT_DATE)
			)                                                AS nbs_mapeadas
		FROM municipios_nfse m
		LEFT JOIN iss_aliquotas a
			ON  a.ibge = m.ibge
			AND a.codigo_nbs IS NULL
			AND a.vigencia_ini <= CURRENT_DATE
			AND (a.vigencia_fim IS NULL OR a.vigencia_fim >= CURRENT_DATE)
		WHERE m.ativo = true
		  AND ($1 = '' OR m.uf = $1)
		ORDER BY m.uf, m.nome
	`, uf)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("municipios query: %w", err)
	}
	defer rows.Close()

	var entries []MunicipioEntry
	for rows.Next() {
		var e MunicipioEntry
		var dataAdesao *time.Time
		var aliqPadrao *float64
		var nbsMapeadas bool

		if err := rows.Scan(
			&e.IBGE, &e.Nome, &e.UF,
			&dataAdesao, &aliqPadrao, &nbsMapeadas,
		); err != nil {
			return nil, time.Time{}, fmt.Errorf("municipios scan: %w", err)
		}
		if dataAdesao != nil {
			e.DataAdesao = dataAdesao.Format("2006-01-02")
		}
		e.AliqPadrao = aliqPadrao
		e.NBSMapeadas = nbsMapeadas
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		return nil, time.Time{}, fmt.Errorf("municipios rows: %w", err)
	}

	// ── updated_at (most recent row in municipios_nfse) ───────────────────────
	var atualizado time.Time
	_ = l.db.QueryRow(ctx,
		`SELECT MAX(updated_at) FROM municipios_nfse WHERE ativo = true`,
	).Scan(&atualizado)

	// ── Cache result ─────────────────────────────────────────────────────────
	if l.redis != nil && len(entries) > 0 {
		if payload, err := json.Marshal(cachedMuniList{
			Entries: entries, AtualizadoEm: atualizado,
		}); err == nil {
			_ = l.redis.Set(ctx, cacheKey, payload, muniListCacheTTL)
		}
	}

	return entries, atualizado, nil
}

// cachedMuniList is the Redis-cached payload for the municipios list.
type cachedMuniList struct {
	Entries      []MunicipioEntry `json:"entries"`
	AtualizadoEm time.Time        `json:"atualizado_em"`
}

// ─── UF → IBGE prefix map ─────────────────────────────────────────────────────

// ufToIBGEPrefix maps 2-char Brazilian state codes to 2-digit IBGE municipality prefixes.
var ufToIBGEPrefix = map[string]string{
	"RO": "11", "AC": "12", "AM": "13", "RR": "14", "PA": "15",
	"AP": "16", "TO": "17", "MA": "21", "PI": "22", "CE": "23",
	"RN": "24", "PB": "25", "PE": "26", "AL": "27", "SE": "28",
	"BA": "29", "MG": "31", "ES": "32", "RJ": "33", "SP": "35",
	"PR": "41", "SC": "42", "RS": "43", "MS": "50", "MT": "51",
	"GO": "52", "DF": "53",
}
