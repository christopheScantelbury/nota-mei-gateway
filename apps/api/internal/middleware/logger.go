package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// RequestLogger logs every request in structured JSON and propagates the
// request_id via both Fiber locals and the Go context (zerolog.Ctx).
func RequestLogger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		// Honour forwarded request ID (e.g. from a load balancer) or generate one.
		requestID := c.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("X-Request-ID", requestID)
		c.Locals("request_id", requestID)

		// Attach child logger to the Go context so handlers can use log.Ctx(ctx).
		logger := log.With().Str("request_id", requestID).Logger()
		c.SetUserContext(logger.WithContext(c.UserContext()))

		err := c.Next()

		status := c.Response().StatusCode()
		dur := time.Since(start)

		event := logEvent(&logger, status)
		event.
			Str("method", c.Method()).
			Str("path", c.Path()).
			Int("status", status).
			Dur("duration_ms", dur).
			Msg("request")

		return err
	}
}

func logEvent(logger *zerolog.Logger, status int) *zerolog.Event {
	switch {
	case status >= 500:
		return logger.Error()
	case status >= 400:
		return logger.Warn()
	default:
		return logger.Info()
	}
}
