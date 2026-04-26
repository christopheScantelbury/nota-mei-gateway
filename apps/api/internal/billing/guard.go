// Package billing implements the BillingGuard that enforces monthly emission limits.
package billing

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

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
func (g *Guard) Allow(ctx context.Context, meiID uuid.UUID, limit int) (bool, error) {
	key := fmt.Sprintf("billing:%s:%s", meiID, monthKey())
	count, err := g.rdb.Incr(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return int(count) <= limit, nil
}

// monthKey returns the current month in YYYY-MM format for Redis key namespacing.
func monthKey() string {
	return time.Now().UTC().Format("2006-01")
}
