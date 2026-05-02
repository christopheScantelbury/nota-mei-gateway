package document

import "testing"

func newTestISSLookup() *ISSLookup {
	return &ISSLookup{rates: map[string]float64{
		"3550308": 2.0,
		"4106902": 2.5,
	}}
}

func TestISSLookup_KnownMunicipality(t *testing.T) {
	l := newTestISSLookup()
	if got := l.GetAliquota("3550308"); got != 2.0 {
		t.Errorf("GetAliquota(São Paulo) = %v, want 2.0", got)
	}
	if got := l.GetAliquota("4106902"); got != 2.5 {
		t.Errorf("GetAliquota(Curitiba) = %v, want 2.5", got)
	}
}

func TestISSLookup_UnknownMunicipalityFallback(t *testing.T) {
	l := newTestISSLookup()
	if got := l.GetAliquota("9999999"); got != DefaultAliquotaISS {
		t.Errorf("GetAliquota(unknown) = %v, want %v", got, DefaultAliquotaISS)
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
