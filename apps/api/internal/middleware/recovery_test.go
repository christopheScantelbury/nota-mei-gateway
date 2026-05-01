package middleware_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/middleware"
	"github.com/gofiber/fiber/v2"
)

func newRecoveryApp() *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Use(middleware.PanicRecovery())
	app.Use(middleware.RequestLogger())
	return app
}

func TestPanicRecovery_Returns500JSON(t *testing.T) {
	app := newRecoveryApp()
	app.Get("/boom", func(c *fiber.Ctx) error {
		panic("something went very wrong")
	})

	resp, err := app.Test(httptest.NewRequest("GET", "/boom", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != 500 {
		t.Errorf("expected status 500, got %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("response is not JSON: %v\nraw: %s", err, body)
	}
	if payload["error"] != "INTERNAL_ERROR" {
		t.Errorf("expected error=INTERNAL_ERROR, got %v", payload["error"])
	}
	if _, ok := payload["request_id"]; !ok {
		t.Error("expected request_id field in response")
	}
}

func TestPanicRecovery_ServerRemainsAlive(t *testing.T) {
	app := newRecoveryApp()
	app.Get("/boom", func(c *fiber.Ctx) error {
		panic("oops")
	})
	app.Get("/ok", func(c *fiber.Ctx) error {
		return c.SendString("alive")
	})

	// First request panics.
	resp1, err := app.Test(httptest.NewRequest("GET", "/boom", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp1.Body.Close() }()
	if resp1.StatusCode != 500 {
		t.Errorf("expected 500 from /boom, got %d", resp1.StatusCode)
	}

	// Second request must succeed — server should still be up.
	resp2, err := app.Test(httptest.NewRequest("GET", "/ok", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp2.Body.Close() }()
	if resp2.StatusCode != 200 {
		t.Errorf("expected 200 from /ok after panic, got %d", resp2.StatusCode)
	}
}

func TestPanicRecovery_LogsStackTrace(t *testing.T) {
	var buf bytes.Buffer
	restore := captureLog(&buf)
	defer restore()

	app := newRecoveryApp()
	app.Get("/boom", func(c *fiber.Ctx) error {
		panic("test panic message")
	})

	resp, _ := app.Test(httptest.NewRequest("GET", "/boom", nil))
	defer func() { _ = resp.Body.Close() }()

	// May produce two JSON lines (recovery log + request log); find the error one.
	found := false
	for _, line := range bytes.Split(bytes.TrimSpace(buf.Bytes()), []byte("\n")) {
		var entry map[string]interface{}
		if err := json.Unmarshal(line, &entry); err != nil {
			continue
		}
		if entry["level"] == "error" && entry["message"] == "panic recovered" {
			found = true
			if entry["panic"] != "test panic message" {
				t.Errorf("expected panic field=test panic message, got %v", entry["panic"])
			}
			if _, ok := entry["stack_trace"]; !ok {
				t.Error("expected stack_trace field in log")
			}
		}
	}
	if !found {
		t.Errorf("no 'panic recovered' error log found\nlog output:\n%s", buf.String())
	}
}

func TestPanicRecovery_RequestIDInResponse(t *testing.T) {
	app := newRecoveryApp()
	app.Get("/boom", func(c *fiber.Ctx) error {
		panic("boom")
	})

	req := httptest.NewRequest("GET", "/boom", nil)
	req.Header.Set("X-Request-ID", "panic-test-rid")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, _ := io.ReadAll(resp.Body)
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("not JSON: %v", err)
	}
	if payload["request_id"] != "panic-test-rid" {
		t.Errorf("expected request_id=panic-test-rid, got %v", payload["request_id"])
	}
}
