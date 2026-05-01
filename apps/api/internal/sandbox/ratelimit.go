// Package sandbox provides a public demo environment for the Nota MEI Gateway API.
// No real NFS-e is submitted to the Receita Federal — all responses are simulated.
package sandbox

import (
	"sync"
	"time"
)

// ipBucket tracks request timestamps for a single IP address.
type ipBucket struct {
	mu        sync.Mutex
	timestamps []time.Time
}

// allow returns true if the IP is within the given limit over the window.
func (b *ipBucket) allow(limit int, window time.Duration) bool {
	now := time.Now()
	cutoff := now.Add(-window)

	b.mu.Lock()
	defer b.mu.Unlock()

	// Evict expired entries.
	valid := b.timestamps[:0]
	for _, ts := range b.timestamps {
		if ts.After(cutoff) {
			valid = append(valid, ts)
		}
	}
	b.timestamps = valid

	if len(b.timestamps) >= limit {
		return false
	}
	b.timestamps = append(b.timestamps, now)
	return true
}

// IPRateLimiter is a sliding-window in-memory rate limiter keyed by IP address.
type IPRateLimiter struct {
	mu      sync.RWMutex
	buckets map[string]*ipBucket
	limit   int
	window  time.Duration
}

// NewIPRateLimiter creates a limiter allowing up to limit requests per window per IP.
func NewIPRateLimiter(limit int, window time.Duration) *IPRateLimiter {
	rl := &IPRateLimiter{
		buckets: make(map[string]*ipBucket),
		limit:   limit,
		window:  window,
	}
	// Background goroutine to evict stale buckets every hour.
	go func() {
		for range time.Tick(time.Hour) {
			rl.evict()
		}
	}()
	return rl
}

// Allow returns true if the given IP may proceed.
func (rl *IPRateLimiter) Allow(ip string) bool {
	rl.mu.RLock()
	b, ok := rl.buckets[ip]
	rl.mu.RUnlock()

	if !ok {
		rl.mu.Lock()
		// Double-check after acquiring write lock.
		b, ok = rl.buckets[ip]
		if !ok {
			b = &ipBucket{}
			rl.buckets[ip] = b
		}
		rl.mu.Unlock()
	}
	return b.allow(rl.limit, rl.window)
}

// evict removes buckets with no recent activity.
func (rl *IPRateLimiter) evict() {
	cutoff := time.Now().Add(-rl.window)
	rl.mu.Lock()
	defer rl.mu.Unlock()
	for ip, b := range rl.buckets {
		b.mu.Lock()
		allOld := len(b.timestamps) == 0 || b.timestamps[len(b.timestamps)-1].Before(cutoff)
		b.mu.Unlock()
		if allOld {
			delete(rl.buckets, ip)
		}
	}
}
