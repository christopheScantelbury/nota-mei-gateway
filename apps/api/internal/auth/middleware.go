package auth

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

const (
	localsAPIKey = "api_key"
	localsMEI    = "mei"
)

// Middleware returns a Fiber handler that validates Bearer API keys and attaches
// the authenticated APIKey and MEI to the request context locals.
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

		c.Locals(localsAPIKey, apiKey)
		c.Locals(localsMEI, mei)
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
func GetMEI(c *fiber.Ctx) *MEI {
	if v, ok := c.Locals(localsMEI).(*MEI); ok {
		return v
	}
	return nil
}

// safePrefix returns only the first 12 chars of a key (never the secret portion).
func safePrefix(key string) string {
	if len(key) < 12 {
		return "****"
	}
	return key[:12]
}
