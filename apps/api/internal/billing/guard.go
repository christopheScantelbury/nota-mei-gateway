// Package billing implements the BillingGuard that enforces monthly emission limits.
package billing

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// keyTTL is how long a billing counter key is retained in Redis after last write.
// Keys are namespaced per month (YYYY-MM), so they become unreachable after the
// month rolls over anyway; the TTL just ensures eventual garbage collection.
const keyTTL = 90 * 24 * time.Hour

// Guard checks and increments the monthly emission counter via Redis.
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

// monthKey returns the current month in YYYY-MM format for Redis key namespacing.
func monthKey() string {
	return time.Now().UTC().Format("2006-01")
}
