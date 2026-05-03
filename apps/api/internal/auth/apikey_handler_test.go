package auth_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// ── JWTMiddleware tests ─────────────────────────────────────────────────────

// fakeSupa starts an httptest server that mimics the Supabase GET /auth/v1/user
// endpoint, returning the given user ID if the correct serviceRoleKey is
// present in the apikey header.
func fakeSupa(t *testing.T, userID string, serviceRoleKey string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth/v1/user" {
			http.NotFound(w, r)
			return
		}
		if r.Header.Get("apikey") != serviceRoleKey {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if r.Header.Get("Authorization") == "" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"` + userID + `","email":"test@example.com"}`))
	}))
}

func TestJWTMiddleware_MissingHeader(t *testing.T) {
	app := fiber.New()
	app.Use(auth.JWTMiddleware("http://localhost", "secret"))
	app.Get("/test", func(c *fiber.Ctx) error { return c.SendString("ok") })

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestJWTMiddleware_ValidToken(t *testing.T) {
	userID := uuid.New().String()
	srv := fakeSupa(t, userID, "svc-role-key")
	defer srv.Close()

	app := fiber.New()
	app.Use(auth.JWTMiddleware(srv.URL, "svc-role-key"))
	app.Get("/test", func(c *fiber.Ctx) error {
		id := c.Locals("jwt_user_id").(uuid.UUID)
		return c.SendString(id.String())
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer some-valid-jwt")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestJWTMiddleware_InvalidToken(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	app := fiber.New()
	app.Use(auth.JWTMiddleware(srv.URL, "key"))
	app.Get("/test", func(c *fiber.Ctx) error { return c.SendString("ok") })

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer bad-token")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

// ── validateJWT unit test ───────────────────────────────────────────────────

func TestValidateJWT_Success(t *testing.T) {
	wantID := uuid.New()
	srv := fakeSupa(t, wantID.String(), "svc-key")
	defer srv.Close()

	// validateJWT is in the same package (auth) so accessible as auth_test via
	// the exported wrapper below.
	gotID, err := auth.ExportedValidateJWT(context.Background(), srv.URL, "svc-key", "jwt-token")
	if err != nil {
		t.Fatal(err)
	}
	if gotID != wantID {
		t.Errorf("expected %s, got %s", wantID, gotID)
	}
}

func TestValidateJWT_BadResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer srv.Close()

	_, err := auth.ExportedValidateJWT(context.Background(), srv.URL, "key", "bad")
	if err == nil {
		t.Error("expected error, got nil")
	}
}
