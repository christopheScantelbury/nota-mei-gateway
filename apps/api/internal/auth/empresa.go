package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Empresa holds the authenticated empresa and their current subscription info.
// Used for ME/EPP companies registered in the empresas table.
type Empresa struct {
	ID               uuid.UUID
	Tipo             string // "MEI" | "ME" | "EPP"
	RegimeTributario string // "SIMPLES_MEI" | "SIMPLES_NACIONAL" | "LUCRO_PRESUMIDO" | "LUCRO_REAL"
	CNPJ             string
	RazaoSocial      string
	Email            string
	MunicipioIBGE    string
	// CNAE is the empresa's primary CNAE activity code (7 digits), required for DPS.
	CNAE string
	// CEP is the empresa's postal code (8 digits), required for the DPS enderNac block.
	CEP                string
	InscricaoMunicipal *string
	CertSecretARN      *string
	CertValidUntil     *time.Time
	StripeCustomerID   *string
	TrialMe            bool
	// Billing info (from emissoes_mensais + planos)
	StripeSubID        *string
	StripeSubStatus    *string
	PlanoNome          string
	PlanoLimite        int
	PlanoPrecExcedente float64
	TotalEmitidas      int
}

// RegisterEmpresaParams holds the data needed to register a new ME/EPP empresa.
type RegisterEmpresaParams struct {
	Tipo               string // "ME" | "EPP"
	RegimeTributario   string // "SIMPLES_NACIONAL" | "LUCRO_PRESUMIDO" | "LUCRO_REAL"
	CNPJ               string
	RazaoSocial        string
	Email              string
	MunicipioIBGE      string
	CNAE               string // 7-digit CNAE activity code — required for DPS
	CEP                string // 8-digit postal code — required for DPS enderNac
	InscricaoMunicipal string // optional
}

// RegisterEmpresaResult is returned after a successful ME/EPP registration.
type RegisterEmpresaResult struct {
	EmpresaID uuid.UUID
	APIKey    string // raw key, shown once
}

// FindEmpresaByUserID loads an empresa linked to the given Supabase auth.user.id.
//
// Bug 2026-06-05 motivou: ME/EPP novos cadastrados via /v1/auth/register/me têm
// empresa.id como UUID random e empresa.user_id apontando pro auth.user.id. O
// hybrid_middleware antes chamava FindEmpresa(userID) que busca WHERE id=$1 —
// só funcionava pra MEI legacy ARCH-03 (onde empresa.id == auth.user.id).
// Resultado: NO_ACCOUNT pra todo cadastro ME/EPP feito após a migração.
//
// Esta função usa a coluna `user_id` que é o link semântico correto.
func (r *Repository) FindEmpresaByUserID(ctx context.Context, userID uuid.UUID) (*Empresa, error) {
	var empresaID uuid.UUID
	if err := r.db.Pool().QueryRow(ctx, `
		SELECT id FROM empresas WHERE user_id = $1 LIMIT 1
	`, userID).Scan(&empresaID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidKey{Reason: "no empresa linked to user"}
		}
		return nil, err
	}
	return r.FindEmpresa(ctx, empresaID)
}

// FindEmpresa loads an empresa and their active subscription info for the current month.
func (r *Repository) FindEmpresa(ctx context.Context, empresaID uuid.UUID) (*Empresa, error) {
	row := r.db.Pool().QueryRow(ctx, `
		SELECT
			e.id,
			e.tipo,
			e.regime_tributario,
			e.cnpj,
			e.razao_social,
			e.email,
			e.municipio_ibge,
			COALESCE(e.cnae, '')              AS cnae,
			COALESCE(e.cep, '')               AS cep,
			e.inscricao_municipal,
			e.cert_secret_arn,
			e.cert_valid_until,
			e.stripe_customer_id,
			e.trial_me,
			em.stripe_subscription_id,
			em.stripe_subscription_status,
			COALESCE(p.nome, 'Trial ME')      AS plano_nome,
			COALESCE(p.emissoes_limite, 9999) AS plano_limite,
			COALESCE(p.preco_excedente_brl, 0) AS plano_prec_excedente,
			COALESCE(em.total_emitidas, 0)    AS total_emitidas
		FROM empresas e
		LEFT JOIN emissoes_mensais em
			ON em.empresa_id = e.id
			AND em.competencia = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
		LEFT JOIN planos p ON p.id = em.plano_id
		WHERE e.id = $1
	`, empresaID)

	var e Empresa
	if err := row.Scan(
		&e.ID, &e.Tipo, &e.RegimeTributario,
		&e.CNPJ, &e.RazaoSocial, &e.Email, &e.MunicipioIBGE,
		&e.CNAE, &e.CEP,
		&e.InscricaoMunicipal,
		&e.CertSecretARN, &e.CertValidUntil,
		&e.StripeCustomerID,
		&e.TrialMe,
		&e.StripeSubID, &e.StripeSubStatus,
		&e.PlanoNome, &e.PlanoLimite, &e.PlanoPrecExcedente,
		&e.TotalEmitidas,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidKey{Reason: "empresa not found"}
		}
		return nil, err
	}
	return &e, nil
}

