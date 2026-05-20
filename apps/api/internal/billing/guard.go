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
// For ME/EPP empresas, use Check(ctx, empresaID) which handles the trial bypass.
type Guard struct {
	rdb  *redis.Client
	repo *Repository // optional — required for Check (ME/EPP path)
}

// NewGuard parses redisURL and returns a Guard backed by that Redis instance.
// Prefer NewGuardWithClient when a shared *redis.Client already exists to avoid
// opening a redundant connection pool for the same Redis server.
func NewGuard(redisURL string) (*Guard, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	return &Guard{rdb: redis.NewClient(opt)}, nil
}

// NewGuardWithClient returns a Guard using the provided Redis client.
// Use this when a shared client is available to avoid redundant connection pools.
func NewGuardWithClient(rdb *redis.Client) *Guard {
	return &Guard{rdb: rdb}
}

// WithRepository attaches a billing Repository so that Check (ME/EPP) can
// query trial status and plano limits.  Call after NewGuard in main.go.
func (g *Guard) WithRepository(repo *Repository) *Guard {
	g.repo = repo
	return g
}

// guardCacheTTL is the Redis TTL for billing guard allow/deny entries.
const guardCacheTTL = 5 * time.Minute

// ErrPlanLimitReached is returned by Check when the empresa has exhausted
// their monthly emission quota.
type ErrPlanLimitReached struct {
	Limite   int
	Emitidas int
}

func (e ErrPlanLimitReached) Error() string {
	if e.Limite == 0 && e.Emitidas == 0 {
		return "limite do plano atingido"
	}
	return fmt.Sprintf("limite do plano atingido: %d/%d emissões", e.Emitidas, e.Limite)
}

// Check verifies whether the ME/EPP empresa can emit more notas this month.
//
// Flow:
//  1. Redis cache hit → return immediately (nil = allowed, ErrPlanLimitReached = blocked)
//  2. DB: fetch empresa trial status
//  3. Trial bypass → cache "ok", return nil
//  4. DB: fetch emissao mensal + plano limit
//  5. Cache result, return accordingly
//
// Fail-open: if repo is nil or any DB call fails, returns nil (emission allowed).
// A transient DB error is less harmful than silently blocking legitimate customers.
func (g *Guard) Check(ctx context.Context, empresaID uuid.UUID) error {
	if g == nil || g.repo == nil {
		return nil
	}

	competencia := monthKey()
	cacheKey := fmt.Sprintf("billing:guard:%s:%s", empresaID, competencia)

	// 1. Redis cache
	if cached, err := g.rdb.Get(ctx, cacheKey).Result(); err == nil {
		if cached == "ok" {
			return nil
		}
		return ErrPlanLimitReached{}
	}

	// 2. Empresa trial status
	info, err := g.repo.GetEmpresaBillingInfo(ctx, empresaID)
	if err != nil {
		return nil // fail-open
	}

	// 3. Trial bypass
	if info.TrialMe {
		_ = g.rdb.Set(ctx, cacheKey, "ok", guardCacheTTL).Err()
		return nil
	}

	// 4. Plano limit check
	em, err := g.repo.GetOrCreateEmissaoMensalEmpresa(ctx, empresaID)
	if err != nil {
		return nil // fail-open
	}

	plano, err := g.repo.GetPlano(ctx, em.PlanoID, info.Tipo)
	if err != nil {
		// No active plan for this empresa type — deny with explicit error.
		return fmt.Errorf("nenhum plano ativo para empresa tipo %s: %w",
			info.Tipo, ErrPlanLimitReached{})
	}

	if em.TotalEmitidas >= plano.EmissoesLimite {
		_ = g.rdb.Set(ctx, cacheKey, "limit_reached", guardCacheTTL).Err()
		return ErrPlanLimitReached{
			Limite:   plano.EmissoesLimite,
			Emitidas: em.TotalEmitidas,
		}
	}

	_ = g.rdb.Set(ctx, cacheKey, "ok", guardCacheTTL).Err()
	return nil
}

// InvalidateEmpresa removes the cached billing guard result for the given empresa,
// forcing the next Check to re-query the DB.
// Call from Stripe webhook handlers when a subscription changes plan or status.
//
// Uses SCAN instead of KEYS to avoid blocking the Redis server: KEYS is O(N)
// and holds the server lock for the duration of the scan, causing latency spikes
// for all other callers. SCAN iterates in small cursor steps — safe in production.
func (g *Guard) InvalidateEmpresa(ctx context.Context, empresaID uuid.UUID) {
	if g == nil {
		return
	}
	pattern := fmt.Sprintf("billing:guard:%s:*", empresaID)

	var cursor uint64
	var toDelete []string
	for {
		keys, next, err := g.rdb.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			break
		}
		toDelete = append(toDelete, keys...)
		cursor = next
		if cursor == 0 {
			break
		}
	}
	if len(toDelete) > 0 {
		_ = g.rdb.Del(ctx, toDelete...).Err()
	}
}

// Ping sends a PING command to Redis and returns an error if unreachable.
func (g *Guard) Ping(ctx context.Context) error {
	return g.rdb.Ping(ctx).Err()
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
