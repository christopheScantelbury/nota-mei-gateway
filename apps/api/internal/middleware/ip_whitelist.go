package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

// IPWhitelist returns a Fiber middleware that blocks any request whose IP is
// not in the allowed list.  An empty allowed list permits ALL IPs (fail-open
// is intentional so a misconfiguration doesn't lock out the admin completely —
// operators should set ADMIN_ALLOWED_IPS explicitly in production).
//
// IP comparison is exact-string: "127.0.0.1" matches only "127.0.0.1".
// Pass CIDR ranges if needed by pre-expanding them, or extend this function.
func IPWhitelist(allowed []string) fiber.Handler {
	if len(allowed) == 0 {
		// Fail-open: no list configured → allow all (log a warning at startup).
		return func(c *fiber.Ctx) error { return c.Next() }
	}

	set := make(map[string]struct{}, len(allowed))
	for _, ip := range allowed {
		set[strings.TrimSpace(ip)] = struct{}{}
	}

	return func(c *fiber.Ctx) error {
		// Prefer X-Real-IP (set by Railway / reverse proxy) over the raw socket IP.
		// Falls back to c.IP() when the header is absent.
		clientIP := c.Get("X-Real-IP")
		if clientIP == "" {
			clientIP = c.IP()
		}
		if _, ok := set[clientIP]; !ok {
			log.Warn().
				Str("ip", clientIP).
				Str("path", c.Path()).
				Msg("acesso negado: IP não autorizado para rota admin")
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error":   "FORBIDDEN",
				"message": "acesso restrito a IPs autorizados",
			})
		}
		return c.Next()
	}
}
