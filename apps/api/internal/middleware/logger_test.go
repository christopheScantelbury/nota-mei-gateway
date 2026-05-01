package middleware_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// captureLog redirects the global zerolog logger to a buffer and returns a
// function that restores the original logger.
func captureLog(buf *bytes.Buffer) func() {
	orig := log.Logger
	log.Logger = zerolog.New(buf)
	return func() { log.Logger = orig }
}

func newApp() *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Use(middleware.RequestLogger())
	return app
}

// ── request_id propagation ────────────────────────────────────────────────────

func TestRequestLogger_GeneratesRequestID(t *testing.T) {
	app := newApp()
	app.Get("/ping", func(c *fiber.Ctx) error {
		return c.SendString(c.Locals("request_id").(string))
	})

	resp, err := app.Test(httptest.NewRequest("GET", "/ping", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	rid := strings.TrimSpace(string(body))
	if rid == "" {
		t.Fatal("expected a request_id in Fiber locals, got empty string")
	}
	if resp.Header.Get("X-Request-ID") != rid {
		t.Errorf("X-Request-ID header %q != locals %q", resp.Header.Get("X-Request-ID"), rid)
	}
}

func TestRequestLogger_HonoursInboundRequestID(t *testing.T) {
	app := newApp()
	app.Get("/ping", func(c *fiber.Ctx) error {
		return c.SendString(c.Locals("request_id").(string))
	})

	req := httptest.NewRequest("GET", "/ping", nil)
	req.Header.Set("X-Request-ID", "my-custom-id")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if strings.TrimSpace(string(body)) != "my-custom-id" {
		t.Errorf("expected request_id=my-custom-id, got %q", string(body))
	}
	if resp.Header.Get("X-Request-ID") != "my-custom-id" {
		t.Errorf("expected X-Request-ID=my-custom-id in response header")
	}
}

// ── Go context propagation ────────────────────────────────────────────────────

func TestRequestLogger_PropagatesLoggerToContext(t *testing.T) {
	app := newApp()
	app.Get("/ping", func(c *fiber.Ctx) error {
		l := zerolog.Ctx(c.UserContext())
		if l == nil {
			return c.Status(500).SendString("no logger in context")
		}
		return c.SendString("ok")
	})

	resp, err := app.Test(httptest.NewRequest("GET", "/ping", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if strings.TrimSpace(string(body)) != "ok" {
		t.Errorf("unexpected body: %q", string(body))
	}
}

// ── structured log output ─────────────────────────────────────────────────────

func TestRequestLogger_LogsStructuredJSON(t *testing.T) {
	var buf bytes.Buffer
	restore := captureLog(&buf)
	defer restore()

	app := newApp()
	app.Get("/hello", func(c *fiber.Ctx) error { return c.SendString("hi") })

	req := httptest.NewRequest("GET", "/hello", nil)
	req.Header.Set("X-Request-ID", "test-rid-123")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()

	var entry map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("log output is not valid JSON: %v\nraw: %s", err, buf.String())
	}

	checks := map[string]string{
		"request_id":  "test-rid-123",
		"method":      "GET",
		"path":        "/hello",
		"level":       "info",
	}
	for field, want := range checks {
		if got, ok := entry[field]; !ok || got != want {
			t.Errorf("log field %q: want %q, got %v", field, want, got)
		}
	}
	if _, ok := entry["duration_ms"]; !ok {
		t.Error("expected duration_ms field in log entry")
	}
	if _, ok := entry["status"]; !ok {
		t.Error("expected status field in log entry")
	}
}

// ── log level by status ───────────────────────────────────────────────────────

func TestRequestLogger_WarnOn4xx(t *testing.T) {
	var buf bytes.Buffer
	restore := captureLog(&buf)
	defer restore()

	app := newApp()
	app.Get("/missing", func(c *fiber.Ctx) error {
		return c.Status(404).SendString("not found")
	})

	resp, _ := app.Test(httptest.NewRequest("GET", "/missing", nil))
	resp.Body.Close()

	var entry map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("log is not JSON: %v", err)
	}
	if entry["level"] != "warn" {
		t.Errorf("expected level=warn for 404, got %v", entry["level"])
	}
}

func TestRequestLogger_ErrorOn5xx(t *testing.T) {
	var buf bytes.Buffer
	restore := captureLog(&buf)
	defer restore()

	app := newApp()
	app.Get("/boom", func(c *fiber.Ctx) error {
		return c.Status(500).SendString("oops")
	})

	resp, _ := app.Test(httptest.NewRequest("GET", "/boom", nil))
	resp.Body.Close()

	var entry map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("log is not JSON: %v", err)
	}
	if entry["level"] != "error" {
		t.Errorf("expected level=error for 500, got %v", entry["level"])
	}
}
