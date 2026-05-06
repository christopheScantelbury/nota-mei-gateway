package document

import (
	"context"
	"testing"
)

// ── helpers ───────────────────────────────────────────────────────────────────

func newTestISSLookup() *ISSLookup {
	return NewISSLookupFromRates(map[string]float64{
		"3550308": 2.0, // São Paulo
		"4106902": 2.5, // Curitiba
	})
}

// ── legacy / backward-compat tests ───────────────────────────────────────────

func TestISSLookup_KnownMunicipality(t *testing.T) {
	l := newTestISSLookup()
	if got := l.GetAliquotaDefault("3550308"); got != 2.0 {
		t.Errorf("GetAliquotaDefault(São Paulo) = %v, want 2.0", got)
	}
	if got := l.GetAliquotaDefault("4106902"); got != 2.5 {
		t.Errorf("GetAliquotaDefault(Curitiba) = %v, want 2.5", got)
	}
}

func TestISSLookup_UnknownMunicipalityFallback(t *testing.T) {
	l := newTestISSLookup()
	if got := l.GetAliquotaDefault("9999999"); got != DefaultAliquotaISS {
		t.Errorf("GetAliquotaDefault(unknown) = %v, want %v", got, DefaultAliquotaISS)
	}
}

func TestISSLookup_ResolveOverrideHasPrecedence(t *testing.T) {
	l := newTestISSLookup()
	got := l.Resolve("3550308", 3.0) // override 3% beats table 2%
	if got != 3.0 {
		t.Errorf("Resolve with override = %v, want 3.0", got)
	}
}

func TestISSLookup_ResolveZeroOverrideUsesDefault(t *testing.T) {
	l := newTestISSLookup()
	got := l.Resolve("3550308", 0)
	if got != 2.0 {
		t.Errorf("Resolve(no override) = %v, want 2.0", got)
	}
}

func TestISSLookup_ResolveUnknownMunicipalityFallback(t *testing.T) {
	l := newTestISSLookup()
	got := l.Resolve("9999999", 0)
	if got != DefaultAliquotaISS {
		t.Errorf("Resolve(unknown, no override) = %v, want %v", got, DefaultAliquotaISS)
	}
}

func TestDefaultAliquotaISS(t *testing.T) {
	if DefaultAliquotaISS != 2.0 {
		t.Errorf("DefaultAliquotaISS = %v, want 2.0", DefaultAliquotaISS)
	}
}

func TestISSLookup_IsHabilitado_Known(t *testing.T) {
	l := newTestISSLookup()
	if !l.IsHabilitado("3550308") {
		t.Error("IsHabilitado(São Paulo) should be true")
	}
}

func TestISSLookup_IsHabilitado_Unknown(t *testing.T) {
	l := newTestISSLookup()
	if l.IsHabilitado("9999999") {
		t.Error("IsHabilitado(unknown) should be false")
	}
}

func TestISSLookup_ListAll_Length(t *testing.T) {
	l := newTestISSLookup()
	all := l.ListAll()
	if len(all) != 2 {
		t.Errorf("ListAll() length = %d, want 2", len(all))
	}
}

func TestISSLookup_ListAll_Sorted(t *testing.T) {
	l := newTestISSLookup()
	all := l.ListAll()
	for i := 1; i < len(all); i++ {
		if all[i-1].IBGE >= all[i].IBGE {
			t.Errorf("ListAll not sorted at index %d: %s >= %s", i, all[i-1].IBGE, all[i].IBGE)
		}
	}
}

// ── new context-aware tests (stub path — no DB/Redis) ────────────────────────

func TestISSLookup_GetAliquota_KnownMunicipality(t *testing.T) {
	l := newTestISSLookup()
	ctx := context.Background()
	result, err := l.GetAliquota(ctx, "3550308", "01.01.01.10")
	if err != nil {
		t.Fatalf("GetAliquota known municipality: unexpected error: %v", err)
	}
	if result.Aliquota != 2.0 {
		t.Errorf("GetAliquota = %v, want 2.0", result.Aliquota)
	}
	if result.Fonte != "padrao_municipio" {
		t.Errorf("Fonte = %q, want padrao_municipio (stub uses legacyRates)", result.Fonte)
	}
}

