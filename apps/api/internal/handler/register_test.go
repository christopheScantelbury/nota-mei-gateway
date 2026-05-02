package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/handler"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// stubRegistrar is a test double for meiRegistrar.
type stubRegistrar struct {
	result *auth.RegisterMEIResult
	err    error
}

func (s *stubRegistrar) RegisterMEI(_ context.Context, _ auth.RegisterMEIParams) (*auth.RegisterMEIResult, error) {
	return s.result, s.err
}

func newRegisterApp(stub *stubRegistrar) *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	h := handler.NewRegisterHandler(stub)
	app.Post("/v1/auth/register", h.Register)
	return app
}

func registerReq(body string) *http.Request {
	r := httptest.NewRequest(http.MethodPost, "/v1/auth/register", bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	return r
}

func TestRegister_Success(t *testing.T) {
	meiID := uuid.New()
	stub := &stubRegistrar{
		result: &auth.RegisterMEIResult{MeiID: meiID, APIKey: "sk_live_abc123"},
	}
	app := newRegisterApp(stub)

	body := `{"cnpj":"12345678000190","razao_social":"Empresa Teste","email":"a@b.com","municipio_ibge":"3550308"}`
	resp := mustTest(t, app, registerReq(body))
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("status = %d, want 201", resp.StatusCode)
	}
	var got map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got["mei_id"] == nil {
		t.Error("response missing mei_id")
	}
	if got["api_key"] == nil {
		t.Error("response missing api_key")
	}
	if got["plano"] != "Trial" {
		t.Errorf("plano = %v, want Trial", got["plano"])
	}
}

func TestRegister_FormattedCNPJ(t *testing.T) {
	meiID := uuid.New()
	stub := &stubRegistrar{result: &auth.RegisterMEIResult{MeiID: meiID, APIKey: "sk_live_x"}}
	app := newRegisterApp(stub)

	// Formatted CNPJ should be accepted and normalised.
	body := `{"cnpj":"12.345.678/0001-90","razao_social":"Teste","email":"x@y.com","municipio_ibge":"3550308"}`
	resp := mustTest(t, app, registerReq(body))
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("status = %d, want 201", resp.StatusCode)
	}
	_, _ = io.Copy(io.Discard, resp.Body)
}

func TestRegister_InvalidCNPJ(t *testing.T) {
	stub := &stubRegistrar{}
	app := newRegisterApp(stub)

	body := `{"cnpj":"123","razao_social":"Teste","email":"x@y.com","municipio_ibge":"3550308"}`
	resp := mustTest(t, app, registerReq(body))
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertRegFieldError(t, resp, "cnpj")
}

func TestRegister_MissingRazaoSocial(t *testing.T) {
	stub := &stubRegistrar{}
	app := newRegisterApp(stub)

	body := `{"cnpj":"12345678000190","razao_social":"","email":"x@y.com","municipio_ibge":"3550308"}`
	resp := mustTest(t, app, registerReq(body))
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertRegFieldError(t, resp, "razao_social")
}

func TestRegister_MissingEmail(t *testing.T) {
	stub := &stubRegistrar{}
	app := newRegisterApp(stub)

	body := `{"cnpj":"12345678000190","razao_social":"Teste","email":"","municipio_ibge":"3550308"}`
	resp := mustTest(t, app, registerReq(body))
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertRegFieldError(t, resp, "email")
}

func TestRegister_InvalidMunicipio(t *testing.T) {
	stub := &stubRegistrar{}
	app := newRegisterApp(stub)

	body := `{"cnpj":"12345678000190","razao_social":"Teste","email":"x@y.com","municipio_ibge":"123"}`
	resp := mustTest(t, app, registerReq(body))
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertRegFieldError(t, resp, "municipio_ibge")
}

func TestRegister_MultipleValidationErrors(t *testing.T) {
	stub := &stubRegistrar{}
	app := newRegisterApp(stub)

	body := `{"cnpj":"","razao_social":"","email":"","municipio_ibge":""}`
	resp := mustTest(t, app, registerReq(body))
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	var got map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	fields, ok := got["fields"].([]interface{})
	if !ok || len(fields) < 2 {
		t.Errorf("expected multiple field errors, got %v", got["fields"])
	}
}

func TestRegister_InternalError(t *testing.T) {
	stub := &stubRegistrar{err: errors.New("connection refused")}
	app := newRegisterApp(stub)

	body := `{"cnpj":"12345678000190","razao_social":"Teste","email":"x@y.com","municipio_ibge":"3550308"}`
	resp := mustTest(t, app, registerReq(body))
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", resp.StatusCode)
	}
	var got map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got["error"] != "INTERNAL_ERROR" {
		t.Errorf("error = %v, want INTERNAL_ERROR", got["error"])
	}
}

func TestRegister_InvalidJSON(t *testing.T) {
	stub := &stubRegistrar{}
	app := newRegisterApp(stub)

	r := httptest.NewRequest(http.MethodPost, "/v1/auth/register", bytes.NewBufferString("{bad json"))
	r.Header.Set("Content-Type", "application/json")
	resp := mustTest(t, app, r)
	defer func() { _ = resp.Body.Close() }()
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
}

// assertRegFieldError checks that the response body contains a "fields" array
// with at least one entry whose "field" value matches name.
// Renamed to avoid conflict with any other assertFieldError in the package.
func assertRegFieldError(t *testing.T, resp *http.Response, name string) {
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
