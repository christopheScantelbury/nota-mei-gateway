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

	// CertCacheHitsTotal counts cert cache hits (AWS SM call avoided).
	// A high hit rate (>95 %) indicates the cache is working correctly.
	CertCacheHitsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "cert_cache_hits_total",
		Help: "Total number of A1 certificate cache hits (AWS SM call avoided).",
	})

	// CertCacheMissesTotal counts cert cache misses (AWS SM was called).
	// Expected on first access per ARN and after UpdateCert invalidation.
	CertCacheMissesTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "cert_cache_misses_total",
		Help: "Total number of A1 certificate cache misses (AWS SM was called).",
	})
)
