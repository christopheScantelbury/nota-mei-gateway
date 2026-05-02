package billing

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// QuotaRenewer creates emissoes_mensais rows for all MEIs for a given month.
type QuotaRenewer interface {
	RenewMonth(ctx context.Context, competencia string) (int, error)
}

// Locker acquires a distributed lock. Returns true if the lock was acquired,
// false if another process already holds it.
type Locker interface {
	Acquire(ctx context.Context, key string, ttl time.Duration) (bool, error)
}

// RedisLocker implements Locker using Redis SET NX EX.
type RedisLocker struct {
	rdb *redis.Client
}

// NewRedisLocker parses redisURL and returns a RedisLocker.
func NewRedisLocker(redisURL string) (*RedisLocker, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	return &RedisLocker{rdb: redis.NewClient(opt)}, nil
}

// Acquire sets key with NX EX if it doesn't exist. Returns true on first call per month.
func (l *RedisLocker) Acquire(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	err := l.rdb.SetArgs(ctx, key, "1", redis.SetArgs{Mode: "NX", TTL: ttl}).Err()
	if err == redis.Nil {
		return false, nil // key already exists — lock held by another process
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// Renewer runs the monthly quota renewal job. A distributed lock ensures only one
// instance executes the renewal per calendar month, even across process restarts.
type Renewer struct {
	db       QuotaRenewer
	locker   Locker
	interval time.Duration
}

// NewRenewer creates a Renewer that checks every interval (typically 24h in production).
func NewRenewer(db QuotaRenewer, locker Locker, interval time.Duration) *Renewer {
	return &Renewer{db: db, locker: locker, interval: interval}
}

// Run attempts renewal immediately on startup, then repeats every interval until ctx
// is cancelled. Safe to call concurrently — the Redis lock prevents double execution.
func (r *Renewer) Run(ctx context.Context) {
	if err := r.TryRenew(ctx); err != nil {
		log.Error().Err(err).Msg("monthly quota renewal failed")
	}

	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := r.TryRenew(ctx); err != nil {
				log.Error().Err(err).Msg("monthly quota renewal failed")
			}
		case <-ctx.Done():
			return
		}
	}
}

// TryRenew acquires the per-month lock and, if successful, creates emissoes_mensais
// rows for all MEIs for the current calendar month.
func (r *Renewer) TryRenew(ctx context.Context) error {
	month := time.Now().UTC().Format("2006-01")
	lockKey := fmt.Sprintf("bil:renew:%s", month)

	acquired, err := r.locker.Acquire(ctx, lockKey, time.Hour)
	if err != nil {
		return fmt.Errorf("acquire lock: %w", err)
	}
	if !acquired {
		return nil
	}

	count, err := r.db.RenewMonth(ctx, month)
	if err != nil {
		return fmt.Errorf("renew month %s: %w", month, err)
	}

	log.Info().
		Str("competencia", month).
		Int("meis_renovados", count).
		Msg("cotas mensais renovadas")
	return nil
}
