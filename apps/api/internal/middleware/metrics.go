package middleware

import (
	"strconv"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/metrics"
	"github.com/gofiber/fiber/v2"
)

// PrometheusMetrics records http_requests_total and http_request_duration_seconds
// per request. Uses the Fiber route template (e.g. /v1/nfse/:id) as the path
// label to avoid high cardinality from raw UUIDs in the URL.
func PrometheusMetrics() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		err := c.Next()

		path := c.Route().Path
		if path == "" {
			path = c.Path()
		}
		method := c.Method()
		status := strconv.Itoa(c.Response().StatusCode())
		dur := time.Since(start).Seconds()

		metrics.HTTPRequestsTotal.WithLabelValues(method, path, status).Inc()
		metrics.HTTPRequestDuration.WithLabelValues(method, path, status).Observe(dur)

		return err
	}
}
