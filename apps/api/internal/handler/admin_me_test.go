package handler

// ─── csvEscape ────────────────────────────────────────────────────────────────
// These tests live in the `handler` package (white-box) because csvEscape is
// unexported.  AdminRelatorioMEHandler requires a live pgx pool and is tested
// via integration / E2E tests.

import "testing"

func TestCSVEscape_PlainString_Unchanged(t *testing.T) {
	got := csvEscape("Empresa Simples Ltda")
	want := "Empresa Simples Ltda"
	if got != want {
		t.Fatalf("csvEscape(%q) = %q, want %q", "Empresa Simples Ltda", got, want)
	}
}

func TestCSVEscape_ContainsComma_Quoted(t *testing.T) {
	got := csvEscape("Empresa, Razão Social Ltda")
	want := `"Empresa, Razão Social Ltda"`
	if got != want {
		t.Fatalf("csvEscape with comma = %q, want %q", got, want)
	}
}

func TestCSVEscape_ContainsDoubleQuote_EscapedAndQuoted(t *testing.T) {
	got := csvEscape(`Empresa "Top" Ltda`)
	want := `"Empresa ""Top"" Ltda"`
	if got != want {
		t.Fatalf("csvEscape with quote = %q, want %q", got, want)
	}
}

func TestCSVEscape_CommaAndQuote_BothHandled(t *testing.T) {
	got := csvEscape(`Foo, "Bar" Ltda`)
	want := `"Foo, ""Bar"" Ltda"`
	if got != want {
		t.Fatalf("csvEscape with comma+quote = %q, want %q", got, want)
	}
}

func TestCSVEscape_EmptyString_Unchanged(t *testing.T) {
	got := csvEscape("")
	if got != "" {
		t.Fatalf("csvEscape(\"\") = %q, want empty", got)
	}
}

func TestCSVEscape_OnlyComma_Quoted(t *testing.T) {
	got := csvEscape(",")
	want := `","`
	if got != want {
		t.Fatalf("csvEscape(\",\") = %q, want %q", got, want)
	}
}
