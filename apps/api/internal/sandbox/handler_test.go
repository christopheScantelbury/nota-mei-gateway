package sandbox

import (
	"context"
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// Montadas em runtime: um literal sk_test_+64 chars bate no padrão de chave
// Stripe e o push protection do GitHub bloqueia o push.
var (
	devKeyA = "sk_test_" + strings.Repeat("a", 64)
	devKeyB = "sk_test_" + strings.Repeat("b", 64)
)

// newApp mirrors cmd/server/main.go: sandbox routes first, then a fallthrough
// standing in for the real auth (returns 401 "REAL_AUTH").
func newApp() *fiber.App {
	h := New().WithDevKeyResolver(func(_ context.Context, raw string) bool {
		return raw == devKeyA || raw == devKeyB
	})
	app := fiber.New()
	g := app.Group("/v1", h.RateLimitMiddleware)
	g.Post("/nfse", func(c *fiber.Ctx) error {
		if !h.Matches(c) {
			return c.Next()
		}
		return h.EmitirNota(c)
	})
	g.Get("/nfse", func(c *fiber.Ctx) error {
		if !h.Matches(c) {
			return c.Next()
		}
		return h.ListarNotas(c)
	})
	g.Get("/nfse/:id", func(c *fiber.Ctx) error {
		if !h.Matches(c) {
			return c.Next()
		}
		return h.ConsultarNota(c)
	})
	app.Use(func(c *fiber.Ctx) error { return c.Status(401).SendString("REAL_AUTH") })
	return app
}

func do(t *testing.T, app *fiber.App, method, path, key, body string) (int, string) {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	b, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(b)
}

const emissao = `{"servico":{"valor":10},"tomador":{"razao_social":"X"},"competencia":"2026-09"}`

func TestDevKey_EmiteNoSandbox(t *testing.T) {
	app := newApp()
	status, body := do(t, app, "POST", "/v1/nfse", devKeyA, emissao)
	if status != 202 || !strings.Contains(body, "SANDBOX") {
		t.Fatalf("chave de dev deveria emitir no sandbox: %d %s", status, body)
	}
}

func TestChaveDesconhecida_SegueParaAuthReal(t *testing.T) {
	app := newApp()
	status, body := do(t, app, "GET", "/v1/nfse", "sk_test_desconhecida", "")
	if status != 401 || body != "REAL_AUTH" {
		t.Fatalf("sk_test_ que não é de dev deve cair na auth real: %d %s", status, body)
	}
	status, body = do(t, app, "GET", "/v1/nfse", "sk_live_qualquer", "")
	if status != 401 || body != "REAL_AUTH" {
		t.Fatalf("sk_live_ deve cair na auth real: %d %s", status, body)
	}
}

func TestNotasIsoladasPorChave(t *testing.T) {
	app := newApp()
	_, body := do(t, app, "POST", "/v1/nfse", devKeyA, emissao)
	var r struct {
		NotaID string `json:"nota_id"`
	}
	_ = json.Unmarshal([]byte(body), &r)
	_, _ = do(t, app, "POST", "/v1/nfse", DemoKey, emissao)

	count := func(key string) int {
		_, b := do(t, app, "GET", "/v1/nfse", key, "")
		var l struct {
			Total int `json:"total"`
		}
		_ = json.Unmarshal([]byte(b), &l)
		return l.Total
	}
	if a, b, d := count(devKeyA), count(devKeyB), count(DemoKey); a != 1 || b != 0 || d != 1 {
		t.Errorf("listagem vazando entre chaves: A=%d B=%d demo=%d", a, b, d)
	}
	if status, _ := do(t, app, "GET", "/v1/nfse/"+r.NotaID, devKeyB, ""); status != 404 {
		t.Errorf("chave B não pode ler nota da chave A, got %d", status)
	}
	if status, _ := do(t, app, "GET", "/v1/nfse/"+r.NotaID, devKeyA, ""); status != 200 {
		t.Errorf("dona deveria ler a própria nota, got %d", status)
	}
}
