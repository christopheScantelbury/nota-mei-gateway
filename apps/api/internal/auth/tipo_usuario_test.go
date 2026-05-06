package auth

import "testing"

func TestSanitizeTipoUsuario(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{input: "mei", want: "mei"},
		{input: "gateway", want: "gateway"},
		// Empty string (field omitted) → normalised to "gateway"
		{input: "", want: "gateway"},
		// Unknown values → normalised to "gateway"
		{input: "outro", want: "gateway"},
		{input: "MEI", want: "gateway"},
		{input: "GATEWAY", want: "gateway"},
		{input: "invalid", want: "gateway"},
	}

	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			got := SanitizeTipoUsuario(tc.input)
			if got != tc.want {
				t.Errorf("SanitizeTipoUsuario(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}