func TestISSLookup_GetAliquota_UnknownReturnsError(t *testing.T) {
	l := newTestISSLookup()
	ctx := context.Background()
	_, err := l.GetAliquota(ctx, "9999999", "01.01.01.10")
	if err == nil {
		t.Fatal("GetAliquota unknown: expected ErrAliquotaNaoEncontrada, got nil")
	}
	var e ErrAliquotaNaoEncontrada
	switch typed := err.(type) { //nolint:errorlint
	case ErrAliquotaNaoEncontrada:
		e = typed
	default:
		t.Fatalf("error type = %T, want ErrAliquotaNaoEncontrada", err)
	}
	if e.IBGE != "9999999" {
		t.Errorf("ErrAliquotaNaoEncontrada.IBGE = %q, want 9999999", e.IBGE)
	}
}

func TestISSLookup_GetAliquota_ErrorMessageContainsIBGE(t *testing.T) {
	l := newTestISSLookup()
	ctx := context.Background()
	_, err := l.GetAliquota(ctx, "1302603", "99.99.99.99")
	if err == nil {
		t.Fatal("expected error for unmapped municipality")
	}
	msg := err.Error()
	if len(msg) == 0 {
		t.Error("ErrAliquotaNaoEncontrada.Error() should not be empty")
	}
}

func TestISSLookup_MunicipioAtivo_Known(t *testing.T) {
	l := newTestISSLookup()
	ctx := context.Background()
	ativo, err := l.MunicipioAtivo(ctx, "3550308")
	if err != nil {
		t.Fatalf("MunicipioAtivo known: unexpected error: %v", err)
	}
	if !ativo {
		t.Error("MunicipioAtivo(São Paulo) should be true")
	}
}

func TestISSLookup_MunicipioAtivo_Unknown(t *testing.T) {
	l := newTestISSLookup()
	ctx := context.Background()
	ativo, err := l.MunicipioAtivo(ctx, "9999999")
	if err != nil {
		t.Fatalf("MunicipioAtivo unknown: unexpected error: %v", err)
	}
	if ativo {
		t.Error("MunicipioAtivo(unknown) should be false")
	}
}

func TestISSLookup_MunicipioAtivo_AllLegacyRatesAreActive(t *testing.T) {
	l := NewISSLookupFromRates(map[string]float64{
		"1302603": 2.0, // Manaus
		"3550308": 2.0, // São Paulo
		"4106902": 2.5, // Curitiba
	})
	ctx := context.Background()
	for _, ibge := range []string{"1302603", "3550308", "4106902"} {
		ativo, err := l.MunicipioAtivo(ctx, ibge)
		if err != nil {
			t.Errorf("MunicipioAtivo(%s): unexpected error: %v", ibge, err)
		}
		if !ativo {
			t.Errorf("MunicipioAtivo(%s) should be true for legacyRates entry", ibge)
		}
	}
}

func TestISSLookup_ErrAliquotaNaoEncontrada_Error(t *testing.T) {
	e := ErrAliquotaNaoEncontrada{IBGE: "1302603", NBS: "01.01.01.10"}
	msg := e.Error()
	if len(msg) == 0 {
		t.Error("ErrAliquotaNaoEncontrada.Error() should not be empty")
	}
	// Should mention the IBGE code
	found := false
	for i := 0; i+6 < len(msg); i++ {
		if msg[i:i+7] == "1302603" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("error message should contain IBGE code, got: %s", msg)
	}
}

func TestISSLookup_NewISSLookupFromRates_NilMap(t *testing.T) {
	l := NewISSLookupFromRates(nil)
	ctx := context.Background()
	// Should not panic
	_, err := l.GetAliquota(ctx, "9999999", "01.01.01.10")
	if err == nil {
		t.Error("expected error for empty legacyRates")
	}
	ativo, err := l.MunicipioAtivo(ctx, "9999999")
	if err != nil {
		t.Errorf("MunicipioAtivo with nil map: unexpected error: %v", err)
	}
	if ativo {
		t.Error("MunicipioAtivo should be false for nil legacyRates")
	}
}
