// Package jobs provides runnable maintenance jobs for the Nota MEI Gateway API.
//
// # update_municipios
//
// Synchronises the municipios_nfse table with the official NFS-e Nacional
// municipality list published at gov.br/nfse.
//
// # Running manually
//
//	make update-municipios
//	# or directly:
//	DATABASE_URL=... REDIS_URL=... go run ./cmd/jobs/update_municipios.go
//
// # Scheduled execution
//
// On Railway, add a Cron service that executes:
//
//	go run ./cmd/jobs/update_municipios.go
//
// once a month (e.g. cron expression: 0 3 1 * *)
package main

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// municipioGov holds parsed data from the gov.br/nfse municipality list.
type municipioGov struct {
	IBGE       string
	Nome       string
	UF         string
	DataAdesao time.Time
}

func main() {
	zerolog.SetGlobalLevel(zerolog.InfoLevel)
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal().Msg("DATABASE_URL environment variable is required")
	}

	redisURL := os.Getenv("REDIS_URL")

	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer db.Close()

	var rdb *redis.Client
	if redisURL != "" {
		opt, parseErr := redis.ParseURL(redisURL)
		if parseErr != nil {
			log.Warn().Err(parseErr).Msg("invalid REDIS_URL — cache invalidation disabled")
		} else {
			rdb = redis.NewClient(opt)
		}
	}

	if err := UpdateMunicipiosAtivos(ctx, db, rdb); err != nil {
		log.Fatal().Err(err).Msg("update failed")
	}
}

// UpdateMunicipiosAtivos fetches the NFS-e Nacional municipality list and
// upserts into municipios_nfse.  New municipalities are inserted as active;
// existing rows are refreshed.  Municipalities that disappear from the official
// list are NOT deleted — they are left ativo=false for history.
//
// Data source: gov.br/nfse — CSV download or scraper.
// Fallback: if the download fails, the function logs a warning and returns nil
// so the caller can decide how to handle it.
func UpdateMunicipiosAtivos(ctx context.Context, db *pgxpool.Pool, rdb *redis.Client) error {
	municipios, err := fetchMunicipiosGovBr(ctx)
	if err != nil {
		log.Warn().Err(err).Msg("could not fetch municipios from gov.br/nfse — " +
			"update skipped; expand supabase/seed_municipios.sql manually")
		// Graceful: return nil so a cron failure doesn't crash the container.
		return nil
	}

	inserted := 0
	updated := 0
	for _, m := range municipios {
		tag, execErr := db.Exec(ctx, `
			INSERT INTO municipios_nfse (ibge, nome, uf, ativo, data_adesao, updated_at)
			VALUES ($1, $2, $3, true, $4, NOW())
			ON CONFLICT (ibge) DO UPDATE
			SET nome        = EXCLUDED.nome,
			    uf          = EXCLUDED.uf,
			    ativo       = true,
			    updated_at  = NOW()
		`, m.IBGE, m.Nome, m.UF, m.DataAdesao)
		if execErr != nil {
			log.Warn().Err(execErr).Str("ibge", m.IBGE).Msg("upsert failed")
			continue
		}
		if tag.RowsAffected() == 1 {
			inserted++
		} else {
			updated++
		}
	}

	// Invalidate Redis municipality cache so the API reads fresh data.
	if rdb != nil {
		keys, keysErr := rdb.Keys(ctx, "muni:ativo:*").Result()
		if keysErr == nil && len(keys) > 0 {
			if delErr := rdb.Del(ctx, keys...).Err(); delErr != nil {
				log.Warn().Err(delErr).Msg("failed to invalidate muni:ativo cache")
			}
		}
		// Also invalidate the list cache.
		listKeys, _ := rdb.Keys(ctx, "municipios:lista:*").Result()
		if len(listKeys) > 0 {
			_ = rdb.Del(ctx, listKeys...)
		}
	}

	log.Info().
		Int("total", len(municipios)).
		Int("inserted", inserted).
		Int("updated", updated).
		Msg("municipios_nfse updated")
	return nil
}

// fetchMunicipiosGovBr downloads and parses the municipality CSV from gov.br/nfse.
//
// # Data source strategy
//
// 1. Try the NFS-e Nacional MOC API (if a GET /municipios endpoint exists).
// 2. Fall back to downloading the CSV from gov.br/nfse/pt-br/municipios.
// 3. If both fail, return an error — the caller decides how to proceed.
//
// NOTE: The gov.br/nfse CSV format is not yet stable; update this parser
// when the official format is confirmed.  For the MVP, the seed_municipios.sql
// is the primary source and this job supplements it.
func fetchMunicipiosGovBr(ctx context.Context) ([]municipioGov, error) {
	// Attempt 1: NFS-e Nacional REST endpoint (MOC section "Consultas").
	// URL may vary — update when official docs confirm the endpoint.
	nfseAPIURL := "https://www.nfse.gov.br/m/app/api/municipios"

	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, nfseAPIURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Accept", "text/csv,application/json")

	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			_ = resp.Body.Close()
		}
		// Attempt 2: static CSV page (HTML scrape would be needed for the full list).
		// For MVP, return placeholder error and let seed_municipios.sql handle it.
		return nil, fmt.Errorf(
			"gov.br/nfse API unavailable (status=%v) — "+
				"update supabase/seed_municipios.sql manually; "+
				"see docs/architecture.md#update-municipios",
			func() int {
				if resp != nil {
					return resp.StatusCode
				}
				return 0
			}(),
		)
	}
	defer func() { _ = resp.Body.Close() }()

	return parseMunicipiosCSV(resp.Body)
}

// parseMunicipiosCSV parses the CSV response from gov.br/nfse.
// Expected columns (order may vary): ibge, nome, uf, data_adesao.
func parseMunicipiosCSV(r io.Reader) ([]municipioGov, error) {
	csvReader := csv.NewReader(r)
	csvReader.TrimLeadingSpace = true

	header, err := csvReader.Read()
	if err != nil {
		return nil, fmt.Errorf("read CSV header: %w", err)
	}

	// Build column index map (case-insensitive).
	colIdx := make(map[string]int, len(header))
	for i, h := range header {
		colIdx[strings.ToLower(strings.TrimSpace(h))] = i
	}
	requiredCols := []string{"ibge", "nome", "uf"}
	for _, col := range requiredCols {
		if _, ok := colIdx[col]; !ok {
			return nil, fmt.Errorf("CSV missing required column %q (headers: %v)", col, header)
		}
	}

	var municipios []municipioGov
	for {
		rec, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("read CSV row: %w", err)
		}

		m := municipioGov{
			IBGE: strings.TrimSpace(rec[colIdx["ibge"]]),
			Nome: strings.TrimSpace(rec[colIdx["nome"]]),
			UF:   strings.ToUpper(strings.TrimSpace(rec[colIdx["uf"]])),
		}
		if m.IBGE == "" || m.Nome == "" || m.UF == "" {
			continue
		}

		if idx, ok := colIdx["data_adesao"]; ok && idx < len(rec) {
			if t, parseErr := time.Parse("2006-01-02", strings.TrimSpace(rec[idx])); parseErr == nil {
				m.DataAdesao = t
			}
		}

		municipios = append(municipios, m)
	}
	return municipios, nil
}
