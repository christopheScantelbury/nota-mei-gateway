package cert

import (
	"context"
	"crypto/tls"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/metrics"
)

// CachingProvider wraps a CertProvider with an in-memory TTL cache (Cache).
// It satisfies the CertProvider interface so it can replace *Provider transparently.
//
//   - GetCert    → cache hit returns immediately; miss fetches from SM and warms the cache.
//   - StoreCert  → passes through; new ARN has no prior cache entry to invalidate.
//   - UpdateCert → passes through; on success invalidates the cached entry so the
//     next GetCert call fetches the fresh certificate from SM.
type CachingProvider struct {
	inner CertProvider
	cache *Cache
}

// NewCachingProvider wraps inner with the provided cache.
// Passing a nil inner will panic on first use — always check that the real
// provider was initialised before wrapping.
func NewCachingProvider(inner CertProvider, cache *Cache) *CachingProvider {
	return &CachingProvider{inner: inner, cache: cache}
}

// GetCert returns the cached certificate for secretARN when available and fresh.
// On a cache miss it delegates to the underlying provider and warms the cache.
func (cp *CachingProvider) GetCert(ctx context.Context, secretARN string) (*tls.Certificate, error) {
	if c, ok := cp.cache.Get(secretARN); ok {
		metrics.CertCacheHitsTotal.Inc()
		return c, nil
	}
	metrics.CertCacheMissesTotal.Inc()

	c, err := cp.inner.GetCert(ctx, secretARN)
	if err != nil {
		return nil, err
	}
	cp.cache.Set(secretARN, c)
	return c, nil
}

// StoreCert delegates to the underlying provider.
// No cache invalidation is needed because the new secret has a brand-new ARN.
func (cp *CachingProvider) StoreCert(ctx context.Context, name string, pfxData []byte, password string) (string, error) {
	return cp.inner.StoreCert(ctx, name, pfxData, password)
}

// UpdateCert replaces the secret in AWS Secrets Manager and invalidates the
// cached certificate so the next GetCert fetches the fresh one.
func (cp *CachingProvider) UpdateCert(ctx context.Context, secretARN string, pfxData []byte, password string) error {
	if err := cp.inner.UpdateCert(ctx, secretARN, pfxData, password); err != nil {
		return err
	}
	cp.cache.Invalidate(secretARN)
	return nil
}
