package auth

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

// HybridMiddleware accepts EITHER an `sk_…` API key OR a Supabase Auth JWT in
// the Authorization header, and resolves the same fiber locals as the regular
// API key middleware (auth.GetMEI / auth.GetEmpresa).
//
// Use it on endpoints that need to be callable from both:
//   - B2B integrations (API key — long-lived, sk_live_/sk_test_)
//   - The Nota Fácil dashboard (Supabase Auth session — short-lived JWT)
//
// Detection is by prefix: tokens starting with `sk_` are tried as API keys;
// everything else is validated as a JWT. JWTs are forwarded to Supabase Auth
// for verification.
//
// On JWT success we look up the empresa first (since the multi_produto
// migration, every user.id corresponds to an empresas row); if none exists we
// fall back to the legacy meis path. Either way we set the same locals so the
// downstream handler does not need to care which auth path was used.
func HybridMiddleware(repo *Repository, supabaseURL, serviceRoleKey string) fiber.Handler {
	apiKeyMW := Middleware(repo)

	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":      "INVALID_AUTH",
				"message":    "Authorization: Bearer <key|jwt> header is required",
				"request_id": c.Locals("request_id"),
			})
		}
		token := strings.TrimPrefix(authHeader, "Bearer ")

		// Route by prefix. API keys always start with `sk_` (sk_live_ / sk_test_).
		if strings.HasPrefix(token, "sk_") {
			return apiKeyMW(c)
		}

		// JWT path — validate against Supabase Auth.
		if supabaseURL == "" || serviceRoleKey == "" {
			log.Ctx(c.UserContext()).Error().Msg("hybrid auth: JWT path requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":      "INTERNAL_ERROR",
				"message":    "JWT auth not configured",
				"request_id": c.Locals("request_id"),
			})
		}
		userID, err := validateJWT(c.Context(), supabaseURL, serviceRoleKey, token)
		if err != nil {
			log.Ctx(c.UserContext()).Warn().Err(err).Msg("hybrid auth: JWT validation failed")
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":      "INVALID_JWT",
				"message":    "Invalid or expired session",
				"request_id": c.Locals("request_id"),
			})
		}

		// Resolve empresa (preferred — single source of truth post-multi_produto).
		// empresa.id == user.id by registration invariant.
		empresa, errE := repo.FindEmpresa(c.Context(), userID)
		if errE == nil {
			c.Locals(localsEmpresa, empresa)
			return c.Next()
		}

		// Fallback to legacy meis lookup for accounts created before ARCH-03.
		mei, errM := repo.FindMEI(c.Context(), userID)
		if errM == nil {
			c.Locals(localsMEI, mei)
			return c.Next()
		}

		log.Ctx(c.UserContext()).Error().
			Str("user_id", userID.String()).
			Err(errE).
			AnErr("mei_err", errM).
			Msg("hybrid auth: user has no MEI/Empresa row")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":      "NO_ACCOUNT",
			"message":    "Account not found for this session",
			"request_id": c.Locals("request_id"),
		})
	}
}
