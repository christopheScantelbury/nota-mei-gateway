// Package recorrencia provides data access and scheduling for nota recurrence rules.
package recorrencia

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when a recorrencia does not exist or does not belong to the MEI.
var ErrNotFound = errors.New("recorrencia not found")

// Recorrencia represents a row in the nota_recorrencias table.
type Recorrencia struct {
	ID             string          `json:"id"`
	MeiID          string          `json:"mei_id"`
	Nome           string          `json:"nome"`
	Ativo          bool            `json:"ativo"`
	DiaVencimento  int             `json:"dia_vencimento"`
	Servico        json.RawMessage `json:"servico"`
	Tomador        json.RawMessage `json:"tomador"`
	WebhookURL     string          `json:"webhook_url,omitempty"`
	ProximaEmissao string          `json:"proxima_emissao"` // "YYYY-MM-DD"
	UltimaEmissao  *string         `json:"ultima_emissao,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// CreateRequest holds fields required to create a new Recorrencia.
type CreateRequest struct {
	Nome           string
	DiaVencimento  int
	Servico        json.RawMessage
	Tomador        json.RawMessage
	WebhookURL     string
	ProximaEmissao string // "YYYY-MM-DD"
}

// UpdateRequest holds fields that may be updated (nil/zero = not changed).
type UpdateRequest struct {
	Nome           *string
	Ativo          *bool
	DiaVencimento  *int
	Servico        json.RawMessage
	Tomador        json.RawMessage
	WebhookURL     *string
	ProximaEmissao *string
}

// Repository handles all DB operations for the nota_recorrencias table.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository creates a Repository.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// List returns all active recorrencias for a MEI, ordered by proxima_emissao ASC.
func (r *Repository) List(ctx context.Context, meiID string) ([]Recorrencia, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, mei_id, nome, ativo, dia_vencimento,
		       servico, tomador, webhook_url,
		       proxima_emissao, ultima_emissao,
		       created_at, updated_at
		FROM nota_recorrencias
		WHERE mei_id = $1 AND ativo = true
		ORDER BY proxima_emissao ASC
	`, meiID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Recorrencia
	for rows.Next() {
		rec, err := scanRecorrencia(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *rec)
	}
	return out, rows.Err()
}

// Get returns a single active recorrencia by ID, restricted to the given MEI.
// Returns ErrNotFound if it does not exist or belongs to a different MEI.
func (r *Repository) Get(ctx context.Context, id, meiID string) (*Recorrencia, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, mei_id, nome, ativo, dia_vencimento,
		       servico, tomador, webhook_url,
		       proxima_emissao, ultima_emissao,
		       created_at, updated_at
		FROM nota_recorrencias
		WHERE id = $1 AND mei_id = $2 AND ativo = true
	`, id, meiID)
	rec, err := scanRecorrencia(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return rec, nil
}

// Create inserts a new recorrencia and returns it.
func (r *Repository) Create(ctx context.Context, meiID string, req CreateRequest) (*Recorrencia, error) {
	var id string
	webhookVal := nullableString(req.WebhookURL)
	err := r.pool.QueryRow(ctx, `
		INSERT INTO nota_recorrencias
		  (mei_id, nome, dia_vencimento, servico, tomador, webhook_url, proxima_emissao)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, meiID, req.Nome, req.DiaVencimento,
		[]byte(req.Servico), []byte(req.Tomador),
		webhookVal, req.ProximaEmissao,
	).Scan(&id)
	if err != nil {
		return nil, err
	}
	return r.Get(ctx, id, meiID)
}

