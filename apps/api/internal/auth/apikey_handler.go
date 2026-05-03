package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog/log"
)

// ── Supabase JWT middleware ─────────────────────────────────────────────────

// supabaseUser is the minimal subset returned by GET /auth/v1/user.
type supabaseUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

// JWTMiddleware validates a Supabase Auth JWT by forwarding it to the
// Supabase auth API.  On success it stores the user UUID in Fiber locals
// under the key "jwt_user_id".
//
// This middleware is intentionally separate from auth.Middleware (API key
// Bearer) to avoid a circular dependency: API key CRUD uses human JWTs
// while the main product API uses machine API keys.
func JWTMiddleware(supabaseURL, serviceRoleKey string) fiber.Handler {
	client := &http.Client{Timeout: 8 * time.Second}

	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "INVALID_JWT",
				"message": "cabeçalho Authorization Bearer ausente",
			})
		}
		jwt := strings.TrimPrefix(authHeader, "Bearer ")

		req, err := http.NewRequestWithContext(c.Context(), http.MethodGet,
			supabaseURL+"/auth/v1/user", nil)
		if err != nil {
			log.Ctx(c.Context()).Error().Err(err).Msg("jwt validation: create request failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "INTERNAL_ERROR", "message": "erro interno",
			})
		}
		req.Header.Set("Authorization", "Bearer "+jwt)
		req.Header.Set("apikey", serviceRoleKey)

		resp, err := client.Do(req)
		if err != nil {
			log.Ctx(c.Context()).Error().Err(err).Msg("jwt validation: supabase request failed")
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "INVALID_JWT", "message": "token inválido ou expirado",
			})
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "INVALID_JWT", "message": "token inválido ou expirado",
			})
		}

		var user supabaseUser
		if err := json.NewDecoder(resp.Body).Decode(&user); err != nil || user.ID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "INVALID_JWT", "message": "token inválido",
			})
		}

		userID, err := uuid.Parse(user.ID)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "INVALID_JWT", "message": "user id malformado",
			})
		}

		c.Locals("jwt_user_id", userID)
		return c.Next()
	}
}

// ── APIKey handler ──────────────────────────────────────────────────────────

// APIKeyHandler handles CRUD for the authenticated MEI's API keys.
type APIKeyHandler struct {
	repo *Repository
}

// NewAPIKeyHandler creates an APIKeyHandler.
func NewAPIKeyHandler(repo *Repository) *APIKeyHandler {
	return &APIKeyHandler{repo: repo}
}

// apiKeyRow is the shape returned in list/create responses.
// The raw key is only included in CreateKey.
type apiKeyRow struct {
	ID        uuid.UUID  `json:"id"`
	KeyPrefix string     `json:"key_prefix"`
	Label     string     `json:"label"`
	CreatedAt time.Time  `json:"created_at"`
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
	// Only populated on create — shown once.
	APIKey string `json:"api_key,omitempty"`
}

// ListKeys — GET /v1/auth/api-keys
// Returns all non-revoked API keys for the authenticated MEI.
func (h *APIKeyHandler) ListKeys(c *fiber.Ctx) error {
	meiID := c.Locals("jwt_user_id").(uuid.UUID)

	rows, err := h.repo.db.Pool().Query(c.Context(), `
		SELECT id, key_prefix, COALESCE(label, ''), created_at, revoked_at
		FROM api_keys
		WHERE mei_id = $1
		ORDER BY created_at DESC
	`, meiID)
	if err != nil {
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", meiID.String()).Msg("list api keys")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "INTERNAL_ERROR", "message": "erro ao listar chaves",
		})
	}
	defer rows.Close()

	keys := make([]apiKeyRow, 0)
	for rows.Next() {
		var k apiKeyRow
		if err := rows.Scan(&k.ID, &k.KeyPrefix, &k.Label, &k.CreatedAt, &k.RevokedAt); err != nil {
			continue
		}
		keys = append(keys, k)
	}
	if err := rows.Err(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "INTERNAL_ERROR", "message": "erro ao ler chaves",
		})
	}

	return c.JSON(fiber.Map{"keys": keys, "total": len(keys)})
}

// createKeyRequest is the request body for POST /v1/auth/api-keys.
type createKeyRequest struct {
	Label string `json:"label"`
	Live  bool   `json:"live"` // true → sk_live_, false → sk_test_
}

