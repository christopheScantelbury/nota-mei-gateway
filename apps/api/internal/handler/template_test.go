package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/handler"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/template"
	"github.com/gofiber/fiber/v2"
)

// ─── stub repo ───────────────────────────────────────────────────────────────

type stubTemplateRepo struct {
	createResult *template.Template
	createErr    error
	listResult   []template.Template
	listErr      error
	getResult    *template.Template
	getErr       error
	updateResult *template.Template
	updateErr    error
	deleteErr    error
}

func (s *stubTemplateRepo) List(_ context.Context, _ string) ([]template.Template, error) {
	return s.listResult, s.listErr
}

func (s *stubTemplateRepo) Get(_ context.Context, _, _ string) (*template.Template, error) {
	return s.getResult, s.getErr
}

func (s *stubTemplateRepo) Create(_ context.Context, _ string, _ template.CreateParams) (*template.Template, error) {
	return s.createResult, s.createErr
}

func (s *stubTemplateRepo) Update(_ context.Context, _, _ string, _ template.UpdateParams) (*template.Template, error) {
	return s.updateResult, s.updateErr
}

func (s *stubTemplateRepo) Delete(_ context.Context, _, _ string) error {
	return s.deleteErr
}

// ─── test app builder ─────────────────────────────────────────────────────────

func newTemplateApp(stub *stubTemplateRepo) *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	h := handler.NewTemplateHandler(stub)

	// Inject a fake mei_id into Locals — mirrors what the real auth middleware does.
	authMw := func(c *fiber.Ctx) error {
		c.Locals("mei_id", "test-mei-id")
		return c.Next()
	}

	v1 := app.Group("/v1", authMw)
	v1.Get("/templates", h.ListTemplates)
	v1.Post("/templates", h.CreateTemplate)
	v1.Get("/templates/:id", h.GetTemplate)
	v1.Put("/templates/:id", h.UpdateTemplate)
	v1.Delete("/templates/:id", h.DeleteTemplate)

	return app
}

func templateReq(method, path, body string) *http.Request {
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

// ─── CreateTemplate tests ─────────────────────────────────────────────────────

func TestCreateTemplate_MissingNome(t *testing.T) {
	stub := &stubTemplateRepo{}
	app := newTemplateApp(stub)

	body := `{"servico":{"codigo_nbs":"01.01","valor":1000}}`
	resp := mustTest(t, app, templateReq(http.MethodPost, "/v1/templates", body)) //nolint:bodyclose

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertTemplateFieldError(t, resp, "nome")
}

func TestCreateTemplate_MissingServico(t *testing.T) {
	stub := &stubTemplateRepo{}
	app := newTemplateApp(stub)

	body := `{"nome":"Meu template"}`
	resp := mustTest(t, app, templateReq(http.MethodPost, "/v1/templates", body)) //nolint:bodyclose

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertTemplateFieldError(t, resp, "servico")
}

func TestCreateTemplate_ServicoNotObject(t *testing.T) {
	stub := &stubTemplateRepo{}
	app := newTemplateApp(stub)

	body := `{"nome":"Meu template","servico":[1,2,3]}`
	resp := mustTest(t, app, templateReq(http.MethodPost, "/v1/templates", body)) //nolint:bodyclose

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertTemplateFieldError(t, resp, "servico")
}

func TestCreateTemplate_NomeTooLong(t *testing.T) {
	stub := &stubTemplateRepo{}
	app := newTemplateApp(stub)

	longNome := string(make([]byte, 101))
	for i := range longNome {
		longNome = longNome[:i] + "a" + longNome[i+1:]
	}
	body := `{"nome":"` + longNome + `","servico":{"valor":1000}}`
	resp := mustTest(t, app, templateReq(http.MethodPost, "/v1/templates", body)) //nolint:bodyclose

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertTemplateFieldError(t, resp, "nome")
}

func TestCreateTemplate_Valid(t *testing.T) {
	servico := json.RawMessage(`{"codigo_nbs":"01.01","valor":3500}`)
	stub := &stubTemplateRepo{
		createResult: &template.Template{
			ID:      "template-uuid",
			MeiID:   "test-mei-id",
			Nome:    "Desenvolvimento",
			Servico: servico,
			Ativo:   true,
		},
	}
	app := newTemplateApp(stub)

	body := `{"nome":"Desenvolvimento","servico":{"codigo_nbs":"01.01","valor":3500}}`
	resp := mustTest(t, app, templateReq(http.MethodPost, "/v1/templates", body)) //nolint:bodyclose

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
	if got["nome"] != "Desenvolvimento" {
		t.Errorf("nome = %v, want Desenvolvimento", got["nome"])
	}
}

func TestCreateTemplate_BothFieldsMissing(t *testing.T) {
	stub := &stubTemplateRepo{}
	app := newTemplateApp(stub)

	body := `{}`
	resp := mustTest(t, app, templateReq(http.MethodPost, "/v1/templates", body)) //nolint:bodyclose

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}

	var got map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	fields, ok := got["fields"].([]interface{})
	if !ok || len(fields) < 2 {
		t.Errorf("expected at least 2 field errors, got %v", got["fields"])
	}
}

