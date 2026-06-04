package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/handler"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/recorrencia"
	"github.com/gofiber/fiber/v2"
)

// ─── stub repo ────────────────────────────────────────────────────────────────

type stubRecorrenciaRepo struct {
	listResult   []recorrencia.Recorrencia
	listErr      error
	getResult    *recorrencia.Recorrencia
	getErr       error
	createResult *recorrencia.Recorrencia
	createErr    error
	updateResult *recorrencia.Recorrencia
	updateErr    error
	deleteErr    error
}

func (s *stubRecorrenciaRepo) List(_ context.Context, _ string) ([]recorrencia.Recorrencia, error) {
	return s.listResult, s.listErr
}

func (s *stubRecorrenciaRepo) Get(_ context.Context, _, _ string) (*recorrencia.Recorrencia, error) {
	return s.getResult, s.getErr
}

func (s *stubRecorrenciaRepo) Create(_ context.Context, _ string, _ recorrencia.CreateRequest) (*recorrencia.Recorrencia, error) {
	return s.createResult, s.createErr
}

func (s *stubRecorrenciaRepo) Update(_ context.Context, _, _ string, _ recorrencia.UpdateRequest) (*recorrencia.Recorrencia, error) {
	return s.updateResult, s.updateErr
}

func (s *stubRecorrenciaRepo) Delete(_ context.Context, _, _ string) error {
	return s.deleteErr
}

// ─── test app builder ─────────────────────────────────────────────────────────

func newRecorrenciaApp(stub *stubRecorrenciaRepo) *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	h := handler.NewRecorrenciaHandler(stub)

	// Inject the real Locals shape: middleware stores *auth.MEI, not raw string.
	authMw := func(c *fiber.Ctx) error {
		c.Locals("mei", &auth.MEI{ID: fixedMeiUUID})
		return c.Next()
	}

	v1 := app.Group("/v1", authMw)
	v1.Get("/recorrencias", h.ListRecorrencias)
	v1.Post("/recorrencias", h.CreateRecorrencia)
	v1.Get("/recorrencias/:id", h.GetRecorrencia)
	v1.Put("/recorrencias/:id", h.UpdateRecorrencia)
	v1.Delete("/recorrencias/:id", h.DeleteRecorrencia)

	return app
}

func recorrenciaReq(method, path, body string) *http.Request {
	var buf *bytes.Buffer
	if body != "" {
		buf = bytes.NewBufferString(body)
	} else {
		buf = &bytes.Buffer{}
	}
	r := httptest.NewRequest(method, path, buf)
	r.Header.Set("Content-Type", "application/json")
	return r
}

// ─── CreateRecorrencia tests ──────────────────────────────────────────────────

func TestCreateRecorrencia_MissingNome(t *testing.T) {
	stub := &stubRecorrenciaRepo{}
	app := newRecorrenciaApp(stub)

	body := `{
		"dia_vencimento":5,
		"servico":{"codigo_nbs":"01.01","valor":1000},
		"tomador":{"documento":"12345678000190"},
		"proxima_emissao":"2026-06-05"
	}`
	resp := mustTest(t, app, recorrenciaReq(http.MethodPost, "/v1/recorrencias", body)) //nolint:bodyclose

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertRecorrenciaFieldError(t, resp, "nome")
}

func TestCreateRecorrencia_DiaVencimentoOutOfRange(t *testing.T) {
	stub := &stubRecorrenciaRepo{}
	app := newRecorrenciaApp(stub)

	body := `{
		"nome":"Mensal",
		"dia_vencimento":29,
		"servico":{"codigo_nbs":"01.01","valor":1000},
		"tomador":{"documento":"12345678000190"},
		"proxima_emissao":"2026-06-29"
	}`
	resp := mustTest(t, app, recorrenciaReq(http.MethodPost, "/v1/recorrencias", body)) //nolint:bodyclose

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertRecorrenciaFieldError(t, resp, "dia_vencimento")
}

func TestCreateRecorrencia_DiaVencimentoZero(t *testing.T) {
	stub := &stubRecorrenciaRepo{}
	app := newRecorrenciaApp(stub)

	body := `{
		"nome":"Mensal",
		"dia_vencimento":0,
		"servico":{"codigo_nbs":"01.01","valor":1000},
		"tomador":{"documento":"12345678000190"},
		"proxima_emissao":"2026-06-01"
	}`
	resp := mustTest(t, app, recorrenciaReq(http.MethodPost, "/v1/recorrencias", body)) //nolint:bodyclose

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertRecorrenciaFieldError(t, resp, "dia_vencimento")
}

func TestCreateRecorrencia_MissingServico(t *testing.T) {
	stub := &stubRecorrenciaRepo{}
	app := newRecorrenciaApp(stub)

	body := `{
		"nome":"Mensal",
		"dia_vencimento":5,
		"tomador":{"documento":"12345678000190"},
		"proxima_emissao":"2026-06-05"
	}`
	resp := mustTest(t, app, recorrenciaReq(http.MethodPost, "/v1/recorrencias", body)) //nolint:bodyclose

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertRecorrenciaFieldError(t, resp, "servico")
}