// CreateKey — POST /v1/auth/api-keys
// Generates a new API key for the authenticated MEI.  The raw key is shown once.
func (h *APIKeyHandler) CreateKey(c *fiber.Ctx) error {
	meiID := c.Locals("jwt_user_id").(uuid.UUID)

	var req createKeyRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error": "VALIDATION_ERROR", "message": "body inválido",
		})
	}
	if strings.TrimSpace(req.Label) == "" {
		req.Label = "default"
	}

	// Enforce a reasonable per-MEI key limit.
	var count int
	if err := h.repo.db.Pool().QueryRow(c.Context(),
		`SELECT COUNT(*) FROM api_keys WHERE mei_id = $1 AND revoked_at IS NULL`,
		meiID,
	).Scan(&count); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "INTERNAL_ERROR", "message": "erro interno",
		})
	}
	if count >= 10 {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":   "KEY_LIMIT_REACHED",
			"message": "limite de 10 chaves ativas atingido — revogar uma antes de criar outra",
		})
	}

	rawKey, hash, err := GenerateKey(req.Live)
	if err != nil {
		log.Ctx(c.Context()).Error().Err(err).Msg("generate api key")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "INTERNAL_ERROR", "message": "erro ao gerar chave",
		})
	}

	var keyID uuid.UUID
	var createdAt time.Time
	if err := h.repo.db.Pool().QueryRow(c.Context(), `
		INSERT INTO api_keys (mei_id, key_hash, key_prefix, label)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at
	`, meiID, hash, PrefixOf(rawKey), req.Label).Scan(&keyID, &createdAt); err != nil {
		log.Ctx(c.Context()).Error().Err(err).Msg("insert api key")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "INTERNAL_ERROR", "message": "erro ao salvar chave",
		})
	}

	log.Ctx(c.Context()).Info().
		Str("mei_id", meiID.String()).
		Str("key_id", keyID.String()).
		Str("label", req.Label).
		Msg("api key criada")

	return c.Status(fiber.StatusCreated).JSON(apiKeyRow{
		ID:        keyID,
		KeyPrefix: PrefixOf(rawKey),
		Label:     req.Label,
		CreatedAt: createdAt,
		APIKey:    rawKey, // shown once
	})
}

// RevokeKey — DELETE /v1/auth/api-keys/:id
// Soft-deletes (revokes) the given API key.  Only the owner can revoke.
func (h *APIKeyHandler) RevokeKey(c *fiber.Ctx) error {
	meiID := c.Locals("jwt_user_id").(uuid.UUID)

	keyID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "VALIDATION_ERROR", "message": "id inválido",
		})
	}

	result, err := h.repo.db.Pool().Exec(c.Context(), `
		UPDATE api_keys
		SET revoked_at = NOW()
		WHERE id = $1
		  AND mei_id = $2
		  AND revoked_at IS NULL
	`, keyID, meiID)
	if err != nil {
		log.Ctx(c.Context()).Error().Err(err).
			Str("key_id", keyID.String()).Msg("revoke api key")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "INTERNAL_ERROR", "message": "erro ao revogar chave",
		})
	}

	if result.RowsAffected() == 0 {
		// Either not found or not owned by this MEI or already revoked.
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "NOT_FOUND",
			"message": "chave não encontrada ou já revogada",
		})
	}

	log.Ctx(c.Context()).Info().
		Str("mei_id", meiID.String()).
		Str("key_id", keyID.String()).
		Msg("api key revogada")

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// ── Repository helpers ──────────────────────────────────────────────────────

// FindMEIByUserID looks up a MEI by the Supabase auth user UUID.
// Used when the JWT-authenticated user needs to access MEI-level data.
func (r *Repository) FindMEIByUserID(ctx context.Context, userID uuid.UUID) (*MEI, error) {
	return r.FindMEI(ctx, userID) // meis.id == auth.uid() in our schema
}

// validateJWT calls the Supabase Auth API to validate a JWT and return the user UUID.
// Used by the JWTMiddleware above; exported for testing.
func validateJWT(ctx context.Context, supabaseURL, serviceRoleKey, jwt string) (uuid.UUID, error) {
	client := &http.Client{Timeout: 8 * time.Second}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		supabaseURL+"/auth/v1/user", nil)
	if err != nil {
		return uuid.Nil, err
	}
	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("apikey", serviceRoleKey)

	resp, err := client.Do(req)
	if err != nil {
		return uuid.Nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return uuid.Nil, fmt.Errorf("supabase auth returned %d", resp.StatusCode)
	}

	var user supabaseUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return uuid.Nil, err
	}

	id, err := uuid.Parse(user.ID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid user id: %w", err)
	}
	return id, nil
}

// pgx import guard — rows.Err() relies on pgx but the package is already
// imported via repository.go in the same package, so no extra import needed.
var _ = pgx.ErrNoRows // keep pgx referenced
