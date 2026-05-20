package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// AuthAdminClient calls the Supabase Auth Admin REST API to manage auth.users
// rows from the backend. It uses the service role key (admin privileges) and
// must never be exposed to the browser.
//
// Why this exists: migration 20260620 added empresas.user_id NOT NULL
// REFERENCES auth.users(id). The public registration endpoint /v1/auth/register
// no longer accepts data without first provisioning an auth.users row.
type AuthAdminClient struct {
	projectURL     string // e.g. "https://abc.supabase.co"
	serviceRoleKey string
	http           *http.Client
}

// NewAuthAdminClient returns a client targeting the given Supabase project.
// projectURL must NOT include a trailing slash. timeout applies to each call.
func NewAuthAdminClient(projectURL, serviceRoleKey string, timeout time.Duration) *AuthAdminClient {
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	return &AuthAdminClient{
		projectURL:     projectURL,
		serviceRoleKey: serviceRoleKey,
		http:           &http.Client{Timeout: timeout},
	}
}

// CreateUserParams holds the data needed to provision a new auth.users row.
type CreateUserParams struct {
	Email        string                 // required
	UserMetadata map[string]interface{} // optional — stored in raw_user_meta_data
	EmailConfirm bool                   // when true, skips the magic-link confirm step
}

// CreateUser provisions a new auth.users row and returns its UUID.
// The user has no password — login flows must use magic-link or OAuth.
// Returns ErrUserExists if a row with the same email already exists.
func (c *AuthAdminClient) CreateUser(ctx context.Context, p CreateUserParams) (uuid.UUID, error) {
	if c.projectURL == "" || c.serviceRoleKey == "" {
		return uuid.Nil, errors.New("supabase auth admin: not configured")
	}
	if p.Email == "" {
		return uuid.Nil, errors.New("supabase auth admin: email required")
	}

	body, err := json.Marshal(map[string]interface{}{
		"email":         p.Email,
		"email_confirm": p.EmailConfirm,
		"user_metadata": p.UserMetadata,
	})
	if err != nil {
		return uuid.Nil, fmt.Errorf("marshal: %w", err)
	}

	url := c.projectURL + "/auth/v1/admin/users"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return uuid.Nil, fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", c.serviceRoleKey)
	req.Header.Set("Authorization", "Bearer "+c.serviceRoleKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return uuid.Nil, fmt.Errorf("http do: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))

	if resp.StatusCode == http.StatusUnprocessableEntity ||
		(resp.StatusCode == http.StatusBadRequest && bytes.Contains(respBody, []byte("already"))) {
		return uuid.Nil, ErrUserExists
	}
	if resp.StatusCode >= 400 {
		return uuid.Nil, fmt.Errorf("supabase auth admin: HTTP %d: %.500s", resp.StatusCode, respBody)
	}

	var parsed struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return uuid.Nil, fmt.Errorf("parse response: %w", err)
	}
	if parsed.ID == "" {
		return uuid.Nil, fmt.Errorf("supabase auth admin: empty user id in response: %.200s", respBody)
	}
	id, err := uuid.Parse(parsed.ID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("parse user id: %w", err)
	}
	return id, nil
}

// DeleteUser removes an auth.users row. Used to roll back a partially-completed
// registration when the subsequent DB transaction fails.
func (c *AuthAdminClient) DeleteUser(ctx context.Context, id uuid.UUID) error {
	if c.projectURL == "" || c.serviceRoleKey == "" {
		return errors.New("supabase auth admin: not configured")
	}
	url := c.projectURL + "/auth/v1/admin/users/" + id.String()
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("apikey", c.serviceRoleKey)
	req.Header.Set("Authorization", "Bearer "+c.serviceRoleKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("http do: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode >= 400 && resp.StatusCode != http.StatusNotFound {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4*1024))
		return fmt.Errorf("supabase auth admin delete: HTTP %d: %.500s", resp.StatusCode, body)
	}
	return nil
}

// ErrUserExists is returned by CreateUser when an auth.users row with the same
// email already exists. Callers should map this to a 409 CONFLICT response.
var ErrUserExists = errors.New("supabase auth admin: user already exists")
