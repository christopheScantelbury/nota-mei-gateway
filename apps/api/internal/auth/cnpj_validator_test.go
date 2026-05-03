package auth

import "testing"

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
