package auth

import (
	"context"
	"errors"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/supabase"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// RegisterMEIParams holds the data needed to register a new MEI.
type RegisterMEIParams struct {
	CNPJ          string
	RazaoSocial   string
	Email         string
	MunicipioIBGE string
	TipoUsuario   string // "mei" | "gateway" — defaults to "gateway" if empty
}

// RegisterMEIResult is returned after a successful registration.
type RegisterMEIResult struct {
	MeiID  uuid.UUID
	APIKey string // raw key, shown once
}

// APIKey holds the data loaded from the api_keys table.
type APIKey struct {
	ID        uuid.UUID
	MeiID     uuid.UUID // zero UUID when key belongs to an ME/EPP empresa (mei_id IS NULL)
	EmpresaID uuid.UUID // always set after ARCH-03
	KeyHash   string
	KeyPrefix string
}

// IsME returns true when this key belongs to an ME/EPP empresa (not a MEI).
// MEI keys have mei_id == empresa_id; ME/EPP keys have mei_id == uuid.Nil.
func (k *APIKey) IsME() bool { return k.MeiID == uuid.Nil }

// MEI holds the authenticated MEI plus their current subscription limits.
type MEI struct {
	ID                 uuid.UUID
	CNPJ               string
	RazaoSocial        string
	Email              string
	MunicipioIBGE      string
	CertSecretARN      *string // AWS Secrets Manager ARN for the A1 certificate
	StripeCustomerID   *string
	StripeSubID        *string
	StripeSubStatus    *string
	PlanoNome          string
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
// For MEI keys: both mei_id and empresa_id are set (same UUID after ARCH-03).
// For ME/EPP keys: mei_id is NULL (scanned as uuid.Nil); empresa_id is set.
func (r *Repository) FindByHash(ctx context.Context, hash string) (*APIKey, error) {
	row := r.db.Pool().QueryRow(ctx, `
		SELECT id,
		       COALESCE(mei_id, '00000000-0000-0000-0000-000000000000'::uuid),
		       empresa_id,
		       key_hash,
		       key_prefix
		FROM api_keys
		WHERE key_hash = $1
		  AND revoked_at IS NULL
	`, hash)

	var k APIKey
	if err := row.Scan(&k.ID, &k.MeiID, &k.EmpresaID, &k.KeyHash, &k.KeyPrefix); err != nil {
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
			m.cert_secret_arn,
			m.stripe_customer_id,
			em.stripe_subscription_id,
			em.stripe_subscription_status,
			COALESCE(p.nome, 'Trial')                 AS plano_nome,
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
		&mei.CertSecretARN,
		&mei.StripeCustomerID,
		&mei.StripeSubID,
		&mei.StripeSubStatus,
		&mei.PlanoNome,
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

// RegisterMEI inserts a new MEI, assigns the Trial plan for the current month,
// and creates a live API key — all inside a single transaction.
func (r *Repository) RegisterMEI(ctx context.Context, p RegisterMEIParams) (*RegisterMEIResult, error) {
	tx, err := r.db.Pool().Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tipoUsuario := SanitizeTipoUsuario(p.TipoUsuario)

	var meiID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO meis (cnpj, razao_social, email, municipio_ibge, tipo_usuario)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, p.CNPJ, p.RazaoSocial, p.Email, p.MunicipioIBGE, tipoUsuario).Scan(&meiID)
	if err != nil {
		return nil, err
	}

	var planID uuid.UUID
	err = tx.QueryRow(ctx,
		`SELECT id FROM planos WHERE nome = 'Trial' AND ativo = true LIMIT 1`,
	).Scan(&planID)
	if err != nil {
		return nil, err
	}

	competencia := time.Now().UTC().Format("2006-01")
	_, err = tx.Exec(ctx, `
		INSERT INTO emissoes_mensais (mei_id, plano_id, competencia)
		VALUES ($1, $2, $3)
	`, meiID, planID, competencia)
	if err != nil {
		return nil, err
	}

	rawKey, hash, err := GenerateKey(true)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO api_keys (mei_id, key_hash, key_prefix, label)
		VALUES ($1, $2, $3, 'default')
	`, meiID, hash, PrefixOf(rawKey))
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &RegisterMEIResult{MeiID: meiID, APIKey: rawKey}, nil
}

// SaveStripeCustomerID persists the Stripe Customer ID on the MEI row.
func (r *Repository) SaveStripeCustomerID(ctx context.Context, meiID uuid.UUID, customerID string) error {
	_, err := r.db.Pool().Exec(ctx, `
		UPDATE meis
		SET stripe_customer_id = $1, updated_at = NOW()
		WHERE id = $2
	`, customerID, meiID)
	return err
}

// SaveCertSecretARN persists the AWS Secrets Manager ARN for the MEI's A1 certificate.
// Called after the first successful StoreCert invocation.
func (r *Repository) SaveCertSecretARN(ctx context.Context, meiID uuid.UUID, arn string) error {
	_, err := r.db.Pool().Exec(ctx, `
		UPDATE meis
		SET cert_secret_arn = $1, updated_at = NOW()
		WHERE id = $2
	`, arn, meiID)
	return err
}
