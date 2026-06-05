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
	"github.com/jackc/pgx/v5/pgconn"
)

// ── test doubles ──────────────────────────────────────────────────────────────

type stubEmpresaRegistrar struct {
	result *auth.RegisterEmpresaResult
	err    error
}

func (s *stubEmpresaRegistrar) RegisterEmpresa(_ context.Context, _ auth.RegisterEmpresaParams) (*auth.RegisterEmpresaResult, error) {
	return s.result, s.err
}

// capturingEmpresaRegistrar records the params passed to RegisterEmpresa.
type capturingEmpresaRegistrar struct {
	captured auth.RegisterEmpresaParams
	result   *auth.RegisterEmpresaResult
	err      error
}

func (c *capturingEmpresaRegistrar) RegisterEmpresa(_ context.Context, p auth.RegisterEmpresaParams) (*auth.RegisterEmpresaResult, error) {
	c.captured = p
	return c.result, c.err
}

// meRegistrar mirrors the unexported empresaRegistrar interface in register_me.go
// so the test package can satisfy it without importing private types.
type meRegistrar interface {
	RegisterEmpresa(ctx context.Context, p auth.RegisterEmpresaParams) (*auth.RegisterEmpresaResult, error)
}

// ── helpers ───────────────────────────────────────────────────────────────────

func newRegisterMEApp(r meRegistrar) *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	h := handler.NewRegisterMEHandler(r)
	app.Post("/v1/auth/register/me", h.RegisterME)
	return app
}

