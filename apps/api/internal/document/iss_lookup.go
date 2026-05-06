package document

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// DefaultAliquotaISS is used when the municipality is not mapped.
	DefaultAliquotaISS = 2.0
)

// ISSLookup provides the default ISS rate for a given municipality.
// Rates are loaded into memory at startup for O(1) lookups.
type ISSLookup struct {
	rates map[string]float64 // municipio_ibge → aliquota percentage
}

// NewISSLookup loads all municipality rates from the database into memory.
func NewISSLookup(ctx context.Context, db *pgxpool.Pool) (*ISSLookup, error) {
	rows, err := db.Query(ctx, `SELECT municipio_ibge, aliquota FROM aliquotas_iss`)
	if err != nil {
		return nil, fmt.Errorf("iss_lookup: query: %w", err)
	}
	defer rows.Close()

	rates := make(map[string]float64)
	for rows.Next() {
		var ibge string
		var aliquota float64
		if err := rows.Scan(&ibge, &aliquota); err != nil {
			return nil, fmt.Errorf("iss_lookup: scan: %w", err)
		}
		rates[ibge] = aliquota
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iss_lookup: rows: %w", err)
	}

	return &ISSLookup{rates: rates}, nil
}

// GetAliquota returns the ISS rate for the given IBGE municipality code.
// Falls back to DefaultAliquotaISS when the municipality is not mapped.
func (l *ISSLookup) GetAliquota(municipioIBGE string) float64 {
	if v, ok := l.rates[municipioIBGE]; ok {
		return v
	}
	return DefaultAliquotaISS
}

// Resolve returns the effective ISS rate to use for a request.
// If aliquotaOverride > 0, it is returned as-is (manual override).
// Otherwise the municipality default (or 2% fallback) is used.
func (l *ISSLookup) Resolve(municipioIBGE string, aliquotaOverride float64) float64 {
	if aliquotaOverride > 0 {
		return aliquotaOverride
	}
	return l.GetAliquota(municipioIBGE)
}

// IsHabilitado reports whether a municipality is mapped in the ISS table,
// meaning it participates in NFS-e Nacional. Any municipality present in the
// aliquotas_iss table is considered enabled for emission.
func (l *ISSLookup) IsHabilitado(municipioIBGE string) bool {
	_, ok := l.rates[municipioIBGE]
	return ok
}

// MunicipioInfo holds the ISS rate and IBGE code for a municipality.
type MunicipioInfo struct {
	IBGE     string
	Aliquota float64
}

// ListAll returns all municipalities in the lookup table sorted by IBGE code.
func (l *ISSLookup) ListAll() []MunicipioInfo {
	out := make([]MunicipioInfo, 0, len(l.rates))
	for ibge, aliq := range l.rates {
		out = append(out, MunicipioInfo{IBGE: ibge, Aliquota: aliq})
	}
	return out
}
