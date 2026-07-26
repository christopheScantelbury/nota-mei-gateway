// Package supabase provides a pgx connection pool to the Supabase PostgreSQL database.
package supabase

import (
	"context"
	"net"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PoolConfig tunes the pgx connection pool for the expected workload.
// Zero values fall back to the package defaults, which are sized for ME/EPP scale.
type PoolConfig struct {
	// MaxConns is the maximum number of open connections per instance.
	// Default: 25 — with 2 Railway replicas this gives 50 total, within the
	// Supabase Free limit (60) and well below Pro (500).
	MaxConns int32

	// MinConns is the number of connections kept open during idle periods.
	// Default: 5 — keeps warm connections ready without wasting Supabase quota.
	MinConns int32

	// MaxConnLifetime is the maximum age of a connection before it is closed
	// and recreated.  Default: 30 min — prevents long-lived zombie connections.
	MaxConnLifetime time.Duration

	// HealthCheckPeriod is how often idle connections are health-checked.
	// Default: 1 min — detects dropped connections before they are used.
	HealthCheckPeriod time.Duration
}

const (
	defaultMaxConns          int32         = 25
	defaultMinConns          int32         = 5
	defaultMaxConnLifetime   time.Duration = 30 * time.Minute
	defaultHealthCheckPeriod time.Duration = 1 * time.Minute
)

func applyDefaults(pc PoolConfig) PoolConfig {
	if pc.MaxConns == 0 {
		pc.MaxConns = defaultMaxConns
	}
	if pc.MinConns == 0 {
		pc.MinConns = defaultMinConns
	}
	if pc.MaxConnLifetime == 0 {
		pc.MaxConnLifetime = defaultMaxConnLifetime
	}
	if pc.HealthCheckPeriod == 0 {
		pc.HealthCheckPeriod = defaultHealthCheckPeriod
	}
	return pc
}

// Client wraps a pgx connection pool for the Supabase database.
type Client struct {
	pool *pgxpool.Pool
}

// New creates a pgx connection pool using the given databaseURL and returns a Client.
//
// It forces IPv4-only TCP dialing to ensure compatibility with Railway's network
// environment, which does not support outbound IPv6 connections.
//
// An optional PoolConfig can be provided to override pool sizing.  If omitted or
// zero-valued, production-safe defaults are used (MaxConns=25, MinConns=5,
// MaxConnLifetime=30 min, HealthCheckPeriod=1 min).
func New(ctx context.Context, databaseURL string, poolCfg ...PoolConfig) (*Client, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}

	// Apply pool sizing — use caller-supplied values or fall back to defaults.
	pc := PoolConfig{}
	if len(poolCfg) > 0 {
		pc = poolCfg[0]
	}
	pc = applyDefaults(pc)

	cfg.MaxConns = pc.MaxConns
	cfg.MinConns = pc.MinConns
	cfg.MaxConnLifetime = pc.MaxConnLifetime
	cfg.HealthCheckPeriod = pc.HealthCheckPeriod

	// Force IPv4 — Railway containers cannot reach IPv6 addresses.
	// Supabase direct-connection hostnames (db.<ref>.supabase.co) resolve to
	// IPv6 by default, causing "network is unreachable" without this override.
	cfg.ConnConfig.DialFunc = func(ctx context.Context, network, addr string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "tcp4", addr)
	}

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}

	// Verifica conectividade com retry antes de retornar. pgxpool conecta
	// LAZY (nenhuma conexão viva ao criar), então quem dispara query logo no
	// boot — o worker roda renewer + poller imediatamente — corria contra o
	// pooler frio e falhava com "failed to connect" (incidente #256). Com o
	// ping-com-retry, New só retorna quando o banco está de fato alcançável.
	if err := pingWithRetry(ctx, pool); err != nil {
		pool.Close()
		return nil, err
	}
	return &Client{pool: pool}, nil
}

// pingWithRetry tenta Ping até ~15s (backoff 500ms→4s), tolerando o cold start
// do pooler Supabase no boot. Respeita o ctx (cancelamento encerra na hora).
func pingWithRetry(ctx context.Context, pool *pgxpool.Pool) error {
	backoff := 500 * time.Millisecond
	const maxBackoff = 4 * time.Second
	deadline := time.Now().Add(15 * time.Second)

	var lastErr error
	for {
		pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		err := pool.Ping(pingCtx)
		cancel()
		if err == nil {
			return nil
		}
		lastErr = err
		if time.Now().After(deadline) {
			return lastErr
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(backoff):
		}
		if backoff < maxBackoff {
			backoff *= 2
		}
	}
}

// Pool returns the underlying pgx connection pool.
func (c *Client) Pool() *pgxpool.Pool {
	return c.pool
}

// Close releases all connections in the pool.
func (c *Client) Close() {
	c.pool.Close()
}
