package document

import (
	"errors"
	"testing"
)

// ─── normalizeNBS ─────────────────────────────────────────────────────────────

func TestNormalizeNBS_DottedFormat(t *testing.T) {
	got := normalizeNBS("01.01.01.10")
	if got != "01010110" {
		t.Errorf("normalizeNBS(%q) = %q, want %q", "01.01.01.10", got, "01010110")
	}
}

func TestNormalizeNBS_DigitsFormat(t *testing.T) {
	got := normalizeNBS("01010110")
	if got != "01010110" {
		t.Errorf("normalizeNBS(%q) = %q, want %q", "01010110", got, "01010110")
	}
}

func TestNormalizeNBS_InvalidFormats(t *testing.T) {
	cases := []string{
		"",
		"01.01.01",
		"0101011",   // 7 digits
		"010101100", // 9 digits
		"XX.XX.XX.XX",
		"01.01.01.1X",
		"01-01-01-10",
	}
	for _, c := range cases {
		if got := normalizeNBS(c); got != "" {
			t.Errorf("normalizeNBS(%q) = %q, want empty string", c, got)
		}
	}
}

// ─── ErrInvalidNBS ────────────────────────────────────────────────────────────

func TestErrInvalidNBS_IsDistinctError(t *testing.T) {
	if ErrInvalidNBS == nil {
		t.Fatal("ErrInvalidNBS must not be nil")
	}
	other := errors.New("other error")
	if errors.Is(other, ErrInvalidNBS) {
		t.Error("unrelated error should not match ErrInvalidNBS")
	}
}
