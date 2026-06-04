package auth

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

const (
	localsAPIKey  = "api_key"
	localsMEI     = "mei"
	localsEmpresa = "empresa"
)

// Middleware returns a Fiber handler that validates Bearer API keys and attaches
// the authenticated APIKey and either MEI or Empresa to the request context locals.
//
// Routing logic:
//   - MEI key  (mei_id != nil) → FindMEI  → c.Locals("mei",     *MEI)
//   - ME/EPP key (mei_id IS NULL) → FindEmpresa → c.Locals("empresa", *Empresa)
func Middleware(repo *Repository) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":      "INVALID_API_KEY",
				"message":    "Authorization: Bearer <key> header is required",
				"request_id": c.Locals("request_id"),
			})
		}

		rawKey := strings.TrimPrefix(authHeader, "Bearer ")
		if rawKey == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":      "INVALID_API_KEY",
				"message":    "API key is empty",
				"request_id": c.Locals("request_id"),
			})
		}

		hash := HashKey(rawKey)
		apiKey, err := repo.FindByHash(c.Context(), hash)
		if err != nil {
			log.Ctx(c.Context()).Warn().
				Str("prefix", safePrefix(rawKey)).
				Err(err).
				Msg("API key validation failed")
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":      "INVALID_API_KEY",
				"message":    "Invalid or revoked API key",
				"request_id": c.Locals("request_id"),
			})
		}

		c.Locals(localsAPIKey, apiKey)

		if apiKey.IsME() {
			// ME/EPP path — resolve via empresas table.
			empresa, err := repo.FindEmpresa(c.Context(), apiKey.EmpresaID)
			if err != nil {
				log.Ctx(c.Context()).Error().
					Str("empresa_id", apiKey.EmpresaID.String()).
					Err(err).
					Msg("empresa lookup failed")
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"error":      "INVALID_API_KEY",
					"message":    "Empresa account not found",
					"request_id": c.Locals("request_id"),
				})
			}
			c.Locals(localsEmpresa, empresa)
		} else {
			// MEI legacy path — resolve via meis table.
			mei, err := repo.FindMEI(c.Context(), apiKey.MeiID)
			if err != nil {
				log.Ctx(c.Context()).Error().
					Str("mei_id", apiKey.MeiID.String()).
					Err(err).
					Msg("MEI lookup failed")
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"error":      "INVALID_API_KEY",
					"message":    "MEI account not found",
					"request_id": c.Locals("request_id"),
				})
			}
			c.Locals(localsMEI, mei)
		}

		return c.Next()
	}
}

// GetAPIKey retrieves the authenticated APIKey from Fiber context locals.
func GetAPIKey(c *fiber.Ctx) *APIKey {
	if v, ok := c.Locals(localsAPIKey).(*APIKey); ok {
		return v
	}
	return nil
}

// GetMEI retrieves the authenticated MEI from Fiber context locals.
// Returns nil for ME/EPP requests — use GetEmpresa instead.
func GetMEI(c *fiber.Ctx) *MEI {
	if v, ok := c.Locals(localsMEI).(*MEI); ok {
		return v
	}
	return nil
}

// GetEmpresa retrieves the authenticated Empresa from Fiber context locals.
// Returns nil for MEI requests — use GetMEI instead.
func GetEmpresa(c *fiber.Ctx) *Empresa {
	if v, ok := c.Locals(localsEmpresa).(*Empresa); ok {
		return v
	}
	return nil
}

// OwnerID returns the owner UUID as a string regardless of whether the caller
// authenticated as a MEI or as an ME/EPP empresa. Empty string if neither is
// present (handlers should treat as unauthenticated and return 401).
//
// ARCH-03 invariant: for MEI users, mei.ID == empresa.ID. So this is the
// canonical key for tables that scope per-owner (nota_templates,
// nota_recorrencias, clientes) without needing two columns.
func OwnerID(c *fiber.Ctx) string {
	if mei := GetMEI(c); mei != nil {
		return mei.ID.String()
	}
	if emp := GetEmpresa(c); emp != nil {
		return emp.ID.String()
	}
	return ""
}

// safePrefix returns only the first 12 chars of a key (never the secret portion).
func safePrefix(key string) string {
	if len(key) < 12 {
		return "****"
	}
	return key[:12]
}