func TestCreateRecorrencia_MissingTomador(t *testing.T) {
	stub := &stubRecorrenciaRepo{}
	app := newRecorrenciaApp(stub)

	body := `{
		"nome":"Mensal",
		"dia_vencimento":5,
		"servico":{"codigo_nbs":"01.01","valor":1000},
		"proxima_emissao":"2026-06-05"
	}`
	resp := mustTest(t, app, recorrenciaReq(http.MethodPost, "/v1/recorrencias", body)) //nolint:bodyclose

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertRecorrenciaFieldError(t, resp, "tomador")
}

func TestCreateRecorrencia_InvalidProximaEmissao(t *testing.T) {
	stub := &stubRecorrenciaRepo{}
	app := newRecorrenciaApp(stub)

	body := `{
		"nome":"Mensal",
		"dia_vencimento":5,
		"servico":{"codigo_nbs":"01.01","valor":1000},
		"tomador":{"documento":"12345678000190"},
		"proxima_emissao":"not-a-date"
	}`
	resp := mustTest(t, app, recorrenciaReq(http.MethodPost, "/v1/recorrencias", body)) //nolint:bodyclose

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertRecorrenciaFieldError(t, resp, "proxima_emissao")
}

func TestCreateRecorrencia_Valid(t *testing.T) {
	servico := json.RawMessage(`{"codigo_nbs":"01.01","valor":3500}`)
	tomador := json.RawMessage(`{"documento":"12345678000190","razao_social":"Empresa LTDA"}`)
	stub := &stubRecorrenciaRepo{
		createResult: &recorrencia.Recorrencia{
			ID:             "rec-uuid",
			MeiID:          "test-mei-id",
			Nome:           "Desenvolvimento mensal",
			Ativo:          true,
			DiaVencimento:  5,
			Servico:        servico,
			Tomador:        tomador,
			ProximaEmissao: "2026-06-05",
		},
	}
	app := newRecorrenciaApp(stub)

	body := `{
		"nome":"Desenvolvimento mensal",
		"dia_vencimento":5,
		"servico":{"codigo_nbs":"01.01","valor":3500},
		"tomador":{"documento":"12345678000190","razao_social":"Empresa LTDA"},
		"proxima_emissao":"2026-06-05"
	}`
	resp := mustTest(t, app, recorrenciaReq(http.MethodPost, "/v1/recorrencias", body)) //nolint:bodyclose

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("status = %d, want 201", resp.StatusCode)
	}

	var got map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got["id"] == nil {
		t.Error("response missing id")
	}
	if got["nome"] != "Desenvolvimento mensal" {
		t.Errorf("nome = %v, want 'Desenvolvimento mensal'", got["nome"])
	}
}

// ─── ListRecorrencias tests ───────────────────────────────────────────────────

func TestListRecorrencias_EmptyList(t *testing.T) {
	stub := &stubRecorrenciaRepo{listResult: nil}
	app := newRecorrenciaApp(stub)

	resp := mustTest(t, app, recorrenciaReq(http.MethodGet, "/v1/recorrencias", "")) //nolint:bodyclose

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}

	var got map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	data, ok := got["data"].([]interface{})
	if !ok {
		t.Errorf("data is not an array: %v", got["data"])
	}
	if len(data) != 0 {
		t.Errorf("expected empty array, got %v", data)
	}
	if got["total"] != float64(0) {
		t.Errorf("total = %v, want 0", got["total"])
	}
}

// ─── GetRecorrencia tests ─────────────────────────────────────────────────────

func TestGetRecorrencia_NotFound(t *testing.T) {
	stub := &stubRecorrenciaRepo{getErr: recorrencia.ErrNotFound}
	app := newRecorrenciaApp(stub)

	resp := mustTest(t, app, recorrenciaReq(http.MethodGet, "/v1/recorrencias/nonexistent-id", "")) //nolint:bodyclose

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

// ─── DeleteRecorrencia tests ──────────────────────────────────────────────────

func TestDeleteRecorrencia_NotFound(t *testing.T) {
	stub := &stubRecorrenciaRepo{deleteErr: recorrencia.ErrNotFound}
	app := newRecorrenciaApp(stub)

	resp := mustTest(t, app, recorrenciaReq(http.MethodDelete, "/v1/recorrencias/nonexistent-id", "")) //nolint:bodyclose

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

func TestDeleteRecorrencia_Success(t *testing.T) {
	stub := &stubRecorrenciaRepo{}
	app := newRecorrenciaApp(stub)

	resp := mustTest(t, app, recorrenciaReq(http.MethodDelete, "/v1/recorrencias/some-id", "")) //nolint:bodyclose

	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("status = %d, want 204", resp.StatusCode)
	}
}

// ─── helper ───────────────────────────────────────────────────────────────────

func assertRecorrenciaFieldError(t *testing.T, resp *http.Response, name string) {
	t.Helper()
	var got map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	fields, ok := got["fields"].([]interface{})
	if !ok {
		t.Fatalf("fields is not an array: %v", got["fields"])
	}
	for _, f := range fields {
		m, _ := f.(map[string]interface{})
		if m["field"] == name {
			return
		}
	}
	t.Errorf("field %q not found in errors: %v", name, fields)
}
