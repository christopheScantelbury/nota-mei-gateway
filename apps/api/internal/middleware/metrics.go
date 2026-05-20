package middleware

import (
	"strconv"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/metrics"
	"github.com/gofiber/fiber/v2"
)

// skipMetricsPaths are routes excluded from http_requests_total and
// http_request_duration_seconds. /v1/health is probed every 30 s by Railway
// (2 replicas) and /metrics is scraped by Grafana every 15 s — including them
// would inflate counters with infrastructure noise rather than real traffic.
var skipMetricsPaths = map[string]bool{
	"/v1/health": true,
	"/metrics":   true,
}

// PrometheusMetrics records http_requests_total and http_request_duration_seconds
// per request. Uses the Fiber route template (e.g. /v1/nfse/:id) as the path
// label to avoid high cardinality from raw UUIDs in the URL.
// Health-check and metrics scrape paths are excluded from instrumentation.
func PrometheusMetrics() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Skip instrumentation for infrastructure paths to keep metric cardinality
		// and counter values representative of real application traffic.
		if skipMetricsPaths[c.Path()] {
			return c.Next()
		}

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
