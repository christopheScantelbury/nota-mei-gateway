package auth

import (
	"encoding/json"
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
	if err := sentinelToError(cacheValInvalid); err != ErrInvalidCNPJ {
		t.Errorf("INVALID sentinel: want ErrInvalidCNPJ, got %v", err)
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
}

// ─── fetchPorte (MEI detection) ───────────────────────────────────────────────

// TestFetchPorte_SimplesMEI verifies that a CNPJ whose publica.cnpj.ws response
// has porte.descricao = "MICRO EMPRESA" but simples.mei = "S" is correctly
// recognised as MEI. This is the real-world response format from cnpj.ws —
// the old code only checked porte.descricao and missed these companies.
func TestFetchPorte_SimplesMEI(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simulate real cnpj.ws response for a MEI company.
		resp := map[string]any{
			"porte":    map[string]any{"id": "01", "descricao": "MICRO EMPRESA"},
			"simples":  map[string]any{"simples": "S", "mei": "S"},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	v := &CNPJValidator{
		client: srv.Client(),
		apiURL: srv.URL,
	}
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
			"porte":   map[string]any{"id": "01", "descricao": "MICRO EMPRESA"},
			"simples": map[string]any{"simples": "S", "mei": "N"},
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
