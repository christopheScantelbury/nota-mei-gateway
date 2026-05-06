package middleware_test

// IPWhitelist tests inject the client IP via the X-Real-IP header because
// app.Test() doesn't plumb req.RemoteAddr into Fiber's fasthttp context —
// c.IP() would always return "0.0.0.0" in tests.
// The middleware reads X-Real-IP first (set by Railway / reverse proxy in
// production), then falls back to c.IP().

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/middleware"
	"github.com/gofiber/fiber/v2"
)

// newIPApp builds a minimal Fiber app with the IPWhitelist middleware.
func newIPApp(allowed []string) *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Use(middleware.IPWhitelist(allowed))
	app.Get("/v1/admin/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})
	return app
}

func TestIPWhitelist_AllowedIP_Returns200(t *testing.T) {
	app := newIPApp([]string{"127.0.0.1"})

	req := httptest.NewRequest(http.MethodGet, "/v1/admin/test", nil)
	req.Header.Set("X-Real-IP", "127.0.0.1")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for allowed IP, got %d", resp.StatusCode)
	}
}

func TestIPWhitelist_BlockedIP_Returns403(t *testing.T) {
	app := newIPApp([]string{"127.0.0.1"})

	req := httptest.NewRequest(http.MethodGet, "/v1/admin/test", nil)
	req.Header.Set("X-Real-IP", "10.0.0.99")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for blocked IP, got %d", resp.StatusCode)
	}
}

func TestIPWhitelist_EmptyList_FailsOpen(t *testing.T) {
	// No allowed list → all IPs allowed (fail-open)
	app := newIPApp(nil)

	req := httptest.NewRequest(http.MethodGet, "/v1/admin/test", nil)
	req.Header.Set("X-Real-IP", "1.2.3.4")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for empty list (fail-open), got %d", resp.StatusCode)
	}
}

func TestIPWhitelist_MultipleAllowedIPs(t *testing.T) {
	app := newIPApp([]string{"10.0.0.1", "10.0.0.2", "192.168.1.100"})

	for _, ip := range []string{"10.0.0.1", "10.0.0.2", "192.168.1.100"} {
		req := httptest.NewRequest(http.MethodGet, "/v1/admin/test", nil)
		req.Header.Set("X-Real-IP", ip)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("app.Test(%s): %v", ip, err)
		}
		_ = resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected 200 for allowed IP %s, got %d", ip, resp.StatusCode)
		}
	}
}

func TestIPWhitelist_MultipleAllowedIPs_BlocksOthers(t *testing.T) {
	app := newIPApp([]string{"10.0.0.1"})

	req := httptest.NewRequest(http.MethodGet, "/v1/admin/test", nil)
	req.Header.Set("X-Real-IP", "10.0.0.2")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}

func TestIPWhitelist_BlockedResponse_HasErrorField(t *testing.T) {
	app := newIPApp([]string{"127.0.0.1"})

	req := httptest.NewRequest(http.MethodGet, "/v1/admin/test", nil)
	req.Header.Set("X-Real-IP", "9.9.9.9")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		t.Error("expected Content-Type header in 403 response")
	}
}
