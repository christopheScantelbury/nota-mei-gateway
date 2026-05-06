package cert_test

import (
	"context"
	"crypto/tls"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/cert"
)

// ── Cache unit tests ─────────────────────────────────────────────────────────

func TestCache_GetMissOnEmpty(t *testing.T) {
	c := cert.NewCache(time.Hour)
	_, ok := c.Get("arn:aws:sm:sa-east-1:123:secret/test")
	if ok {
		t.Fatal("expected cache miss on empty cache")
	}
}

func TestCache_SetThenGet(t *testing.T) {
	c := cert.NewCache(time.Hour)
	arn := "arn:test"
	tlsCert := &tls.Certificate{}

	c.Set(arn, tlsCert)
	got, ok := c.Get(arn)
	if !ok {
		t.Fatal("expected cache hit after Set")
	}
	if got != tlsCert {
		t.Fatal("returned certificate pointer does not match stored value")
	}
}

func TestCache_ExpiresAfterTTL(t *testing.T) {
	c := cert.NewCache(50 * time.Millisecond)
	arn := "arn:expiry-test"
	c.Set(arn, &tls.Certificate{})

	time.Sleep(100 * time.Millisecond)

	_, ok := c.Get(arn)
	if ok {
		t.Fatal("expected cache miss after TTL expiry")
	}
}

func TestCache_Invalidate(t *testing.T) {
	c := cert.NewCache(time.Hour)
	arn := "arn:invalidate-test"
	c.Set(arn, &tls.Certificate{})

	c.Invalidate(arn)

	_, ok := c.Get(arn)
	if ok {
		t.Fatal("expected cache miss after Invalidate")
	}
}

func TestCache_InvalidateNonExistent(t *testing.T) {
	c := cert.NewCache(time.Hour)
	// Should not panic on missing key.
	c.Invalidate("arn:does-not-exist")
}

func TestCache_Len(t *testing.T) {
	c := cert.NewCache(time.Hour)
	if c.Len() != 0 {
		t.Fatalf("expected Len 0, got %d", c.Len())
	}
	c.Set("a", &tls.Certificate{})
	c.Set("b", &tls.Certificate{})
	if c.Len() != 2 {
		t.Fatalf("expected Len 2, got %d", c.Len())
	}
	c.Invalidate("a")
	if c.Len() != 1 {
		t.Fatalf("expected Len 1 after Invalidate, got %d", c.Len())
	}
}

func TestCache_ConcurrentAccess(t *testing.T) {
	c := cert.NewCache(time.Hour)
	const goroutines = 50
	var wg sync.WaitGroup
	wg.Add(goroutines * 3)

	for i := 0; i < goroutines; i++ {
		go func() { defer wg.Done(); c.Set("arn:concurrent", &tls.Certificate{}) }()
		go func() { defer wg.Done(); c.Get("arn:concurrent") }()
		go func() { defer wg.Done(); c.Invalidate("arn:concurrent") }()
	}
	wg.Wait() // race detector will catch any data race
}

func TestCache_DefaultTTL(t *testing.T) {
	// Passing ttl=0 must use DefaultCertTTL (not zero-duration / instant expiry).
	c := cert.NewCache(0)
	c.Set("arn:default-ttl", &tls.Certificate{})
	_, ok := c.Get("arn:default-ttl")
	if !ok {
		t.Fatal("expected hit immediately after Set with default TTL")
	}
}

// ── CachingProvider unit tests ───────────────────────────────────────────────

// stubProvider is a minimal CertProvider that counts GetCert calls.
type stubProvider struct {
	mu       sync.Mutex
	getCalls int
	cert     *tls.Certificate
	err      error
}

func (s *stubProvider) GetCert(_ context.Context, _ string) (*tls.Certificate, error) {
	s.mu.Lock()
	s.getCalls++
	s.mu.Unlock()
	return s.cert, s.err
}
func (s *stubProvider) StoreCert(_ context.Context, _ string, _ []byte, _ string) (string, error) {
	return "arn:new", nil
}
func (s *stubProvider) UpdateCert(_ context.Context, _ string, _ []byte, _ string) error {
	return s.err
}

func TestCachingProvider_HitAvoidsSM(t *testing.T) {
	stub := &stubProvider{cert: &tls.Certificate{}}
	cache := cert.NewCache(time.Hour)
	cp := cert.NewCachingProvider(stub, cache)
	ctx := context.Background()

	// First call → miss → should hit stub.
	if _, err := cp.GetCert(ctx, "arn:x"); err != nil {
		t.Fatalf("first GetCert: %v", err)
	}
	// Second call → hit → stub should NOT be called again.
	if _, err := cp.GetCert(ctx, "arn:x"); err != nil {
		t.Fatalf("second GetCert: %v", err)
	}

	stub.mu.Lock()
	calls := stub.getCalls
	stub.mu.Unlock()
	if calls != 1 {
		t.Fatalf("expected 1 SM call (cache hit on second), got %d", calls)
	}
}

func TestCachingProvider_UpdateCertInvalidatesCache(t *testing.T) {
	stub := &stubProvider{cert: &tls.Certificate{}}
	cache := cert.NewCache(time.Hour)
	cp := cert.NewCachingProvider(stub, cache)
	ctx := context.Background()

	// Warm the cache.
	if _, err := cp.GetCert(ctx, "arn:y"); err != nil {
		t.Fatal(err)
	}

	// Renew cert — must invalidate cache.
	if err := cp.UpdateCert(ctx, "arn:y", nil, ""); err != nil {
		t.Fatalf("UpdateCert: %v", err)
	}

	// Next GetCert must go to SM again.
	if _, err := cp.GetCert(ctx, "arn:y"); err != nil {
		t.Fatal(err)
	}

	stub.mu.Lock()
	calls := stub.getCalls
	stub.mu.Unlock()
	if calls != 2 {
		t.Fatalf("expected 2 SM calls (warm + post-invalidation), got %d", calls)
	}
}

func TestCachingProvider_UpdateCertErrorDoesNotInvalidate(t *testing.T) {
	stub := &stubProvider{cert: &tls.Certificate{}, err: errors.New("AWS error")}
	cache := cert.NewCache(time.Hour)
	cp := cert.NewCachingProvider(stub, cache)
	ctx := context.Background()

	// Manually warm the cache (bypass the provider error path).
	cache.Set("arn:z", &tls.Certificate{})

	// UpdateCert fails — cache must NOT be invalidated.
	_ = cp.UpdateCert(ctx, "arn:z", nil, "")
	_, ok := cache.Get("arn:z")
	if !ok {
		t.Fatal("cache should remain warm when UpdateCert fails")
	}
}

func TestCachingProvider_MissOnProviderError(t *testing.T) {
	stub := &stubProvider{err: errors.New("sm unavailable")}
	cache := cert.NewCache(time.Hour)
	cp := cert.NewCachingProvider(stub, cache)

	_, err := cp.GetCert(context.Background(), "arn:err")
	if err == nil {
		t.Fatal("expected error propagation from underlying provider")
	}
	// Cache must remain empty on error.
	if cache.Len() != 0 {
		t.Fatal("cache must not be populated when GetCert fails")
	}
}
