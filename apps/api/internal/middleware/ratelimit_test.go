package middleware_test

import (
	"context"
	"net/http/httptest"
	"strconv"
	"sync/atomic"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// stubCounter is an in-memory counter that satisfies the counter interface
// used internally by RateLimiter (accessed via middleware.NewRateLimiterWithCounter).
type stubCounter struct {
	n atomic.Int64
}

func (s *stubCounter) Increment(_ context.Context, _ string) (int64, error) {
	return s.n.Add(1), nil
}

func newRateLimitApp(limit int, ctr middleware.Counter) *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})

	// Inject a fake APIKey into locals BEFORE the rate limiter runs,
	// mirroring production middleware order (auth → rate limit → handler).
	app.Use(func(c *fiber.Ctx) error {
		if c.Get("X-Test-Auth") == "1" {
			c.Locals("api_key", &auth.APIKey{
				ID:        uuid.New(),
				MeiID:     uuid.New(),
				KeyHash:   "testhash",
				KeyPrefix: "sk_test_",
			})
		}
		return c.Next()
	})

	rl := middleware.NewRateLimiterWithCounter(ctr, limit)
	app.Use(rl.Middleware())

	app.Get("/v1/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})
	return app
}

func TestRateLimit_AllowsWithinLimit(t *testing.T) {
	ctr := &stubCounter{}
	app := newRateLimitApp(100, ctr)

	req := httptest.NewRequest("GET", "/v1/test", nil)
	req.Header.Set("X-Test-Auth", "1")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
}

func TestRateLimit_BlocksOverLimit(t *testing.T) {
	ctr := &stubCounter{}
	// Pre-fill counter so next call is over limit.
	for i := 0; i < 100; i++ {
		_, _ = ctr.Increment(context.Background(), "x")
	}
	app := newRateLimitApp(100, ctr)

	req := httptest.NewRequest("GET", "/v1/test", nil)
	req.Header.Set("X-Test-Auth", "1")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != 429 {
		t.Errorf("status = %d, want 429", resp.StatusCode)
	}
	if resp.Header.Get("Retry-After") != "60" {
		t.Errorf("Retry-After = %q, want 60", resp.Header.Get("Retry-After"))
	}
}

func TestRateLimit_SetsRateLimitHeaders(t *testing.T) {
	ctr := &stubCounter{}
	const limit = 50
	app := newRateLimitApp(limit, ctr)

	req := httptest.NewRequest("GET", "/v1/test", nil)
	req.Header.Set("X-Test-Auth", "1")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.Header.Get("X-RateLimit-Limit") != strconv.Itoa(limit) {
		t.Errorf("X-RateLimit-Limit = %q, want %d", resp.Header.Get("X-RateLimit-Limit"), limit)
	}
	if resp.Header.Get("X-RateLimit-Remaining") == "" {
		t.Error("X-RateLimit-Remaining header missing")
	}
	if resp.Header.Get("X-RateLimit-Reset") == "" {
		t.Error("X-RateLimit-Reset header missing")
	}
}

func TestRateLimit_SkipsUnauthenticated(t *testing.T) {
	ctr := &stubCounter{}
	// Over limit — but no auth header, so middleware should pass through.
	for i := 0; i < 200; i++ {
		_, _ = ctr.Increment(context.Background(), "x")
	}
	app := newRateLimitApp(10, ctr)

	req := httptest.NewRequest("GET", "/v1/test", nil) // no X-Test-Auth
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != 200 {
		t.Errorf("unauthenticated request should not be rate limited, got %d", resp.StatusCode)
	}
}

func TestRateLimit_RemainingDecrementsCorrectly(t *testing.T) {
	ctr := &stubCounter{}
	const limit = 10
	app := newRateLimitApp(limit, ctr)

	req := httptest.NewRequest("GET", "/v1/test", nil)
	req.Header.Set("X-Test-Auth", "1")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()

	remaining, _ := strconv.Atoi(resp.Header.Get("X-RateLimit-Remaining"))
	if remaining != limit-1 {
		t.Errorf("X-RateLimit-Remaining = %d, want %d", remaining, limit-1)
	}
}
