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
	db        *supabase.Client
	authAdmin *supabase.AuthAdminClient // optional — required for RegisterMEI after migration 20260620
}

// NewRepository creates a Repository using the shared Supabase pool.
func NewRepository(db *supabase.Client) *Repository {
	return &Repository{db: db}
}

// WithAuthAdmin attaches a Supabase Auth Admin client so RegisterMEI can
// provision auth.users rows (required since the multi_produto migration added
// empresas.user_id NOT NULL REFERENCES auth.users(id)).
func (r *Repository) WithAuthAdmin(c *supabase.AuthAdminClient) *Repository {
	r.authAdmin = c
	return r
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

// RegisterMEI provisions a new MEI end-to-end:
//  1. Creates an auth.users row via the Supabase Auth Admin API (gives us a UUID
//     that satisfies the empresas.user_id FK).
//  2. Inserts mirror rows into meis and empresas using the same UUID.
//  3. Inserts emissoes_mensais (Trial plan) and api_keys with empresa_id set.
//
// All DB writes happen in a single transaction. If the transaction fails after
// the auth.users row is created, the auth row is rolled back via a best-effort
// DeleteUser call so we don't leak orphan accounts.
func (r *Repository) RegisterMEI(ctx context.Context, p RegisterMEIParams) (*RegisterMEIResult, error) {
	if r.authAdmin == nil {
		return nil, errors.New("RegisterMEI: AuthAdminClient not configured (call WithAuthAdmin)")
	}

	tipoUsuario := SanitizeTipoUsuario(p.TipoUsuario)

	// ── 1. auth.users — must come first to satisfy empresas.user_id FK ─────────
	userID, err := r.authAdmin.CreateUser(ctx, supabase.CreateUserParams{
		Email:        p.Email,
		EmailConfirm: true, // skip the magic-link step — MEI authenticates via API key
		UserMetadata: map[string]interface{}{
			"cnpj":         p.CNPJ,
			"razao_social": p.RazaoSocial,
			"tipo_usuario": tipoUsuario,
		},
	})
	if err != nil {
		return nil, err
	}

	// Best-effort cleanup of the auth.users row when the DB transaction below fails.
	committed := false
	defer func() {
		if committed {
			return
		}
		// Use a fresh background context so the cleanup runs even if `ctx` is
		// already cancelled (typical when the request times out).
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = r.authAdmin.DeleteUser(cleanupCtx, userID)
	}()

	// ── 2-5. Atomic DB transaction ─────────────────────────────────────────────
	tx, err := r.db.Pool().Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// meis — mirror of the legacy MEI-only model. id = userID so empresa.id = mei.id.
	_, err = tx.Exec(ctx, `
		INSERT INTO meis (id, cnpj, razao_social, email, municipio_ibge, tipo_usuario)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, userID, p.CNPJ, p.RazaoSocial, p.Email, p.MunicipioIBGE, tipoUsuario)
	if err != nil {
		return nil, err
	}

	// empresas — generalized model (MEI/ME/EPP). Same UUID keeps RLS + FKs consistent.
	_, err = tx.Exec(ctx, `
		INSERT INTO empresas (
			id, user_id, tipo, regime_tributario,
			cnpj, razao_social, email, municipio_ibge, tipo_usuario
		)
		VALUES ($1, $1, 'MEI', 'SIMPLES_MEI', $2, $3, $4, $5, $6)
	`, userID, p.CNPJ, p.RazaoSocial, p.Email, p.MunicipioIBGE, tipoUsuario)
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
		INSERT INTO emissoes_mensais (mei_id, empresa_id, plano_id, competencia)
		VALUES ($1, $1, $2, $3)
	`, userID, planID, competencia)
	if err != nil {
		return nil, err
	}

	rawKey, hash, err := GenerateKey(true)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO api_keys (mei_id, empresa_id, key_hash, key_prefix, label)
		VALUES ($1, $1, $2, $3, 'default')
	`, userID, hash, PrefixOf(rawKey))
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	committed = true
	return &RegisterMEIResult{MeiID: userID, APIKey: rawKey}, nil
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
