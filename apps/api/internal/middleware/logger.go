package middleware

import (
	"errors"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// skipLogPaths are routes that generate high-frequency noise without
// diagnostic value. Railway probes /v1/health every 30 s (2 replicas = 5 760
// calls/day); Grafana scrapes /metrics every 15 s. Logging them would drown
// out real application events.
var skipLogPaths = map[string]bool{
	"/v1/health": true,
	"/metrics":   true,
}

// RequestLogger logs every request in structured JSON and propagates the
// request_id via both Fiber locals and the Go context (zerolog.Ctx).
// Health-check and metrics scrape paths are skipped to avoid log noise.
func RequestLogger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Always propagate request_id — even for skipped paths — so handlers
		// can attach it to errors without an extra nil-check.
		requestID := c.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("X-Request-ID", requestID)
		c.Locals("request_id", requestID)

		logger := log.With().Str("request_id", requestID).Logger()
		c.SetUserContext(logger.WithContext(c.UserContext()))

		// Skip structured logging for high-frequency infrastructure paths.
		if skipLogPaths[c.Path()] {
			return c.Next()
		}

		start := time.Now()
		err := c.Next()

		// When c.Next() returns a non-nil error, Fiber's ErrorHandler runs AFTER
		// this middleware and is what actually sets the status code. Derive the
		// final status from the error to avoid logging 200 for 4xx/5xx responses.
		status := c.Response().StatusCode()
		if err != nil {
			var fe *fiber.Error
			if errors.As(err, &fe) {
				status = fe.Code
			} else if status < 400 {
				status = fiber.StatusInternalServerError
			}
		}
		dur := time.Since(start)

		event := logEvent(&logger, status)
		event.
			Str("method", c.Method()).
			Str("path", c.Path()).
			Str("ip", c.IP()).
			Int("status", status).
			Int("body_bytes", len(c.Response().Body())).
			Dur("duration_ms", dur)
		// Include the error chain on failures so we don't have to guess at
		// what went wrong from a generic "INTERNAL_ERROR" response body.
		if err != nil {
			event = event.Err(err)
		}
		event.Msgf("%s %s %d", c.Method(), c.Path(), status)

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