func registerMEReq(body string) *http.Request {
	r := httptest.NewRequest(http.MethodPost, "/v1/auth/register/me", bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	return r
}

func validMEBody() string {
	return `{
		"tipo":"ME",
		"regime_tributario":"SIMPLES_NACIONAL",
		"cnpj":"12345678000190",
		"razao_social":"Empresa Teste ME LTDA",
		"email":"contato@empresa.com",
		"municipio_ibge":"1302603",
		"cnae":"6201500",
		"cep":"69010090"
	}`
}

func assertMEFieldError(t *testing.T, resp *http.Response, name string) {
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

// ── success cases ─────────────────────────────────────────────────────────────

func TestRegisterME_Success(t *testing.T) {
	empresaID := uuid.New()
	stub := &stubEmpresaRegistrar{
		result: &auth.RegisterEmpresaResult{EmpresaID: empresaID, APIKey: "sk_live_abc123"},
	}
	app := newRegisterMEApp(stub)

	resp := mustTest(t, app, registerMEReq(validMEBody()))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("status = %d, want 201", resp.StatusCode)
	}
	var got map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got["empresa_id"] == nil {
		t.Error("response missing empresa_id")
	}
	// api_key NÃO é mais retornada na response — refactor 2026-06-05:
	// fluxo ME/EPP agora manda magic link Supabase em vez de expor chave.
	// A chave fica no banco; user vê via /v1/auth/api-keys após login.
	if _, present := got["api_key"]; present {
		t.Error("response should NOT include api_key (security refactor)")
	}
	if got["trial"] != true {
		t.Errorf("trial = %v, want true", got["trial"])
	}
	if got["email_sent_to"] == nil {
		t.Error("response should include email_sent_to to drive frontend success screen")
	}
}

func TestRegisterME_EPP_Success(t *testing.T) {
	empresaID := uuid.New()
	stub := &stubEmpresaRegistrar{
		result: &auth.RegisterEmpresaResult{EmpresaID: empresaID, APIKey: "sk_live_epp"},
	}
	app := newRegisterMEApp(stub)

	body := `{
		"tipo":"EPP",
		"regime_tributario":"LUCRO_PRESUMIDO",
		"cnpj":"12345678000190",
		"razao_social":"Empresa EPP LTDA",
		"email":"epp@empresa.com",
		"municipio_ibge":"1302603",
		"cnae":"6201500",
		"cep":"69010090"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("status = %d, want 201", resp.StatusCode)
	}
	var got map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got["tipo"] != "EPP" {
		t.Errorf("tipo = %v, want EPP", got["tipo"])
	}
	if got["regime_tributario"] != "LUCRO_PRESUMIDO" {
		t.Errorf("regime_tributario = %v, want LUCRO_PRESUMIDO", got["regime_tributario"])
	}
}

func TestRegisterME_LucroReal_Success(t *testing.T) {
	empresaID := uuid.New()
	stub := &stubEmpresaRegistrar{
		result: &auth.RegisterEmpresaResult{EmpresaID: empresaID, APIKey: "sk_live_lr"},
	}
	app := newRegisterMEApp(stub)

	body := `{
		"tipo":"ME",
		"regime_tributario":"LUCRO_REAL",
		"cnpj":"12345678000190",
		"razao_social":"Empresa LR",
		"email":"lr@empresa.com",
		"municipio_ibge":"1302603"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("status = %d, want 201", resp.StatusCode)
	}
}

// ── CNPJ normalisation ────────────────────────────────────────────────────────

func TestRegisterME_FormattedCNPJ(t *testing.T) {
	empresaID := uuid.New()
	cap := &capturingEmpresaRegistrar{
		result: &auth.RegisterEmpresaResult{EmpresaID: empresaID, APIKey: "sk_live_x"},
	}
	app := newRegisterMEApp(cap)

	body := `{
		"tipo":"ME","regime_tributario":"SIMPLES_NACIONAL",
		"cnpj":"12.345.678/0001-90",
		"razao_social":"Teste","email":"x@y.com","municipio_ibge":"1302603"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("status = %d, want 201", resp.StatusCode)
	}
	// Normalised CNPJ must be raw digits only.
	if cap.captured.CNPJ != "12345678000190" {
		t.Errorf("CNPJ = %q, want %q (raw digits)", cap.captured.CNPJ, "12345678000190")
	}
}

func TestRegisterME_CNAE_Normalisation(t *testing.T) {
	empresaID := uuid.New()
	cap := &capturingEmpresaRegistrar{
		result: &auth.RegisterEmpresaResult{EmpresaID: empresaID, APIKey: "sk_live_x"},
	}
	app := newRegisterMEApp(cap)

	// CNAE with dash and slash (e.g. "6201-5/00") must be stripped to 7 digits.
	body := `{
		"tipo":"ME","regime_tributario":"SIMPLES_NACIONAL",
		"cnpj":"12345678000190","razao_social":"Teste","email":"x@y.com",
		"municipio_ibge":"1302603","cnae":"6201-5/00"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("status = %d, want 201", resp.StatusCode)
	}
	if cap.captured.CNAE != "6201500" {
		t.Errorf("CNAE = %q, want %q", cap.captured.CNAE, "6201500")
	}
}

func TestRegisterME_CEP_Normalisation(t *testing.T) {
	empresaID := uuid.New()
	cap := &capturingEmpresaRegistrar{
		result: &auth.RegisterEmpresaResult{EmpresaID: empresaID, APIKey: "sk_live_x"},
	}
	app := newRegisterMEApp(cap)

	// CEP with hyphen (e.g. "69010-090") must be stripped to 8 digits.
	body := `{
		"tipo":"ME","regime_tributario":"SIMPLES_NACIONAL",
		"cnpj":"12345678000190","razao_social":"Teste","email":"x@y.com",
		"municipio_ibge":"1302603","cep":"69010-090"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("status = %d, want 201", resp.StatusCode)
	}
	if cap.captured.CEP != "69010090" {
		t.Errorf("CEP = %q, want %q", cap.captured.CEP, "69010090")
	}
}

// ── validation — tipo ─────────────────────────────────────────────────────────

func TestRegisterME_InvalidTipo_MEI(t *testing.T) {
	stub := &stubEmpresaRegistrar{}
	app := newRegisterMEApp(stub)

	body := `{
		"tipo":"MEI","regime_tributario":"SIMPLES_NACIONAL",
		"cnpj":"12345678000190","razao_social":"Teste","email":"x@y.com","municipio_ibge":"1302603"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertMEFieldError(t, resp, "tipo")
}

func TestRegisterME_MissingTipo(t *testing.T) {
	stub := &stubEmpresaRegistrar{}
	app := newRegisterMEApp(stub)

	body := `{
		"regime_tributario":"SIMPLES_NACIONAL",
		"cnpj":"12345678000190","razao_social":"Teste","email":"x@y.com","municipio_ibge":"1302603"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertMEFieldError(t, resp, "tipo")
}

// ── validation — regime_tributario ───────────────────────────────────────────

func TestRegisterME_InvalidRegime_SimplesNacionalMEI(t *testing.T) {
	// SIMPLES_MEI is not valid for ME/EPP registration.
	stub := &stubEmpresaRegistrar{}
	app := newRegisterMEApp(stub)

	body := `{
		"tipo":"ME","regime_tributario":"SIMPLES_MEI",
		"cnpj":"12345678000190","razao_social":"Teste","email":"x@y.com","municipio_ibge":"1302603"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertMEFieldError(t, resp, "regime_tributario")
}

func TestRegisterME_MissingRegime(t *testing.T) {
	stub := &stubEmpresaRegistrar{}
	app := newRegisterMEApp(stub)

	body := `{
		"tipo":"ME",
		"cnpj":"12345678000190","razao_social":"Teste","email":"x@y.com","municipio_ibge":"1302603"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertMEFieldError(t, resp, "regime_tributario")
}

// ── validation — cnpj ────────────────────────────────────────────────────────

func TestRegisterME_InvalidCNPJ(t *testing.T) {
	stub := &stubEmpresaRegistrar{}
	app := newRegisterMEApp(stub)

	body := `{
		"tipo":"ME","regime_tributario":"SIMPLES_NACIONAL",
		"cnpj":"123","razao_social":"Teste","email":"x@y.com","municipio_ibge":"1302603"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertMEFieldError(t, resp, "cnpj")
}

// ── validation — razao_social / email / municipio ────────────────────────────

func TestRegisterME_MissingRazaoSocial(t *testing.T) {
	stub := &stubEmpresaRegistrar{}
	app := newRegisterMEApp(stub)

	body := `{
		"tipo":"ME","regime_tributario":"SIMPLES_NACIONAL",
		"cnpj":"12345678000190","razao_social":"","email":"x@y.com","municipio_ibge":"1302603"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertMEFieldError(t, resp, "razao_social")
}

func TestRegisterME_MissingEmail(t *testing.T) {
	stub := &stubEmpresaRegistrar{}
	app := newRegisterMEApp(stub)

	body := `{
		"tipo":"ME","regime_tributario":"SIMPLES_NACIONAL",
		"cnpj":"12345678000190","razao_social":"Teste","email":"","municipio_ibge":"1302603"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertMEFieldError(t, resp, "email")
}

func TestRegisterME_InvalidMunicipio(t *testing.T) {
	stub := &stubEmpresaRegistrar{}
	app := newRegisterMEApp(stub)

	body := `{
		"tipo":"ME","regime_tributario":"SIMPLES_NACIONAL",
		"cnpj":"12345678000190","razao_social":"Teste","email":"x@y.com","municipio_ibge":"123"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertMEFieldError(t, resp, "municipio_ibge")
}

// ── validation — cnae e cep ───────────────────────────────────────────────────

func TestRegisterME_InvalidCNAE_TooShort(t *testing.T) {
	stub := &stubEmpresaRegistrar{}
	app := newRegisterMEApp(stub)

	body := `{
		"tipo":"ME","regime_tributario":"SIMPLES_NACIONAL",
		"cnpj":"12345678000190","razao_social":"Teste","email":"x@y.com",
		"municipio_ibge":"1302603","cnae":"123"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertMEFieldError(t, resp, "cnae")
}

func TestRegisterME_InvalidCNAE_Alpha(t *testing.T) {
	stub := &stubEmpresaRegistrar{}
	app := newRegisterMEApp(stub)

	body := `{
		"tipo":"ME","regime_tributario":"SIMPLES_NACIONAL",
		"cnpj":"12345678000190","razao_social":"Teste","email":"x@y.com",
		"municipio_ibge":"1302603","cnae":"ABC1234"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertMEFieldError(t, resp, "cnae")
}

func TestRegisterME_InvalidCEP_TooShort(t *testing.T) {
	stub := &stubEmpresaRegistrar{}
	app := newRegisterMEApp(stub)

	body := `{
		"tipo":"ME","regime_tributario":"SIMPLES_NACIONAL",
		"cnpj":"12345678000190","razao_social":"Teste","email":"x@y.com",
		"municipio_ibge":"1302603","cep":"12345"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertMEFieldError(t, resp, "cep")
}

func TestRegisterME_InvalidCEP_Alpha(t *testing.T) {
	stub := &stubEmpresaRegistrar{}
	app := newRegisterMEApp(stub)

	body := `{
		"tipo":"ME","regime_tributario":"SIMPLES_NACIONAL",
		"cnpj":"12345678000190","razao_social":"Teste","email":"x@y.com",
		"municipio_ibge":"1302603","cep":"ABCDEFGH"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	assertMEFieldError(t, resp, "cep")
}

func TestRegisterME_CNAE_Omitted_IsAllowed(t *testing.T) {
	// cnae is optional at registration — validated at DPS build time.
	empresaID := uuid.New()
	stub := &stubEmpresaRegistrar{
		result: &auth.RegisterEmpresaResult{EmpresaID: empresaID, APIKey: "sk_live_x"},
	}
	app := newRegisterMEApp(stub)

	body := `{
		"tipo":"ME","regime_tributario":"SIMPLES_NACIONAL",
		"cnpj":"12345678000190","razao_social":"Teste","email":"x@y.com","municipio_ibge":"1302603"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("status = %d, want 201 (cnae optional at registration)", resp.StatusCode)
	}
}

// ── validation — multiple errors ──────────────────────────────────────────────

func TestRegisterME_MultipleValidationErrors(t *testing.T) {
	stub := &stubEmpresaRegistrar{}
	app := newRegisterMEApp(stub)

	body := `{"tipo":"","regime_tributario":"","cnpj":"","razao_social":"","email":"","municipio_ibge":""}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	var got map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	fields, ok := got["fields"].([]interface{})
	if !ok || len(fields) < 4 {
		t.Errorf("expected >=4 field errors, got %v", got["fields"])
	}
}

// ── error cases ───────────────────────────────────────────────────────────────

func TestRegisterME_Conflict_CNPJ(t *testing.T) {
	pgErr := &pgconn.PgError{Code: "23505"}
	stub := &stubEmpresaRegistrar{err: pgErr}
	app := newRegisterMEApp(stub)

	resp := mustTest(t, app, registerMEReq(validMEBody()))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusConflict {
		t.Errorf("status = %d, want 409", resp.StatusCode)
	}
	var got map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got["error"] != "CONFLICT" {
		t.Errorf("error = %v, want CONFLICT", got["error"])
	}
}

func TestRegisterME_InternalError(t *testing.T) {
	stub := &stubEmpresaRegistrar{err: errors.New("db connection refused")}
	app := newRegisterMEApp(stub)

	resp := mustTest(t, app, registerMEReq(validMEBody()))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

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

func TestRegisterME_InvalidJSON(t *testing.T) {
	stub := &stubEmpresaRegistrar{}
	app := newRegisterMEApp(stub)

	r := httptest.NewRequest(http.MethodPost, "/v1/auth/register/me", bytes.NewBufferString("{bad json"))
	r.Header.Set("Content-Type", "application/json")
	resp := mustTest(t, app, r)
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
}

// ── case insensitivity ────────────────────────────────────────────────────────

func TestRegisterME_TipoLowercase_Accepted(t *testing.T) {
	empresaID := uuid.New()
	cap := &capturingEmpresaRegistrar{
		result: &auth.RegisterEmpresaResult{EmpresaID: empresaID, APIKey: "sk_live_x"},
	}
	app := newRegisterMEApp(cap)

	body := `{
		"tipo":"me","regime_tributario":"simples_nacional",
		"cnpj":"12345678000190","razao_social":"Teste","email":"x@y.com","municipio_ibge":"1302603"
	}`
	resp := mustTest(t, app, registerMEReq(body))
	defer func() { _, _ = io.Copy(io.Discard, resp.Body) }()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("status = %d, want 201 (case-insensitive tipo/regime)", resp.StatusCode)
	}
	if cap.captured.Tipo != "ME" {
		t.Errorf("Tipo = %q, want %q (normalised to uppercase)", cap.captured.Tipo, "ME")
	}
}
