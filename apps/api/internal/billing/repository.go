// Package billing implements the BillingGuard that enforces monthly emission limits.
package billing

import (
	"context"
	"fmt"
	"strings"

	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/supabase"
	"github.com/google/uuid"
)

// Plano holds the billing plan data for a MEI or ME/EPP empresa.
type Plano struct {
	ID               uuid.UUID
	Nome             string
	TipoEmpresa      *string // nil = legado MEI
	EmissoesLimite   int
	PrecMensalBRL    float64
	PrecExcedenteBRL float64
	StripePriceID    *string
}

// EmpresaBillingInfo holds the minimum empresa data needed by BillingGuard.Check.
type EmpresaBillingInfo struct {
	TrialMe bool
	Tipo    string // "MEI" | "ME" | "EPP"
}

// EmissaoMensal holds the MEI's monthly emission record.
type EmissaoMensal struct {
	ID              uuid.UUID
	MeiID           uuid.UUID
	PlanoID         *uuid.UUID
	PlanoNome       string // populated via LEFT JOIN planos — usado pra detectar trial
	Competencia     string
	TotalEmitidas   int
	StripeSubID     *string
	StripeSubStatus *string
	StripeSubItemID *string // metered billing item for overage reporting
}

// IsTrialPlanName retorna true quando o plano é o trial gratuito (MEI/ME/EPP).
// Em trial, QUALQUER tentativa de emissão consome cota — autorizada, rejeitada
// ou cancelada — pra evitar abuso de "tenta várias vezes ajustando o payload".
// Em planos pagos só nota AUTORIZADA conta.
func IsTrialPlanName(name string) bool {
	n := strings.ToLower(strings.TrimSpace(name))
	return n == "" || strings.HasPrefix(n, "trial")
}

// Repository handles billing-related database operations.
type Repository struct {
	db *supabase.Client
}

// NewRepository creates a billing Repository.
func NewRepository(db *supabase.Client) *Repository {
	return &Repository{db: db}
}

// GetOrCreateEmissaoMensal returns the MEI's emissao_mensal row for the current
// month, creating it if it does not exist.
//
// Uses a single atomic INSERT … ON CONFLICT DO UPDATE … RETURNING to avoid a
// separate SELECT round-trip and to remain safe under concurrent callers
// (SCALE-01). The DO UPDATE touches no meaningful columns — it just forces
// Postgres to return the existing row via RETURNING.
//
// Important: migration 20260615_billing_me dropped the legacy
// emissoes_mensais_mei_id_competencia_key constraint as part of the move to
// the unified empresas model. The ON CONFLICT now targets the surviving
// uq_emissoes_empresa_competencia (empresa_id, competencia). For MEI accounts
// empresa_id == mei_id by registration invariant, so we write both columns and
// the conflict target still uniquely identifies the row.
func (r *Repository) GetOrCreateEmissaoMensal(ctx context.Context, meiID uuid.UUID) (*EmissaoMensal, error) {
	row := r.db.Pool().QueryRow(ctx, `
		WITH upserted AS (
			INSERT INTO emissoes_mensais (mei_id, empresa_id, competencia, total_emitidas)
			VALUES ($1, $1, to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM'), 0)
			ON CONFLICT (empresa_id, competencia) DO UPDATE
			    SET empresa_id = EXCLUDED.empresa_id   -- no-op; forces RETURNING to fire
			RETURNING id, mei_id, plano_id, competencia, total_emitidas,
			          stripe_subscription_id, stripe_subscription_status,
			          stripe_subscription_item_id
		)
		SELECT u.id, u.mei_id, u.plano_id, COALESCE(p.nome, '') AS plano_nome,
		       u.competencia, u.total_emitidas,
		       u.stripe_subscription_id, u.stripe_subscription_status,
		       u.stripe_subscription_item_id
		FROM upserted u
		LEFT JOIN planos p ON p.id = u.plano_id
	`, meiID)

	var em EmissaoMensal
	if err := row.Scan(
		&em.ID, &em.MeiID, &em.PlanoID, &em.PlanoNome,
		&em.Competencia, &em.TotalEmitidas,
		&em.StripeSubID, &em.StripeSubStatus, &em.StripeSubItemID,
	); err != nil {
		return nil, err
	}
	return &em, nil
}

// GetOrCreateEmissaoMensalEmpresa is the ME/EPP equivalent of GetOrCreateEmissaoMensal.
// Uses empresa_id instead of mei_id to match the empresas table.
func (r *Repository) GetOrCreateEmissaoMensalEmpresa(ctx context.Context, empresaID uuid.UUID) (*EmissaoMensal, error) {
	row := r.db.Pool().QueryRow(ctx, `
		WITH upserted AS (
			INSERT INTO emissoes_mensais (empresa_id, competencia, total_emitidas)
			VALUES ($1, to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM'), 0)
			ON CONFLICT (empresa_id, competencia) DO UPDATE
			    SET empresa_id = EXCLUDED.empresa_id  -- no-op; forces RETURNING to fire
			RETURNING id, empresa_id, plano_id, competencia, total_emitidas,
			          stripe_subscription_id, stripe_subscription_status,
			          stripe_subscription_item_id
		)
		SELECT u.id, u.empresa_id, u.plano_id, COALESCE(p.nome, '') AS plano_nome,
		       u.competencia, u.total_emitidas,
		       u.stripe_subscription_id, u.stripe_subscription_status,
		       u.stripe_subscription_item_id
		FROM upserted u
		LEFT JOIN planos p ON p.id = u.plano_id
	`, empresaID)

	var em EmissaoMensal
	if err := row.Scan(
		&em.ID, &em.MeiID, &em.PlanoID, &em.PlanoNome,
		&em.Competencia, &em.TotalEmitidas,
		&em.StripeSubID, &em.StripeSubStatus, &em.StripeSubItemID,
	); err != nil {
		return nil, err
	}
	return &em, nil
}

