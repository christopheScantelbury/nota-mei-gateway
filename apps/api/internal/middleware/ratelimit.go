package middleware

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
)

// Counter is the minimal Redis interface needed by the rate limiter.
// Exported so tests can inject a stub without a real Redis instance.
type Counter interface {
	// Increment atomically increments key and sets its TTL on first write.
	// Returns the new count after increment.
	Increment(ctx context.Context, key string) (int64, error)
}

// redisCounter wraps a real Redis client to satisfy the Counter interface.
type redisCounter struct {
	rdb *redis.Client
	ttl time.Duration
}

func (r *redisCounter) Increment(ctx context.Context, key string) (int64, error) {
	pipe := r.rdb.Pipeline()
	incrCmd := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, r.ttl)
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, err
	}
	return incrCmd.Result()
}

// RateLimiter enforces a fixed-window per-minute limit per API key via Redis.
type RateLimiter struct {
	ctr   Counter
	limit int
}

// NewRateLimiter parses redisURL and returns a RateLimiter with the given
// requests-per-minute limit. If limit <= 0 the default of 100 req/min is used.
// Prefer NewRateLimiterFromClient when a shared *redis.Client already exists.
func NewRateLimiter(redisURL string, limit int) (*RateLimiter, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 100
	}
	return &RateLimiter{
		ctr:   &redisCounter{rdb: redis.NewClient(opt), ttl: 2 * time.Minute},
		limit: limit,
	}, nil
}

// NewRateLimiterFromClient returns a RateLimiter backed by the provided client.
// Use this to avoid opening a separate connection pool when a shared client exists.
func NewRateLimiterFromClient(rdb *redis.Client, limit int) *RateLimiter {
	if limit <= 0 {
		limit = 100
	}
	return &RateLimiter{
		ctr:   &redisCounter{rdb: rdb, ttl: 2 * time.Minute},
		limit: limit,
	}
}

// NewRateLimiterWithCounter creates a RateLimiter using the provided Counter
// implementation. Intended for testing with in-memory stubs.
func NewRateLimiterWithCounter(ctr Counter, limit int) *RateLimiter {
	if limit <= 0 {
		limit = 100
	}
	return &RateLimiter{ctr: ctr, limit: limit}
}

// Middleware returns a Fiber handler that rate-limits authenticated requests by
// API key. Public endpoints (no Bearer auth) are always allowed through.
// On Redis failure the middleware fails open so a Redis outage does not
// take down the API.
func (rl *RateLimiter) Middleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		apiKey := auth.GetAPIKey(c)
		if apiKey == nil {
			return c.Next()
		}

		// Fixed window keyed to the current UTC minute + key hash.
		window := time.Now().UTC().Format("2006-01-02T15:04")
		key := fmt.Sprintf("rl:%s:%s", apiKey.KeyHash, window)

		count, err := rl.ctr.Increment(c.Context(), key)
		if err != nil {
			// Fail open — Redis outage must not block the API.
			return c.Next()
		}

		remaining := rl.limit - int(count)
		if remaining < 0 {
			remaining = 0
		}
		reset := nextMinute()

		c.Set("X-RateLimit-Limit", strconv.Itoa(rl.limit))
		c.Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Set("X-RateLimit-Reset", strconv.FormatInt(reset, 10))

		if int(count) > rl.limit {
			c.Set("Retry-After", "60")
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":      "RATE_LIMIT_EXCEEDED",
				"message":    "muitas requisições — tente novamente em 60 segundos",
				"request_id": c.Locals("request_id"),
			})
		}

		return c.Next()
	}
}

// nextMinute returns a Unix timestamp for the start of the next UTC minute.
func nextMinute() int64 {
	now := time.Now().UTC()
	return now.Truncate(time.Minute).Add(time.Minute).Unix()
}
