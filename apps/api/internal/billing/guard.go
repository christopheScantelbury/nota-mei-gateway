package billing

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// Guard checks and increments the monthly emission counter via Redis.
type Guard struct {
	rdb *redis.Client
}

func NewGuard(redisURL string) (*Guard, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	return &Guard{rdb: redis.NewClient(opt)}, nil
}

func (g *Guard) Allow(ctx context.Context, meiID uuid.UUID, limit int) (bool, error) {
	key := fmt.Sprintf("billing:%s:%s", meiID, monthKey())
	count, err := g.rdb.Incr(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return int(count) <= limit, nil
}

func monthKey() string {
	return ""
}
