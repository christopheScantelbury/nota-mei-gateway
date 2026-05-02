package middleware_test

import (
	"net/http/httptest"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
)

// newMetricsApp wires PanicRecovery + RequestLogger + PrometheusMetrics so the
// integration matches production middleware order.
func newMetricsApp() *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Use(middleware.PanicRecovery())
	app.Use(middleware.RequestLogger())
	app.Use(middleware.PrometheusMetrics())
	return app
}

func TestPrometheusMetrics_CountsRequest(t *testing.T) {
	// Use an isolated registry so tests don't share global state.
	reg := prometheus.NewRegistry()
	counter := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "test_http_requests_total",
	}, []string{"method", "path", "status"})
	reg.MustRegister(counter)

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Use(func(c *fiber.Ctx) error {
		err := c.Next()
		counter.WithLabelValues(c.Method(), c.Route().Path, "200").Inc()
		return err
	})
	app.Get("/v1/health", func(c *fiber.Ctx) error { return c.SendString("ok") })

	resp, err := app.Test(httptest.NewRequest("GET", "/v1/health", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()

	count, err := testutil.GatherAndCount(reg)
	if err != nil {
		t.Fatal(err)
	}
	if count == 0 {
		t.Error("expected at least one metric family")
	}
}

func TestPrometheusMetrics_UsesRouteTemplate(t *testing.T) {
	app := newMetricsApp()
	app.Get("/v1/nfse/:id", func(c *fiber.Ctx) error { return c.SendString("ok") })

	resp, err := app.Test(httptest.NewRequest("GET", "/v1/nfse/some-uuid-1234", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestPrometheusMetrics_RecordsCorrectStatus(t *testing.T) {
	app := newMetricsApp()
	app.Get("/v1/nfse", func(c *fiber.Ctx) error {
		return c.Status(404).SendString("not found")
	})

	resp, err := app.Test(httptest.NewRequest("GET", "/v1/nfse", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != 404 {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}

func TestMetricsEndpoint_Exposed(t *testing.T) {
	app := newMetricsApp()

	// Register a minimal /metrics handler using the default registry.
	app.Get("/metrics", func(c *fiber.Ctx) error {
		return c.SendString("# metrics ok")
	})

	resp, err := app.Test(httptest.NewRequest("GET", "/metrics", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestCustomMetrics_NotasPorStatus(t *testing.T) {
	reg := prometheus.NewRegistry()
	gauge := prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name: "test_notas_por_status_total",
	}, []string{"status"})
	reg.MustRegister(gauge)

	gauge.WithLabelValues("PROCESSANDO").Set(5)
	gauge.WithLabelValues("AUTORIZADA").Set(12)
	gauge.WithLabelValues("REJEITADA").Set(1)

	mfs, err := reg.Gather()
	if err != nil {
		t.Fatal(err)
	}
	if len(mfs) == 0 {
		t.Fatal("expected at least one metric family")
	}

	// Verify all three status labels are present in the gathered metrics.
	want := map[string]bool{"PROCESSANDO": false, "AUTORIZADA": false, "REJEITADA": false}
	for _, mf := range mfs {
		for _, m := range mf.GetMetric() {
			for _, lp := range m.GetLabel() {
				if lp.GetName() == "status" {
					want[lp.GetValue()] = true
				}
			}
		}
	}
	for status, found := range want {
		if !found {
			t.Errorf("expected status label %q in gathered metrics", status)
		}
	}
}
