package handler

import (
	"testing"
)

// Package handler white-box tests — access unexported symbols directly.

// ─── issRetidoPtr ─────────────────────────────────────────────────────────────

func TestIssRetidoPtr_SimplesNacionalMEI_ReturnsNil(t *testing.T) {
	got := issRetidoPtr("SIMPLES_MEI", true)
	if got != nil {
		t.Fatalf("expected nil for SIMPLES_MEI, got %v", *got)
	}
}

func TestIssRetidoPtr_SimplesNacional_ReturnsNil(t *testing.T) {
	got := issRetidoPtr("SIMPLES_NACIONAL", false)
	if got != nil {
		t.Fatalf("expected nil for SIMPLES_NACIONAL, got %v", *got)
	}
}

func TestIssRetidoPtr_EmptyRegime_ReturnsNil(t *testing.T) {
	got := issRetidoPtr("", true)
	if got != nil {
		t.Fatalf("expected nil for empty regime, got %v", *got)
	}
}

func TestIssRetidoPtr_LucroPresumido_True(t *testing.T) {
	got := issRetidoPtr("LUCRO_PRESUMIDO", true)
	if got == nil {
		t.Fatal("expected non-nil pointer for LUCRO_PRESUMIDO")
	}
	if !*got {
		t.Fatalf("expected true, got false")
	}
}

func TestIssRetidoPtr_LucroPresumido_False(t *testing.T) {
	got := issRetidoPtr("LUCRO_PRESUMIDO", false)
	if got == nil {
		t.Fatal("expected non-nil pointer for LUCRO_PRESUMIDO")
	}
	if *got {
		t.Fatalf("expected false, got true")
	}
}

func TestIssRetidoPtr_LucroReal_True(t *testing.T) {
	got := issRetidoPtr("LUCRO_REAL", true)
	if got == nil {
		t.Fatal("expected non-nil pointer for LUCRO_REAL")
	}
	if !*got {
		t.Fatalf("expected true, got false")
	}
}

func TestIssRetidoPtr_LucroReal_False(t *testing.T) {
	got := issRetidoPtr("LUCRO_REAL", false)
	if got == nil {
		t.Fatal("expected non-nil pointer for LUCRO_REAL")
	}
	if *got {
		t.Fatalf("expected false, got true")
	}
}

// Verify that the returned pointer is a fresh allocation (no aliasing).
func TestIssRetidoPtr_ReturnsFreshPointer(t *testing.T) {
	p1 := issRetidoPtr("LUCRO_PRESUMIDO", true)
	p2 := issRetidoPtr("LUCRO_PRESUMIDO", true)
	if p1 == p2 {
		t.Fatal("expected distinct pointer allocations")
	}
}