// Update modifies an existing active recorrencia.
// Only fields with non-nil values are changed.
// Returns ErrNotFound if the record does not exist or belongs to another MEI.
func (r *Repository) Update(ctx context.Context, id, meiID string, req UpdateRequest) (*Recorrencia, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE nota_recorrencias
		SET
		  nome            = COALESCE($3, nome),
		  ativo           = COALESCE($4, ativo),
		  dia_vencimento  = COALESCE($5, dia_vencimento),
		  servico         = COALESCE($6, servico),
		  tomador         = COALESCE($7, tomador),
		  webhook_url     = CASE WHEN $8::text IS NOT NULL THEN $8 ELSE webhook_url END,
		  proxima_emissao = COALESCE($9::date, proxima_emissao),
		  updated_at      = NOW()
		WHERE id = $1 AND mei_id = $2 AND ativo = true
	`,
		id, meiID,
		req.Nome,
		req.Ativo,
		req.DiaVencimento,
		rawBytes(req.Servico),
		rawBytes(req.Tomador),
		req.WebhookURL,
		req.ProximaEmissao,
	)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return r.Get(ctx, id, meiID)
}

// Delete soft-deletes a recorrencia (sets ativo=false).
// Returns ErrNotFound if it does not exist or belongs to another MEI.
func (r *Repository) Delete(ctx context.Context, id, meiID string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE nota_recorrencias
		SET ativo = false, updated_at = NOW()
		WHERE id = $1 AND mei_id = $2 AND ativo = true
	`, id, meiID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListDue returns all active recorrencias whose proxima_emissao <= asOf.
// Used by the scheduler to find records that need to be emitted.
func (r *Repository) ListDue(ctx context.Context, asOf time.Time) ([]Recorrencia, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, mei_id, nome, ativo, dia_vencimento,
		       servico, tomador, webhook_url,
		       proxima_emissao, ultima_emissao,
		       created_at, updated_at
		FROM nota_recorrencias
		WHERE ativo = true AND proxima_emissao <= $1
		ORDER BY proxima_emissao ASC
	`, asOf.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Recorrencia
	for rows.Next() {
		rec, err := scanRecorrencia(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *rec)
	}
	return out, rows.Err()
}

// MarkEmitted sets ultima_emissao = emittedDate and advances proxima_emissao by 1 month
// (preserving the dia_vencimento, capped at 28). Also updates updated_at.
func (r *Repository) MarkEmitted(ctx context.Context, id string, emittedDate time.Time) error {
	emittedStr := emittedDate.Format("2006-01-02")
	_, err := r.pool.Exec(ctx, `
		UPDATE nota_recorrencias
		SET
		  ultima_emissao  = $2::date,
		  proxima_emissao = (
		    -- Advance by exactly 1 month; use dia_vencimento as the day,
		    -- but never exceed the last day of that month (capped at 28 by the CHECK).
		    date_trunc('month', $2::date + INTERVAL '1 month')
		    + (dia_vencimento - 1) * INTERVAL '1 day'
		  )::date,
		  updated_at = NOW()
		WHERE id = $1
	`, id, emittedStr)
	return err
}

// ─── scanner helpers ─────────────────────────────────────────────────────────

type rowScanner interface {
	Scan(dest ...any) error
}

func scanRecorrencia(row rowScanner) (*Recorrencia, error) {
	var rec Recorrencia
	var servico, tomador []byte
	var webhookURL *string
	var proximaEmissao time.Time
	var ultimaEmissao *time.Time

	err := row.Scan(
		&rec.ID, &rec.MeiID, &rec.Nome, &rec.Ativo, &rec.DiaVencimento,
		&servico, &tomador, &webhookURL,
		&proximaEmissao, &ultimaEmissao,
		&rec.CreatedAt, &rec.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	rec.Servico = json.RawMessage(servico)
	rec.Tomador = json.RawMessage(tomador)
	if webhookURL != nil {
		rec.WebhookURL = *webhookURL
	}
	rec.ProximaEmissao = proximaEmissao.Format("2006-01-02")
	if ultimaEmissao != nil {
		s := ultimaEmissao.Format("2006-01-02")
		rec.UltimaEmissao = &s
	}
	return &rec, nil
}

func rawBytes(raw json.RawMessage) interface{} {
	if len(raw) == 0 {
		return nil
	}
	return []byte(raw)
}

func nullableString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
