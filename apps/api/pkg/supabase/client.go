// Package supabase provides a pgx connection pool to the Supabase PostgreSQL database.
package supabase

import (
	"context"
	"net"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Client wraps a pgx connection pool for the Supabase database.
type Client struct {
	pool *pgxpool.Pool
}

// New creates a pgx connection pool using the given databaseURL and returns a Client.
// It forces IPv4-only TCP dialing to ensure compatibility with Railway's network
// environment, which does not support outbound IPv6 connections.
func New(ctx context.Context, databaseURL string) (*Client, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}

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
	return &Client{pool: pool}, nil
}

// Pool returns the underlying pgx connection pool.
func (c *Client) Pool() *pgxpool.Pool {
	return c.pool
}

// Close releases all connections in the pool.
func (c *Client) Close() {
	c.pool.Close()
}
