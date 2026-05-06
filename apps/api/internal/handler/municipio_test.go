package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/handler"
	"github.com/gofiber/fiber/v2"
)

// ── stub lister ───────────────────────────────────────────────────────────────

// stubMunicipioLister implements handler.MunicipioLister using an in-memory slice.
type stubMunicipioLister struct {
	entries []handler.MunicipioEntry
}

func (s *stubMunicipioLister) ListAtivos(_ context.Context, uf string) ([]handler.MunicipioEntry, time.Time, error) {
	if uf == "" {
		return s.entries, time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC), nil
	}
	var filtered []handler.MunicipioEntry
	for _, e := range s.entries {
		if e.UF == uf {
			filtered = append(filtered, e)
		}
	}
	return filtered, time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC), nil
}

// newTestMunicipioApp builds a Fiber app backed by the stub lister.
func newTestMunicipioApp(t *testing.T) *fiber.App {
	t.Helper()

	aliq200 := 2.00
	aliq250 := 2.50

	lister := &stubMunicipioLister{
		entries: []handler.MunicipioEntry{
			// AM — Amazonas
			{IBGE: "1302603", Nome: "Manaus", UF: "AM", DataAdesao: "2026-01-01", AliqPadrao: &aliq200, NBSMapeadas: true},
			{IBGE: "1301704", Nome: "Itacoatiara", UF: "AM", DataAdesao: "2026-01-01", AliqPadrao: &aliq200, NBSMapeadas: false},
			// SP — São Paulo
			{IBGE: "3550308", Nome: "São Paulo", UF: "SP", DataAdesao: "2023-09-01", AliqPadrao: &aliq200, NBSMapeadas: false},
			{IBGE: "3509502", Nome: "Campinas", UF: "SP", DataAdesao: "2024-01-01", AliqPadrao: &aliq250, NBSMapeadas: false},
		},
	}

	h := handler.NewMunicipioHandler(lister)
	app := fiber.New()
	app.Get("/v1/municipios", h.ListMunicipios)
	return app
}

// ── tests ─────────────────────────────────────────────────────────────────────

func TestListMunicipios_NoFilter_ReturnsAll(t *testing.T) {
	app := newTestMunicipioApp(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/municipios", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var body struct {
		Total      int `json:"total"`
		Municipios []struct {
			IBGE        string  `json:"ibge"`
			Nome        string  `json:"nome"`
			UF          string  `json:"uf"`
			AliqPadrao  float64 `json:"aliquota_padrao"`
			NBSMapeadas bool    `json:"aliquotas_nbs_mapeadas"`
		} `json:"municipios"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Total != 4 {
		t.Fatalf("expected 4 municipios, got %d", body.Total)
	}
}

func TestListMunicipios_FilterByUF_AM(t *testing.T) {
	app := newTestMunicipioApp(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/municipios?uf=AM", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var body struct {
		Total int `json:"total"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Total != 2 {
		t.Fatalf("expected 2 municipios for AM, got %d", body.Total)
	}
}

func TestListMunicipios_FilterByUF_Lowercase(t *testing.T) {
	app := newTestMunicipioApp(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/municipios?uf=sp", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for lowercase uf, got %d", resp.StatusCode)
	}

	var body struct {
		Total int `json:"total"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Total != 2 {
		t.Fatalf("expected 2 municipios for sp (lowercase), got %d", body.Total)
	}
}

func TestListMunicipios_InvalidUF_Returns400(t *testing.T) {
	app := newTestMunicipioApp(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/municipios?uf=XX", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid UF, got %d", resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["error"] != "INVALID_UF" {
		t.Fatalf("expected INVALID_UF error, got %q", body["error"])
	}
}

func TestListMunicipios_NilLister_ReturnsEmpty(t *testing.T) {
	h := handler.NewMunicipioHandler(nil)
	app := fiber.New()
	app.Get("/v1/municipios", h.ListMunicipios)

	req := httptest.NewRequest(http.MethodGet, "/v1/municipios", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for nil lister, got %d", resp.StatusCode)
	}
}

func TestListMunicipios_ResponseHasAtualizadoEm(t *testing.T) {
	app := newTestMunicipioApp(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/municipios", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	var body map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if _, ok := body["atualizado_em"]; !ok {
		t.Error("response should contain atualizado_em field")
	}
}

func TestListMunicipios_ResponseHasNBSMapeadasField(t *testing.T) {
	app := newTestMunicipioApp(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/municipios?uf=AM", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	var body struct {
		Municipios []struct {
			IBGE        string `json:"ibge"`
			NBSMapeadas bool   `json:"aliquotas_nbs_mapeadas"`
		} `json:"municipios"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Municipios) == 0 {
		t.Fatal("expected at least 1 municipio")
	}
	// Manaus should have NBS mapeadas = true
	for _, m := range body.Municipios {
		if m.IBGE == "1302603" && !m.NBSMapeadas {
			t.Error("Manaus should have aliquotas_nbs_mapeadas=true")
		}
	}
}

func TestListMunicipios_ResponseHasNomeAndUF(t *testing.T) {
	app := newTestMunicipioApp(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/municipios?uf=AM", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	var body struct {
		Municipios []struct {
			IBGE string `json:"ibge"`
			Nome string `json:"nome"`
			UF   string `json:"uf"`
		} `json:"municipios"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	for _, m := range body.Municipios {
		if m.Nome == "" {
			t.Errorf("municipio %s should have nome field", m.IBGE)
		}
		if m.UF == "" {
			t.Errorf("municipio %s should have uf field", m.IBGE)
		}
	}
}
