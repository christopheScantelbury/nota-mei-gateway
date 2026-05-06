package cert

import (
	"crypto/tls"
	"sync"
	"time"
)

// DefaultCertTTL is the time a certificate is held in memory before the
// next GetCert call re-fetches it from AWS Secrets Manager.
// A1 certificates are valid for 1 year and renewed manually, so 4 h is
// a conservative TTL that cuts SM API calls by ~99 % under sustained load.
const DefaultCertTTL = 4 * time.Hour

type cacheEntry struct {
	cert      *tls.Certificate
	expiresAt time.Time
}

// Cache is a thread-safe in-memory TTL cache for A1 TLS certificates.
// Keys are AWS Secrets Manager ARNs — each MEI/empresa has exactly one ARN.
//
// Usage:
//
//	c := cert.NewCache(0)          // 0 → DefaultCertTTL (4 h)
//	certProv = cert.NewCachingProvider(realProvider, c)
type Cache struct {
	mu      sync.RWMutex
	entries map[string]cacheEntry
	ttl     time.Duration
}

// NewCache creates a Cache.  If ttl is 0, DefaultCertTTL is used.
func NewCache(ttl time.Duration) *Cache {
	if ttl == 0 {
		ttl = DefaultCertTTL
	}
	return &Cache{
		entries: make(map[string]cacheEntry),
		ttl:     ttl,
	}
}

// Get returns the cached certificate for arn if it exists and has not expired.
// The bool indicates a cache hit.
func (c *Cache) Get(arn string) (*tls.Certificate, bool) {
	c.mu.RLock()
	e, ok := c.entries[arn]
	c.mu.RUnlock()
	if !ok || time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e.cert, true
}

// Set stores cert under arn with the configured TTL.
func (c *Cache) Set(arn string, cert *tls.Certificate) {
	c.mu.Lock()
	c.entries[arn] = cacheEntry{cert: cert, expiresAt: time.Now().Add(c.ttl)}
	c.mu.Unlock()
}

// Invalidate removes the entry for arn so the next GetCert call goes to SM.
// Must be called immediately before or after a successful UpdateCert.
func (c *Cache) Invalidate(arn string) {
	c.mu.Lock()
	delete(c.entries, arn)
	c.mu.Unlock()
}

// Len returns the total number of entries (including expired ones not yet evicted).
// Useful for diagnostics and tests.
func (c *Cache) Len() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.entries)
}
