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
	// Custom buckets sized for a fiscal API where endpoints that call the
	// Receita Federal (mTLS + XML) regularly take 2-10 s. The default Prometheus
	// buckets start at 5 ms and have poor resolution above 1 s, making p99
	// and p999 charts nearly useless for the NFS-e emission path.
	HTTPRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request latency in seconds.",
		Buckets: []float64{0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30},
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

	// WebhookDeliveredTotal counts successfully delivered webhook HTTP POSTs.
	// A low ratio vs WebhookFailedTotal signals customer endpoint problems.
	WebhookDeliveredTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "webhook_delivered_total",
		Help: "Total number of webhook HTTP POSTs successfully delivered to customer endpoints.",
	})

	// WebhookFailedTotal counts failed webhook delivery attempts (non-2xx or network error).
	// Alert when this exceeds ~5 % of WebhookDeliveredTotal in a rolling window.
	WebhookFailedTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "webhook_failed_total",
		Help: "Total number of failed webhook delivery attempts (all retry stages combined).",
	})

	// WebhookExhaustedTotal counts notas whose webhooks were abandoned after all retries.
	// Should always be near zero — alert immediately on any increment.
	WebhookExhaustedTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "webhook_exhausted_total",
		Help: "Total number of notas whose webhook delivery was abandoned after all retry attempts.",
	})

	// PollerSweepDuration tracks how long each NFS-e poller sweep takes end-to-end.
	// Useful to detect when Receita Federal is slow or the nota backlog is growing.
	PollerSweepDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "poller_sweep_duration_seconds",
		Help:    "Duration of a single NFS-e poller sweep (query + all Receita Federal calls).",
		Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30, 60},
	})

	// PollerNotasProcessed counts notas finalised per sweep (AUTORIZADA + REJEITADA).
	PollerNotasProcessed = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "poller_notas_processed_total",
		Help: "Total number of notas finalized by the NFS-e poller.",
	}, []string{"result"}) // result: "autorizada" | "rejeitada" | "erro"

	// BillingGuardChecksTotal counts billing guard evaluations (ME/EPP path).
	// Labels: result = "allowed" | "limit_reached" | "fail_open"
	BillingGuardChecksTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "billing_guard_checks_total",
		Help: "Total number of billing guard Check() evaluations.",
	}, []string{"result"})
)