// ─── ListTemplates tests ──────────────────────────────────────────────────────

func TestListTemplates_EmptyList(t *testing.T) {
	stub := &stubTemplateRepo{listResult: nil}
	app := newTemplateApp(stub)

	resp := mustTest(t, app, templateReq(http.MethodGet, "/v1/templates", "")) //nolint:bodyclose

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
}

// ─── GetTemplate tests ────────────────────────────────────────────────────────

func TestGetTemplate_NotFound(t *testing.T) {
	stub := &stubTemplateRepo{getErr: template.ErrNotFound}
	app := newTemplateApp(stub)

	resp := mustTest(t, app, templateReq(http.MethodGet, "/v1/templates/nonexistent-id", "")) //nolint:bodyclose

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

func TestGetTemplate_Found(t *testing.T) {
	servico := json.RawMessage(`{"valor":1000}`)
	stub := &stubTemplateRepo{
		getResult: &template.Template{
			ID:      "some-id",
			MeiID:   "test-mei-id",
			Nome:    "Template teste",
			Servico: servico,
			Ativo:   true,
		},
	}
	app := newTemplateApp(stub)

	resp := mustTest(t, app, templateReq(http.MethodGet, "/v1/templates/some-id", "")) //nolint:bodyclose

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
}

// ─── DeleteTemplate tests ─────────────────────────────────────────────────────

func TestDeleteTemplate_NotFound(t *testing.T) {
	stub := &stubTemplateRepo{deleteErr: template.ErrNotFound}
	app := newTemplateApp(stub)

	resp := mustTest(t, app, templateReq(http.MethodDelete, "/v1/templates/nonexistent-id", "")) //nolint:bodyclose

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

func TestDeleteTemplate_Success(t *testing.T) {
	stub := &stubTemplateRepo{}
	app := newTemplateApp(stub)

	resp := mustTest(t, app, templateReq(http.MethodDelete, "/v1/templates/some-id", "")) //nolint:bodyclose

	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("status = %d, want 204", resp.StatusCode)
	}
}

// ─── UpdateTemplate tests ─────────────────────────────────────────────────────

func TestUpdateTemplate_NotFound(t *testing.T) {
	stub := &stubTemplateRepo{updateErr: template.ErrNotFound}
	app := newTemplateApp(stub)

	body := `{"nome":"Novo nome","servico":{"valor":500}}`
	resp := mustTest(t, app, templateReq(http.MethodPut, "/v1/templates/bad-id", body)) //nolint:bodyclose

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

// ─── helper ───────────────────────────────────────────────────────────────────

func assertTemplateFieldError(t *testing.T, resp *http.Response, name string) {
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
