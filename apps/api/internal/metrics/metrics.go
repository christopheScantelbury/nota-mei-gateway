package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// HTTPRequestsTotal counts every HTTP request by method, normalised route
	// path and response status code.
	HTTPRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total number of HTTP requests.",
	}, []string{"method", "path", "status"})

	// HTTPRequestDuration tracks latency percentiles per route.
	HTTPRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request latency in seconds.",
		Buckets: prometheus.DefBuckets,
	}, []string{"method", "path", "status"})

	// NotasPorStatus tracks the current number of NFS-e per status.
	NotasPorStatus = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "notas_por_status_total",
		Help: "Current number of NFS-e per status.",
	}, []string{"status"})

	// StripeEventsTotal counts processed Stripe webhook events by type.
	StripeEventsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "stripe_events_total",
		Help: "Total number of processed Stripe webhook events.",
	}, []string{"tipo"})
)
