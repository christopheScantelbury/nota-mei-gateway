package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/document"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/handler"
	"github.com/gofiber/fiber/v2"
)

// newMunicipioApp builds a minimal Fiber app with the municipio endpoint wired.
func newMunicipioApp(t *testing.T) *fiber.App {
	t.Helper()
	// document.NewISSLookupFromRates is exported via export_test.go in the document package.
	issLookup := document.NewISSLookupFromRates(map[string]float64{
		// AM — Amazonas (prefix 13)
		"1302603": 2.0, // Manaus
		"1301704": 5.0, // Itacoatiara
		// SP — São Paulo (prefix 35)
		"3550308": 2.9, // São Paulo capital
		"3509502": 3.5, // Campinas
	})

	h := handler.NewMunicipioHandler(issLookup)

	app := fiber.New()
	app.Get("/v1/municipios", h.ListMunicipios)
	return app
}

func TestListMunicipios_NoFilter_ReturnsAll(t *testing.T) {
	app := newMunicipioApp(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/municipios", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var body struct {
		Total      int `json:"total"`
		Municipios []struct {
			IBGE        string  `json:"ibge"`
			AliquotaISS float64 `json:"aliquota_iss"`
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
	app := newMunicipioApp(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/municipios?uf=AM", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()

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
	app := newMunicipioApp(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/municipios?uf=sp", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()

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
	app := newMunicipioApp(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/municipios?uf=XX", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()

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

func TestListMunicipios_NilLookup_ReturnsEmpty(t *testing.T) {
	h := handler.NewMunicipioHandler(nil)
	app := fiber.New()
	app.Get("/v1/municipios", h.ListMunicipios)

	req := httptest.NewRequest(http.MethodGet, "/v1/municipios", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for nil lookup, got %d", resp.StatusCode)
	}
}

func TestListMunicipios_SortedByIBGE(t *testing.T) {
	app := newMunicipioApp(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/municipios?uf=SP", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()

	var body struct {
		Municipios []struct {
			IBGE string `json:"ibge"`
		} `json:"municipios"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Municipios) < 2 {
		t.Fatalf("expected at least 2 municipios for SP, got %d", len(body.Municipios))
	}
	// Should be sorted ascending: 3509502 < 3550308
	if body.Municipios[0].IBGE >= body.Municipios[1].IBGE {
		t.Fatalf("municipios not sorted: %s >= %s", body.Municipios[0].IBGE, body.Municipios[1].IBGE)
	}
}
