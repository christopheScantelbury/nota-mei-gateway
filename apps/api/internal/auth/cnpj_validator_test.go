package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ─── checkDigits ──────────────────────────────────────────────────────────────

func TestCheckDigits_ValidCNPJs(t *testing.T) {
	// Real structurally valid CNPJs (public examples).
	valid := []string{
		"11222333000181",
		"45997418000153",
		"00000000000191", // Banco do Brasil
	}
	for _, cnpj := range valid {
		if !checkDigits(cnpj) {
			t.Errorf("checkDigits(%q) = false, want true", cnpj)
		}
	}
}

func TestCheckDigits_InvalidCheckDigit(t *testing.T) {
	invalid := []string{
		"11222333000182", // last digit wrong
		"11222333000191", // both wrong
	}
	for _, cnpj := range invalid {
		if checkDigits(cnpj) {
			t.Errorf("checkDigits(%q) = true, want false", cnpj)
		}
	}
}

func TestCheckDigits_AllSameDigits(t *testing.T) {
	allSame := []string{
		"00000000000000",
		"11111111111111",
		"99999999999999",
	}
	for _, cnpj := range allSame {
		if checkDigits(cnpj) {
			t.Errorf("checkDigits(%q) = true, want false (all-same)", cnpj)
		}
	}
}

func TestCheckDigits_WrongLength(t *testing.T) {
	cases := []string{"", "1234567890123", "123456789012345"}
	for _, c := range cases {
		if checkDigits(c) {
			t.Errorf("checkDigits(%q) = true, want false (wrong length)", c)
		}
	}
}

func TestCheckDigits_NonDigitChars(t *testing.T) {
	if checkDigits("11.222.333/0001-81") {
		t.Error("checkDigits with dots/slashes should return false (must be stripped before)")
	}
}

// ─── sentinelToError ──────────────────────────────────────────────────────────

func TestSentinelToError(t *testing.T) {
	if err := sentinelToError(cacheValMEI); err != nil {
		t.Errorf("MEI sentinel: want nil, got %v", err)
	}
	// O sentinel INVALID só é gravado no cache a partir de um 404 do cnpj.ws —
	// checkDigits roda ANTES do cache, então DV inválido nunca chega aqui.
	// Portanto ele significa "não encontrado na base", não "CNPJ malformado".
	// Mapear pra ErrCNPJNotFound (que NÃO bloqueia cadastro) também conserta
	// as entradas já cacheadas no Redis sob o significado antigo.
	if err := sentinelToError(cacheValInvalid); err != ErrCNPJNotFound {
		t.Errorf("INVALID sentinel: want ErrCNPJNotFound, got %v", err)
	}
	if err := sentinelToError(cacheValNotMEI); err != ErrNotMEI {
		t.Errorf("NOT_MEI sentinel: want ErrNotMEI, got %v", err)
	}
	if err := sentinelToError("unknown"); err != ErrNotMEI {
		t.Errorf("unknown sentinel: want ErrNotMEI, got %v", err)
	}
}

// ─── errors ───────────────────────────────────────────────────────────────────

func TestErrorsAreDistinct(t *testing.T) {
	if ErrInvalidCNPJ == ErrNotMEI {
		t.Error("ErrInvalidCNPJ and ErrNotMEI must be distinct")
	}
	// Regressão 2026-07-16: "não encontrado na base" era retornado como
	// ErrInvalidCNPJ, o que bloqueava empresa recém-aberta com a mensagem
	// "dígito verificador incorreto". Os dois DEVEM ser erros distintos —
	// só ErrInvalidCNPJ pode bloquear cadastro.
	if ErrCNPJNotFound == ErrInvalidCNPJ {
		t.Error("ErrCNPJNotFound and ErrInvalidCNPJ must be distinct — 404 must never block registration")
	}
	if ErrCNPJNotFound == ErrNotMEI {
		t.Error("ErrCNPJNotFound and ErrNotMEI must be distinct")
	}
}

