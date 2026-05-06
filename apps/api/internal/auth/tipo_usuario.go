package auth

// SanitizeTipoUsuario normalises the tipo_usuario field:
// only "mei" and "gateway" are valid values; anything else — including an
// empty string — is coerced to "gateway".
func SanitizeTipoUsuario(v string) string {
	if v == "mei" || v == "gateway" {
		return v
	}
	return "gateway"
}
