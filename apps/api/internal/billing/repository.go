// Package billing implements the BillingGuard that enforces monthly emission limits.
package billing

import (
	"context"
	"errors"

	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/supabase"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Plano holds the billing plan data for a MEI.
type Plano struct {
	ID                uuid.UUID
	Nome              string
	EmissoesLimite    int
	PrecMensalBRL     float64
	PrecExcedenteBRL  float64
	StripePriceID     *string
}

// EmissaoMensal holds the MEI's monthly emission record.
type EmissaoMensal struct {
	ID              uuid.UUID
	MeiID           uuid.UUID
	PlanoID         *uuid.UUID
	Competencia     string
	TotalEmitidas   int
	StripeSubID     *string
	StripeSubStatus *string
}

// Repository handles billing-related database operations.
type Repository struct {
	db *supabase.Client
}

// NewRepository creates a billing Repository.
func NewRepository(db *supabase.Client) *Repository {
	return &Repository{db: db}
}

// GetOrCreateEmissaoMensal returns the MEI's emissao_mensal row for the current month,
// creating it if it does not exist.
func (r *Repository) GetOrCreateEmissaoMensal(ctx context.Context, meiID uuid.UUID) (*EmissaoMensal, error) {
	_, err := r.db.Pool().Exec(ctx, `
		INSERT INTO emissoes_mensais (mei_id, competencia, total_emitidas)
		VALUES ($1, to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM'), 0)
		ON CONFLICT (mei_id, competencia) DO NOTHING
	`, meiID)
	if err != nil {
		return nil, err
	}

	row := r.db.Pool().QueryRow(ctx, `
		SELECT id, mei_id, plano_id, competencia, total_emitidas,
		       stripe_subscription_id, stripe_subscription_status
		FROM emissoes_mensais
		WHERE mei_id = $1
		  AND competencia = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
	`, meiID)

	var em EmissaoMensal
	if err := row.Scan(
		&em.ID, &em.MeiID, &em.PlanoID, &em.Competencia, &em.TotalEmitidas,
		&em.StripeSubID, &em.StripeSubStatus,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("emissao_mensal not found after upsert")
		}
		return nil, err
	}
	return &em, nil
}

// IncrementEmitidas atomically increments the MEI's monthly emission counter.
func (r *Repository) IncrementEmitidas(ctx context.Context, meiID uuid.UUID) (int, error) {
	row := r.db.Pool().QueryRow(ctx, `
		UPDATE emissoes_mensais
		SET total_emitidas = total_emitidas + 1
		WHERE mei_id = $1
		  AND competencia = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
		RETURNING total_emitidas
	`, meiID)

	var total int
	if err := row.Scan(&total); err != nil {
		return 0, err
	}
	return total, nil
}