// TestNotFoundNeverBlocks trava o contrato: um CNPJ com DV VÁLIDO que o
// cnpj.ws não conhece (404) NÃO pode ser confundido com CNPJ malformado.
// Se alguém reintroduzir o mapeamento antigo, este teste quebra.
func TestNotFoundNeverBlocks(t *testing.T) {
	err := sentinelToError(cacheValInvalid)
	if errors.Is(err, ErrInvalidCNPJ) {
		t.Fatal("404 do cnpj.ws virou ErrInvalidCNPJ — isso bloqueia empresa recém-aberta " +
			"com mensagem errada (bug do funil, 2026-07-16). Deve ser ErrCNPJNotFound.")
	}
	if !errors.Is(err, ErrCNPJNotFound) {
		t.Fatalf("want ErrCNPJNotFound, got %v", err)
	}
}

// ─── fetchPorte (MEI detection) ───────────────────────────────────────────────

// TestFetchPorte_SimplesMEI_Sim verifies the real publica.cnpj.ws response
// format: porte.descricao = "Micro Empresa", simples.mei = "Sim". This is the
// canonical case — the prior bug checked for "S" and missed these companies.
func TestFetchPorte_SimplesMEI_Sim(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]any{
			"porte":   map[string]any{"id": "01", "descricao": "Micro Empresa"},
			"simples": map[string]any{"simples": "Sim", "mei": "Sim"},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	v := &CNPJValidator{client: srv.Client(), apiURL: srv.URL}
	got, err := v.fetchPorte(t.Context(), "34488964000142")
	if err != nil {
		t.Fatalf("fetchPorte: unexpected error: %v", err)
	}
	if got != cacheValMEI {
		t.Errorf("fetchPorte with simples.mei=Sim: got %q, want %q", got, cacheValMEI)
	}
}

// TestFetchPorte_SimplesMEI_AbbreviatedS verifies the abbreviated form ("S")
// is also accepted, in case the API changes format or other consumers use it.
func TestFetchPorte_SimplesMEI_AbbreviatedS(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]any{
			"porte":   map[string]any{"id": "01", "descricao": "Micro Empresa"},
			"simples": map[string]any{"mei": "S"},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	v := &CNPJValidator{client: srv.Client(), apiURL: srv.URL}
	got, err := v.fetchPorte(t.Context(), "34488964000142")
	if err != nil {
		t.Fatalf("fetchPorte: unexpected error: %v", err)
	}
	if got != cacheValMEI {
		t.Errorf("fetchPorte with simples.mei=S: got %q, want %q", got, cacheValMEI)
	}
}

// TestFetchPorte_PorteDescricaoMEI verifies that the legacy porte.descricao=="MEI"
// path still works (some endpoint variants return this).
func TestFetchPorte_PorteDescricaoMEI(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]any{
			"porte":   map[string]any{"id": "07", "descricao": "MEI"},
			"simples": map[string]any{"mei": "N"},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	v := &CNPJValidator{client: srv.Client(), apiURL: srv.URL}
	got, err := v.fetchPorte(t.Context(), "34488964000142")
	if err != nil {
		t.Fatalf("fetchPorte: unexpected error: %v", err)
	}
	if got != cacheValMEI {
		t.Errorf("fetchPorte with porte.descricao=MEI: got %q, want %q", got, cacheValMEI)
	}
}

// TestFetchPorte_NotMEI verifies that a regular ME (not MEI) is correctly rejected.
func TestFetchPorte_NotMEI(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]any{
			"porte":   map[string]any{"id": "01", "descricao": "Micro Empresa"},
			"simples": map[string]any{"simples": "Sim", "mei": "Não"},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	v := &CNPJValidator{client: srv.Client(), apiURL: srv.URL}
	got, err := v.fetchPorte(t.Context(), "11222333000181")
	if err != nil {
		t.Fatalf("fetchPorte: unexpected error: %v", err)
	}
	if got != cacheValNotMEI {
		t.Errorf("fetchPorte for ME (not MEI): got %q, want %q", got, cacheValNotMEI)
	}
}

// TestIsMEIFlag covers the various truthy/falsy values for simples.mei.
func TestIsMEIFlag(t *testing.T) {
	truthy := []string{"Sim", "sim", "SIM", "S", "s", " Sim ", "true", "1"}
	for _, v := range truthy {
		if !isMEIFlag(v) {
			t.Errorf("isMEIFlag(%q) = false, want true", v)
		}
	}
	falsy := []string{"", "Não", "Nao", "N", "n", "no", "false", "0", "MICRO EMPRESA"}
	for _, v := range falsy {
		if isMEIFlag(v) {
			t.Errorf("isMEIFlag(%q) = true, want false", v)
		}
	}
}
