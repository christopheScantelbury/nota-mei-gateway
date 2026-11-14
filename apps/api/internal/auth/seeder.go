package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/supabase"
	"github.com/google/uuid"
)

const (
	// SeedCNPJ is the fixed CNPJ of the test MEI (valid check digits).
	SeedCNPJ = "11222333000181"

	// SeedAPIKey is the well-known raw API key for the sandbox test MEI.
	// It is deterministic so callers always know it; never use in production.
	SeedAPIKey = "sk_test_0000000000000000000000000000000000000000000000000000000000000000"

	seedRazaoSocial   = "MEI de Teste — NotaMEI Gateway"
	seedEmail         = "sandbox@emitirnotafacil.com.br"
	seedMunicipioIBGE = "3550308" // São Paulo
)

var seedKeyHash = HashKey(SeedAPIKey)

// SeedResult holds the data returned after seeding.
type SeedResult struct {
	MeiID  uuid.UUID
	APIKey string
}

// Seeder creates the test MEI and its fixed API key idempotently.
type Seeder struct {
	db *supabase.Client
}

// NewSeeder creates a Seeder.
func NewSeeder(db *supabase.Client) *Seeder { return &Seeder{db: db} }

// Seed ensures the test MEI and its API key exist. Safe to call multiple times.
func (s *Seeder) Seed(ctx context.Context) (*SeedResult, error) {
	pool := s.db.Pool()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("seed: begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// 1. Upsert the MEI (idempotent on CNPJ).
	var meiID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO meis (cnpj, razao_social, email, municipio_ibge)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (cnpj) DO UPDATE SET updated_at = NOW()
		RETURNING id
	`,
		SeedCNPJ, seedRazaoSocial, seedEmail, seedMunicipioIBGE,
	).Scan(&meiID)
	if err != nil {
		return nil, fmt.Errorf("seed: upsert mei: %w", err)
	}

	// 2. Upsert the empresa that mirrors the MEI (same UUID, as RegisterMEI does).
	//    Since ARCH-03 emissoes_mensais/api_keys/notas_fiscais hang off empresa_id;
	//    without this row the inserts below violate NOT NULL / CHECK constraints.
	//    user_id stays NULL: the sandbox MEI has no Supabase Auth user.
	//    RETURNING id covers a database where the CNPJ already has an empresa row.
	var empresaID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO empresas (
			id, tipo, regime_tributario,
			cnpj, razao_social, email, municipio_ibge
		)
		VALUES ($1, 'MEI', 'SIMPLES_MEI', $2, $3, $4, $5)
		ON CONFLICT (cnpj) DO UPDATE SET updated_at = NOW()
		RETURNING id
	`, meiID, SeedCNPJ, seedRazaoSocial, seedEmail, seedMunicipioIBGE).Scan(&empresaID)
	if err != nil {
		return nil, fmt.Errorf("seed: upsert empresa: %w", err)
	}

	// 3. Ensure a Trial emissoes_mensais row exists for the current month.
	//    No conflict target: the table has UNIQUE(mei_id, competencia) and
	//    UNIQUE(empresa_id, competencia), and a re-seed hits both.
	competencia := time.Now().UTC().Format("2006-01")
	_, err = tx.Exec(ctx, `
		INSERT INTO emissoes_mensais (mei_id, empresa_id, plano_id, competencia, total_emitidas)
		SELECT $1, $2,
		       (SELECT id FROM planos WHERE nome = 'Trial' LIMIT 1),
		       $3, 0
		ON CONFLICT DO NOTHING
	`, meiID, empresaID, competencia)
	if err != nil {
		return nil, fmt.Errorf("seed: upsert emissoes_mensais: %w", err)
	}

	// 4. Upsert the fixed API key (idempotent on key_hash).
	_, err = tx.Exec(ctx, `
		INSERT INTO api_keys (mei_id, empresa_id, key_hash, key_prefix, label)
		VALUES ($1, $2, $3, $4, 'seed')
		ON CONFLICT (key_hash) DO NOTHING
	`, meiID, empresaID, seedKeyHash, PrefixTest)
	if err != nil {
		return nil, fmt.Errorf("seed: upsert api_key: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("seed: commit: %w", err)
	}

	return &SeedResult{MeiID: meiID, APIKey: SeedAPIKey}, nil
}
