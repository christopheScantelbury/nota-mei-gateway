package middleware

import (
	"fmt"
	"runtime/debug"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

// PanicRecovery catches any panic in downstream handlers, logs the full stack
// trace at ERROR level (visible in Railway logs), and returns a structured
// JSON 500 response. Must be registered before RequestLogger so it wraps the
// entire request chain.
func PanicRecovery() fiber.Handler {
	return func(c *fiber.Ctx) (err error) {
		defer func() {
			r := recover()
			if r == nil {
				return
			}

			stack := debug.Stack()
			requestID, _ := c.Locals("request_id").(string)

			// Use the request-scoped logger when available (set by RequestLogger).
			logger := log.Ctx(c.UserContext())
			logger.Error().
				Str("panic", fmt.Sprintf("%v", r)).
				Bytes("stack_trace", stack).
				Msg("panic recovered")

			err = c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":      "INTERNAL_ERROR",
				"message":    "internal server error",
				"request_id": requestID,
			})
		}()

		return c.Next()
	}
}