// RenewMonth creates emissoes_mensais rows for all MEIs for the given competencia,
// carrying each MEI's most recent plan forward. Returns the number of new rows inserted.
//
// Same constraint note as GetOrCreateEmissaoMensal: ON CONFLICT must target the
// surviving (empresa_id, competencia) unique constraint. empresa_id is populated
// from meis.id since for MEIs the two UUIDs are identical.
func (r *Repository) RenewMonth(ctx context.Context, competencia string) (int, error) {
	tag, err := r.db.Pool().Exec(ctx, `
		INSERT INTO emissoes_mensais (mei_id, empresa_id, plano_id, competencia, total_emitidas)
		SELECT
			m.id,
			m.id,
			(
				SELECT plano_id
				FROM emissoes_mensais
				WHERE mei_id = m.id
				ORDER BY competencia DESC
				LIMIT 1
			),
			$1,
			0
		FROM meis m
		ON CONFLICT (empresa_id, competencia) DO NOTHING
	`, competencia)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
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

// IncrementEmitidasEmpresa atomically increments the ME/EPP monthly emission counter.
// Uses empresa_id column (guaranteed NOT NULL for all rows after ARCH-03).
func (r *Repository) IncrementEmitidasEmpresa(ctx context.Context, empresaID uuid.UUID) (int, error) {
	row := r.db.Pool().QueryRow(ctx, `
		UPDATE emissoes_mensais
		SET total_emitidas = total_emitidas + 1
		WHERE empresa_id = $1
		  AND competencia = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
		RETURNING total_emitidas
	`, empresaID)

	var total int
	if err := row.Scan(&total); err != nil {
		return 0, err
	}
	return total, nil
}

// GetEmpresaBillingInfo returns the trial status and tipo for a given empresa.
// Called by BillingGuard.Check to determine whether the trial bypass applies.
func (r *Repository) GetEmpresaBillingInfo(ctx context.Context, empresaID uuid.UUID) (*EmpresaBillingInfo, error) {
	var info EmpresaBillingInfo
	err := r.db.Pool().QueryRow(ctx,
		`SELECT trial_me, tipo FROM empresas WHERE id = $1`,
		empresaID,
	).Scan(&info.TrialMe, &info.Tipo)
	if err != nil {
		return nil, fmt.Errorf("GetEmpresaBillingInfo: %w", err)
	}
	return &info, nil
}

// GetPlano returns the active plan for a given plan ID.
// If planoID is nil, falls back to the Trial plan for the given tipoEmpresa
// (e.g. "Trial ME" for tipo="ME").
func (r *Repository) GetPlano(ctx context.Context, planoID *uuid.UUID, tipoEmpresa string) (*Plano, error) {
	var p Plano
	var err error

	if planoID != nil {
		err = r.db.Pool().QueryRow(ctx, `
			SELECT id, nome, tipo_empresa, emissoes_limite,
			       COALESCE(preco_mensal_brl, 0),
			       COALESCE(preco_excedente_brl, 0),
			       stripe_price_id
			FROM planos
			WHERE id = $1 AND ativo = true
		`, *planoID).Scan(
			&p.ID, &p.Nome, &p.TipoEmpresa, &p.EmissoesLimite,
			&p.PrecMensalBRL, &p.PrecExcedenteBRL, &p.StripePriceID,
		)
	} else {
		// Fallback: buscar plano Trial do tipo da empresa
		err = r.db.Pool().QueryRow(ctx, `
			SELECT id, nome, tipo_empresa, emissoes_limite,
			       COALESCE(preco_mensal_brl, 0),
			       COALESCE(preco_excedente_brl, 0),
			       stripe_price_id
			FROM planos
			WHERE ativo = true
			  AND (tipo_empresa = $1 OR tipo_empresa = 'ALL')
			  AND nome ILIKE 'Trial%'
			ORDER BY emissoes_limite DESC
			LIMIT 1
		`, tipoEmpresa).Scan(
			&p.ID, &p.Nome, &p.TipoEmpresa, &p.EmissoesLimite,
			&p.PrecMensalBRL, &p.PrecExcedenteBRL, &p.StripePriceID,
		)
	}
	if err != nil {
		return nil, fmt.Errorf("GetPlano(tipo=%s): %w", tipoEmpresa, err)
	}
	return &p, nil
}
