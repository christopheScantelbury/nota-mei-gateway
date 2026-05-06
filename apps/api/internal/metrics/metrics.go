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

	// XMLSecPoolActive is the current number of concurrent Sign() calls in flight.
	// Alert when this approaches XMLSEC_WORKER_POOL_SIZE (default 50).
	XMLSecPoolActive = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "xmlsec_pool_active",
		Help: "Current number of concurrent XMLDSig signing operations in flight.",
	})

	// XMLSecPoolQueueDepth is the number of goroutines waiting for a signing slot.
	// A sustained non-zero value indicates the pool size should be increased.
	XMLSecPoolQueueDepth = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "xmlsec_pool_queue_depth",
		Help: "Current number of goroutines waiting to acquire an XMLDSig worker slot.",
	})

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
