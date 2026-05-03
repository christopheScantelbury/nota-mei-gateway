// Package billing implements the BillingGuard that enforces monthly emission limits
// and caches Stripe subscription status to avoid database round-trips on every request.
package billing

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// keyTTL is how long a billing counter key is retained in Redis after last write.
// Keys are namespaced per month (YYYY-MM), so they become unreachable after the
// month rolls over anyway; the TTL just ensures eventual garbage collection.
const keyTTL = 90 * 24 * time.Hour

// subCacheTTL is the Redis TTL for the Stripe subscription-status cache.
// Stripe webhooks invalidate the cache immediately; TTL is a safety net for
// cases where a webhook is delayed or missed.
const subCacheTTL = 5 * time.Minute

// BlockedSubscriptionStatuses is the set of Stripe subscription statuses that
// must be blocked from emitting new notes.  A nil / absent status (trial or
// new user without a subscription) is allowed through.
var BlockedSubscriptionStatuses = map[string]bool{
	"past_due":           true,
	"canceled":           true,
	"unpaid":             true,
	"incomplete_expired": true,
}

// Guard checks and increments the monthly emission counter via Redis and
// caches the MEI's Stripe subscription status to gate access.
type Guard struct {
	rdb *redis.Client
}

// NewGuard parses redisURL and returns a Guard backed by that Redis instance.
func NewGuard(redisURL string) (*Guard, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	return &Guard{rdb: redis.NewClient(opt)}, nil
}

// Allow atomically increments the MEI's emission counter for the current month
// and returns true if the new count is within the given limit.
// The Redis key expires automatically after keyTTL to avoid accumulation.
func (g *Guard) Allow(ctx context.Context, meiID uuid.UUID, limit int) (bool, error) {
	if g == nil {
		// Guard unavailable (Redis not connected) — allow all emissions.
		return true, nil
	}
	key := fmt.Sprintf("billing:%s:%s", meiID, monthKey())

	pipe := g.rdb.Pipeline()
	incrCmd := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, keyTTL)

	if _, err := pipe.Exec(ctx); err != nil {
		return false, err
	}

	count, err := incrCmd.Result()
	if err != nil {
		return false, err
	}
	return int(count) <= limit, nil
}

// ── Stripe subscription status cache ─────────────────────────────────────────

// CacheSubscriptionStatus stores the MEI's Stripe subscription status in Redis
// with a 5-minute TTL.  Call this after reading the status from the database so
// that subsequent requests avoid a DB round-trip.
func (g *Guard) CacheSubscriptionStatus(ctx context.Context, meiID uuid.UUID, status string) error {
	if g == nil {
		return nil
	}
	key := subStatusKey(meiID)
	// Store a sentinel for "no subscription" (nil/empty) so we can distinguish
	// a cache miss from an explicit nil entry.
	val := status
	if val == "" {
		val = "none"
	}
	return g.rdb.Set(ctx, key, val, subCacheTTL).Err()
}

// GetCachedSubscriptionStatus returns the cached Stripe subscription status
// for the given MEI.  Returns ("", false) on cache miss or Redis error.
// Returns ("", true) when the MEI has no subscription (status "none").
func (g *Guard) GetCachedSubscriptionStatus(ctx context.Context, meiID uuid.UUID) (string, bool) {
	if g == nil {
		return "", false
	}
	val, err := g.rdb.Get(ctx, subStatusKey(meiID)).Result()
	if err != nil {
		if !errors.Is(err, redis.Nil) {
			// Redis error — treat as miss to avoid blocking the request.
			return "", false
		}
		return "", false
	}
	if val == "none" {
		return "", true
	}
	return val, true
}

// InvalidateSubscriptionCache removes the cached Stripe subscription status for
// the given MEI.  Call this from the Stripe webhook handler whenever a
// subscription event is processed so the next request re-reads from the DB.
func (g *Guard) InvalidateSubscriptionCache(ctx context.Context, meiID uuid.UUID) error {
	if g == nil {
		return nil
	}
	return g.rdb.Del(ctx, subStatusKey(meiID)).Err()
}

// subStatusKey returns the Redis key for the Stripe subscription status cache.
// It is intentionally NOT month-scoped because the subscription status spans months;
// it gets invalidated by webhooks and expires after subCacheTTL.
func subStatusKey(meiID uuid.UUID) string {
	return fmt.Sprintf("billing:stripe-status:%s", meiID)
}

// monthKey returns the current month in YYYY-MM format for Redis key namespacing.
func monthKey() string {
	return time.Now().UTC().Format("2006-01")
}