// RegisterEmpresa inserts a new ME/EPP empresa, assigns the Trial ME plan for
// the current month, and creates a live API key — all inside a single transaction.
func (r *Repository) RegisterEmpresa(ctx context.Context, p RegisterEmpresaParams) (*RegisterEmpresaResult, error) {
	tx, err := r.db.Pool().Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Normalise optional field.
	var inscricaoMunicipal *string
	if p.InscricaoMunicipal != "" {
		inscricaoMunicipal = &p.InscricaoMunicipal
	}

	var cnae *string
	if p.CNAE != "" {
		cnae = &p.CNAE
	}
	var cep *string
	if p.CEP != "" {
		cep = &p.CEP
	}

	var empresaID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO empresas (tipo, regime_tributario, cnpj, razao_social, email,
		                      municipio_ibge, cnae, cep, inscricao_municipal, trial_me, tipo_usuario)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, 'gateway')
		RETURNING id
	`, p.Tipo, p.RegimeTributario, p.CNPJ, p.RazaoSocial, p.Email,
		p.MunicipioIBGE, cnae, cep, inscricaoMunicipal).Scan(&empresaID)
	if err != nil {
		return nil, err
	}

	// Find the Trial ME plan.
	var planID uuid.UUID
	err = tx.QueryRow(ctx,
		`SELECT id FROM planos WHERE nome = 'Trial ME' AND ativo = true LIMIT 1`,
	).Scan(&planID)
	if err != nil {
		return nil, err
	}

	competencia := time.Now().UTC().Format("2006-01")
	_, err = tx.Exec(ctx, `
		INSERT INTO emissoes_mensais (empresa_id, plano_id, competencia)
		VALUES ($1, $2, $3)
	`, empresaID, planID, competencia)
	if err != nil {
		return nil, err
	}

	// API key: empresa_id set, mei_id left NULL (ME/EPP key).
	rawKey, hash, err := GenerateKey(true)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO api_keys (empresa_id, key_hash, key_prefix, label)
		VALUES ($1, $2, $3, 'default')
	`, empresaID, hash, PrefixOf(rawKey))
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &RegisterEmpresaResult{EmpresaID: empresaID, APIKey: rawKey}, nil
}

// SaveEmpresaCertARN persists the AWS Secrets Manager ARN for the empresa's A1 certificate.
func (r *Repository) SaveEmpresaCertARN(ctx context.Context, empresaID uuid.UUID, arn string) error {
	_, err := r.db.Pool().Exec(ctx, `
		UPDATE empresas
		SET cert_secret_arn = $1, updated_at = NOW()
		WHERE id = $2
	`, arn, empresaID)
	return err
}

// SaveEmpresaCertValidUntil persists the certificate expiry date on the empresa row.
// Called after a successful certificate upload/renewal so the dashboard can display
// an alert 30 days before expiry.
func (r *Repository) SaveEmpresaCertValidUntil(ctx context.Context, empresaID uuid.UUID, validUntil time.Time) error {
	_, err := r.db.Pool().Exec(ctx, `
		UPDATE empresas
		SET cert_valid_until = $1, updated_at = NOW()
		WHERE id = $2
	`, validUntil, empresaID)
	return err
}
