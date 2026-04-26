// Package supabase provides a pgx connection pool to the Supabase PostgreSQL database.
package supabase

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Client wraps a pgx connection pool for the Supabase database.
type Client struct {
	pool *pgxpool.Pool
}

// New creates a pgx connection pool using the given databaseURL and returns a Client.
func New(ctx context.Context, databaseURL string) (*Client, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	return &Client{pool: pool}, nil
}

// Close releases all connections in the pool.
func (c *Client) Close() {
	c.pool.Close()
}
