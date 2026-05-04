// Package template provides data access for nota_templates.
package template

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when a template does not exist or does not belong to the MEI.
var ErrNotFound = errors.New("template not found")

// Template represents a row in the nota_templates table.
type Template struct {
	ID         string          `json:"id"`
	MeiID      string          `json:"mei_id"`
	Nome       string          `json:"nome"`
	Descricao  *string         `json:"descricao,omitempty"`
	Servico    json.RawMessage `json:"servico"`
	Tomador    json.RawMessage `json:"tomador,omitempty"`
	WebhookURL *string         `json:"webhook_url,omitempty"`
	Ativo      bool            `json:"ativo"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

// CreateParams holds the fields required to create a new template.
type CreateParams struct {
	Nome       string
	Descricao  *string
	Servico    json.RawMessage
	Tomador    json.RawMessage
	WebhookURL *string
}

// UpdateParams holds the fields that may be updated on a template.
// Only non-nil fields are applied.
type UpdateParams struct {
	Nome       *string
	Descricao  *string
	Servico    json.RawMessage
	Tomador    json.RawMessage
	WebhookURL *string
}

// Repository handles all DB operations for the nota_templates table.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository creates a Repository.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// List returns active templates for a MEI, ordered by created_at DESC.
func (r *Repository) List(ctx context.Context, meiID string) ([]Template, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, mei_id, nome, descricao, servico, tomador, webhook_url, ativo, created_at, updated_at
		FROM nota_templates
		WHERE mei_id = $1 AND ativo = true
		ORDER BY created_at DESC
	`, meiID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Template
	for rows.Next() {
		t, err := scanTemplate(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *t)
	}
	return out, rows.Err()
}

// Get returns a single active template by ID, restricted to the given MEI.
// Returns ErrNotFound if the template does not exist or belongs to a different MEI.
func (r *Repository) Get(ctx context.Context, id, meiID string) (*Template, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, mei_id, nome, descricao, servico, tomador, webhook_url, ativo, created_at, updated_at
		FROM nota_templates
		WHERE id = $1 AND mei_id = $2 AND ativo = true
	`, id, meiID)
	t, err := scanTemplate(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return t, nil
}

// Create inserts a new template and returns it.
func (r *Repository) Create(ctx context.Context, meiID string, p CreateParams) (*Template, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO nota_templates (mei_id, nome, descricao, servico, tomador, webhook_url)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, meiID, p.Nome, p.Descricao, []byte(p.Servico), tomadorBytes(p.Tomador), p.WebhookURL).Scan(&id)
	if err != nil {
		return nil, err
	}
	return r.Get(ctx, id, meiID)
}

// Update modifies an existing template and returns the updated record.
// Returns ErrNotFound if the template does not exist or belongs to a different MEI.
func (r *Repository) Update(ctx context.Context, id, meiID string, p UpdateParams) (*Template, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE nota_templates
		SET nome        = COALESCE($3, nome),
		    descricao   = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE descricao END,
		    servico     = COALESCE($5, servico),
		    tomador     = COALESCE($6, tomador),
		    webhook_url = CASE WHEN $7::text IS NOT NULL THEN $7 ELSE webhook_url END,
		    updated_at  = NOW()
		WHERE id = $1 AND mei_id = $2 AND ativo = true
	`, id, meiID, p.Nome, p.Descricao, servicopBytes(p.Servico), tomadorBytes(p.Tomador), p.WebhookURL)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return r.Get(ctx, id, meiID)
}

// Delete soft-deletes a template by setting ativo=false.
// Returns ErrNotFound if the template does not exist or belongs to a different MEI.
func (r *Repository) Delete(ctx context.Context, id, meiID string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE nota_templates
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

// ─── scanner helpers ────────────────────────────────────────────────────────

type rowScanner interface {
	Scan(dest ...any) error
}

func scanTemplate(row rowScanner) (*Template, error) {
	var t Template
	var servico, tomador []byte
	err := row.Scan(
		&t.ID, &t.MeiID, &t.Nome, &t.Descricao,
		&servico, &tomador,
		&t.WebhookURL, &t.Ativo,
		&t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	t.Servico = json.RawMessage(servico)
	if tomador != nil {
		t.Tomador = json.RawMessage(tomador)
	}
	return &t, nil
}

func tomadorBytes(raw json.RawMessage) interface{} {
	if len(raw) == 0 {
		return nil
	}
	return []byte(raw)
}

func servicopBytes(raw json.RawMessage) interface{} {
	if len(raw) == 0 {
		return nil
	}
	return []byte(raw)
}
