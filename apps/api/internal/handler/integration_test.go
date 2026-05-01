package handler_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// newTestApp builds a minimal Fiber app that mirrors the real server
// but only wires up the endpoints testable without external services.
func newTestApp() *fiber.App {
	app := fiber.New(fiber.Config{
		// Suppress stack traces in test output.
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"error": err.Error()})
		},
	})

	// Health check (no external deps).
	app.Get("/v1/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "env": "test"})
	})

	// Stub auth middleware — rejects requests without a Bearer token.
	authMiddleware := func(c *fiber.Ctx) error {
		token := c.Get("Authorization")
		if !strings.HasPrefix(token, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "INVALID_API_KEY",
				"message": "Authorization header missing or malformed",
			})
		}
		return c.Next()
	}

	v1 := app.Group("/v1", authMiddleware)

	// Stub NFS-e endpoint — validates request body shape only.
	v1.Post("/nfse", func(c *fiber.Ctx) error {
		var body map[string]interface{}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"error":   "VALIDATION_ERROR",
				"message": "corpo da requisição inválido",
			})
		}
		// Check required top-level fields.
		for _, field := range []string{"servico", "tomador", "competencia"} {
			if body[field] == nil {
				return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
					"error":   "VALIDATION_ERROR",
					"message": "campo obrigatório ausente: " + field,
				})
			}
		}
		return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
			"nota_id": "test-uuid",
			"status":  "PROCESSANDO",
		})
	})

	return app
}

// mustTest executes a Fiber test request and registers Body.Close via t.Cleanup.
func mustTest(t *testing.T, app *fiber.App, req *http.Request) *http.Response {
	t.Helper()
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	t.Cleanup(func() { _ = resp.Body.Close() })
	return resp
}

// ─── Health ────────────────────────────────────────────────────────────────

func TestHealthEndpoint_OK(t *testing.T) {
	app := newTestApp()
	req := httptest.NewRequest(http.MethodGet, "/v1/health", nil)
	resp := mustTest(t, app, req)

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(body), `"status":"ok"`) {
		t.Errorf("body does not contain status ok: %s", body)
	}
}

// ─── Auth middleware ───────────────────────────────────────────────────────

func TestAuthMiddleware_MissingBearer(t *testing.T) {
	app := newTestApp()
	req := httptest.NewRequest(http.MethodPost, "/v1/nfse", nil)
	resp := mustTest(t, app, req)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}

func TestAuthMiddleware_MalformedBearer(t *testing.T) {
	app := newTestApp()
	req := httptest.NewRequest(http.MethodPost, "/v1/nfse", nil)
	req.Header.Set("Authorization", "Token abc123") // not "Bearer"
	resp := mustTest(t, app, req)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}

func TestAuthMiddleware_ValidBearer(t *testing.T) {
	app := newTestApp()
	body := strings.NewReader(`{"servico":{},"tomador":{},"competencia":"2026-04"}`)
	req := httptest.NewRequest(http.MethodPost, "/v1/nfse", body)
	req.Header.Set("Authorization", "Bearer sk_test_abc123")
	req.Header.Set("Content-Type", "application/json")
	resp := mustTest(t, app, req)
	// Should reach the handler (202) not auth block (401).
	if resp.StatusCode == http.StatusUnauthorized {
		t.Error("valid Bearer token should not be rejected by auth middleware")
	}
}

// ─── NFS-e validation ──────────────────────────────────────────────────────

func TestEmitirNota_MissingFields(t *testing.T) {
	app := newTestApp()
	cases := []struct {
		name string
		body string
	}{
		{"empty body", `{}`},
		{"missing tomador", `{"servico":{},"competencia":"2026-04"}`},
		{"missing servico", `{"tomador":{},"competencia":"2026-04"}`},
		{"missing competencia", `{"servico":{},"tomador":{}}`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/v1/nfse", strings.NewReader(c.body))
			req.Header.Set("Authorization", "Bearer sk_test_abc123")
			req.Header.Set("Content-Type", "application/json")
			resp := mustTest(t, app, req)
			if resp.StatusCode != http.StatusUnprocessableEntity {
				t.Errorf("status = %d, want 422", resp.StatusCode)
			}
		})
	}
}

func TestEmitirNota_ValidRequest_Accepted(t *testing.T) {
	app := newTestApp()
	body := `{
		"servico":{"codigo_nbs":"01.01","discriminacao":"dev","valor":1000,"aliquota_iss":2},
		"tomador":{"tipo":"PJ","documento":"12345678000190","razao_social":"Empresa"},
		"competencia":"2026-04"
	}`
	req := httptest.NewRequest(http.MethodPost, "/v1/nfse", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer sk_test_abc123")
	req.Header.Set("Content-Type", "application/json")
	resp := mustTest(t, app, req)
	if resp.StatusCode != http.StatusAccepted {
		t.Errorf("status = %d, want 202", resp.StatusCode)
	}
}

// ─── 404 ───────────────────────────────────────────────────────────────────

func TestUnknownRoute_404(t *testing.T) {
	app := newTestApp()
	// Test a path outside the /v1 group so auth middleware doesn't intercept.
	req := httptest.NewRequest(http.MethodGet, "/nonexistent", nil)
	resp := mustTest(t, app, req)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("unknown route: status = %d, want 404", resp.StatusCode)
	}
}
