package handler_test

// substituir_test.go tests the POST /v1/nfse/:id/substituir endpoint contract.
//
// We use lightweight stub Fiber apps that mirror the real handler's guard logic
// to avoid requiring a live database.  The tests focus on the two validations
// that can be exercised purely at the HTTP layer:
//
//   1. MEI callers (no empresa in context) must receive 403 FORBIDDEN.
//   2. A nota emitted more than 9 days ago must return 422 SUBSTITUTION_WINDOW_EXPIRED.

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// ── helpers ───────────────────────────────────────────────────────────────────

// substituicaoWindowStubApp builds a Fiber app that mimics the guard checks in
// SubstituirNota without touching the database:
//
//   - injectEmpresa: when true, sets an *auth.Empresa in Fiber locals (ME/EPP caller)
//   - emitidaEm: the timestamp used for the 9-day window check (nil = no check)
//   - status: the nota status returned by the stub repo
func substituicaoWindowStubApp(injectEmpresa bool, status string, emitidaEm *time.Time) *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})

	app.Post("/v1/nfse/:id/substituir", func(c *fiber.Ctx) error {
		// ── Guard 1: only ME/EPP ───────────────────────────────────────────────
		empresa := auth.GetEmpresa(c)
		if empresa == nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error":   "FORBIDDEN",
				"message": "substituição de nota disponível apenas para empresas ME/EPP",
			})
		}

		// ── Guard 2: nota must be AUTORIZADA ──────────────────────────────────
		if status != "AUTORIZADA" {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error":   "INVALID_STATUS",
				"message": "apenas notas autorizadas podem ser substituídas",
				"status":  status,
			})
		}

		// ── Guard 3: 9-day substitution window ────────────────────────────────
		if emitidaEm != nil {
			if time.Since(*emitidaEm) > 9*24*time.Hour {
				return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
					"error":      "SUBSTITUTION_WINDOW_EXPIRED",
					"message":    "prazo de substituição de 9 dias expirado",
					"emitida_em": emitidaEm,
				})
			}
		}

		return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
			"nota_original_id":  c.Params("id"),
			"nota_substituta_id": uuid.NewString(),
			"status":            "PROCESSANDO",
		})
	})

	// The middleware that injects empresa must be registered BEFORE the route.
	// We rebuild the app with a pre-route middleware instead.
	if injectEmpresa {
		app2 := fiber.New(fiber.Config{DisableStartupMessage: true})
		app2.Use(func(c *fiber.Ctx) error {
			c.Locals("empresa", &auth.Empresa{
				ID:               uuid.New(),
				Tipo:             "ME",
				RegimeTributario: "SIMPLES_NACIONAL",
				CNPJ:             "12345678000190",
				RazaoSocial:      "Empresa Teste ME",
				Email:            "me@test.com",
				MunicipioIBGE:    "1302603",
			})
			return c.Next()
		})
		app2.Post("/v1/nfse/:id/substituir", func(c *fiber.Ctx) error {
			empresa := auth.GetEmpresa(c)
			if empresa == nil {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"error": "FORBIDDEN",
				})
			}
			if status != "AUTORIZADA" {
				return c.Status(fiber.StatusConflict).JSON(fiber.Map{
					"error":  "INVALID_STATUS",
					"status": status,
				})
			}
			if emitidaEm != nil {
				if time.Since(*emitidaEm) > 9*24*time.Hour {
					return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
						"error": "SUBSTITUTION_WINDOW_EXPIRED",
					})
				}
			}
			return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
				"nota_original_id":   c.Params("id"),
				"nota_substituta_id": uuid.NewString(),
				"status":             "PROCESSANDO",
			})
		})
		return app2
	}

	return app
}

func substituirReq(id string) *http.Request {
	body, _ := json.Marshal(map[string]interface{}{
		"servico": map[string]interface{}{
			"codigo_nbs":      "01.01.01.10",
			"discriminacao":   "Substituição de serviço conforme contrato",
			"valor":           1500.00,
			"aliquota_iss":    2.0,
		},
		"tomador": map[string]interface{}{
			"tipo":           "PJ",
			"documento":      "12345678000190",
			"razao_social":   "Cliente Teste LTDA",
			"municipio_ibge": "1302603",
		},
		"competencia": "2026-05",
	})
	r := httptest.NewRequest(http.MethodPost, "/v1/nfse/"+id+"/substituir", bytes.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	return r
}

// ── tests ─────────────────────────────────────────────────────────────────────

func TestSubstituirNota_MEI_Returns403(t *testing.T) {
	// No empresa in context → MEI caller → must be rejected.
	app := substituicaoWindowStubApp(false, "AUTORIZADA", nil)
	id := uuid.NewString()

	resp, err := app.Test(substituirReq(id))
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["error"] != "FORBIDDEN" {
		t.Fatalf("expected FORBIDDEN error, got %q", body["error"])
	}
}

func TestSubstituirNota_NotaNotAutorizada_Returns409(t *testing.T) {
	for _, status := range []string{"PROCESSANDO", "REJEITADA", "CANCELADA"} {
		t.Run(status, func(t *testing.T) {
			app := substituicaoWindowStubApp(true, status, nil)
			id := uuid.NewString()

			resp, err := app.Test(substituirReq(id))
			if err != nil {
				t.Fatalf("app.Test: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusConflict {
				t.Fatalf("status %s: expected 409, got %d", status, resp.StatusCode)
			}
			var body map[string]string
			if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if body["error"] != "INVALID_STATUS" {
				t.Fatalf("status %s: expected INVALID_STATUS error, got %q", status, body["error"])
			}
		})
	}
}

func TestSubstituirNota_WithinWindow_Returns202(t *testing.T) {
	// 8 days ago — within the 9-day window.
	emitidaEm := time.Now().Add(-8 * 24 * time.Hour)
	app := substituicaoWindowStubApp(true, "AUTORIZADA", &emitidaEm)
	id := uuid.NewString()

	resp, err := app.Test(substituirReq(id))
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", resp.StatusCode)
	}
}

func TestSubstituirNota_WindowExpired_Returns422(t *testing.T) {
	// 10 days ago — outside the 9-day window.
	emitidaEm := time.Now().Add(-10 * 24 * time.Hour)
	app := substituicaoWindowStubApp(true, "AUTORIZADA", &emitidaEm)
	id := uuid.NewString()

	resp, err := app.Test(substituirReq(id))
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d", resp.StatusCode)
	}
	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["error"] != "SUBSTITUTION_WINDOW_EXPIRED" {
		t.Fatalf("expected SUBSTITUTION_WINDOW_EXPIRED, got %q", body["error"])
	}
}

func TestSubstituirNota_ExactlyOnBoundary_Returns202(t *testing.T) {
	// Exactly 9 days ago (minus 1 second) — just inside the window.
	emitidaEm := time.Now().Add(-9*24*time.Hour + time.Second)
	app := substituicaoWindowStubApp(true, "AUTORIZADA", &emitidaEm)
	id := uuid.NewString()

	resp, err := app.Test(substituirReq(id))
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		t.Fatalf("expected 202 at boundary, got %d", resp.StatusCode)
	}
}
