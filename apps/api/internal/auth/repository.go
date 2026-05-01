package auth

import (
	"context"
	"errors"

	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/supabase"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// APIKey holds the data loaded from the api_keys table.
type APIKey struct {
	ID        uuid.UUID
	MeiID     uuid.UUID
	KeyHash   string
	KeyPrefix string
}

// MEI holds the authenticated MEI plus their current subscription limits.
type MEI struct {
	ID                 uuid.UUID
	CNPJ               string
	RazaoSocial        string
	Email              string
	MunicipioIBGE      string
	StripeCustomerID   *string
	StripeSubID        *string
	StripeSubStatus    *string
	PlanoLimite        int
	PlanoPrecExcedente float64
	TotalEmitidas      int
}

// Repository handles auth-related database operations.
type Repository struct {
	db *supabase.Client
}

// NewRepository creates a Repository using the shared Supabase pool.
func NewRepository(db *supabase.Client) *Repository {
	return &Repository{db: db}
}

// FindByHash looks up a non-revoked API key by its SHA-256 hash.
func (r *Repository) FindByHash(ctx context.Context, hash string) (*APIKey, error) {
	row := r.db.Pool().QueryRow(ctx, `
		SELECT id, mei_id, key_hash, key_prefix
		FROM api_keys
		WHERE key_hash = $1
		  AND revoked_at IS NULL
	`, hash)

	var k APIKey
	if err := row.Scan(&k.ID, &k.MeiID, &k.KeyHash, &k.KeyPrefix); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidKey{Reason: "not found or revoked"}
		}
		return nil, err
	}
	return &k, nil
}

// FindMEI loads a MEI and their active subscription info for the current month.
func (r *Repository) FindMEI(ctx context.Context, meiID uuid.UUID) (*MEI, error) {
	row := r.db.Pool().QueryRow(ctx, `
		SELECT
			m.id, m.cnpj, m.razao_social, m.email, m.municipio_ibge,
			m.stripe_customer_id,
			em.stripe_subscription_id,
			em.stripe_subscription_status,
			COALESCE(p.emissoes_limite, 5)            AS plano_limite,
			COALESCE(p.preco_excedente_brl, 0.50)     AS plano_prec_excedente,
			COALESCE(em.total_emitidas, 0)            AS total_emitidas
		FROM meis m
		LEFT JOIN emissoes_mensais em
			ON em.mei_id = m.id
			AND em.competencia = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
		LEFT JOIN planos p ON p.id = em.plano_id
		WHERE m.id = $1
	`, meiID)

	var mei MEI
	if err := row.Scan(
		&mei.ID, &mei.CNPJ, &mei.RazaoSocial, &mei.Email, &mei.MunicipioIBGE,
		&mei.StripeCustomerID,
		&mei.StripeSubID,
		&mei.StripeSubStatus,
		&mei.PlanoLimite,
		&mei.PlanoPrecExcedente,
		&mei.TotalEmitidas,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidKey{Reason: "MEI not found"}
		}
		return nil, err
	}
	return &mei, nil
}
