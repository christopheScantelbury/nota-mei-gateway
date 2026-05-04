package storage

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// NoopStore is an in-memory ObjectStore used in development and unit tests.
// It stores objects in a map and returns a stub presigned URL that encodes
// the bucket and key so tests can assert on the generated URL.
type NoopStore struct {
	mu      sync.RWMutex
	objects map[string][]byte
}

// NewNoopStore creates an empty NoopStore.
func NewNoopStore() *NoopStore {
	return &NoopStore{objects: make(map[string][]byte)}
}

// Put stores data under the given key (in-memory).
func (s *NoopStore) Put(_ context.Context, key, _ string, data []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cp := make([]byte, len(data))
	copy(cp, data)
	s.objects[key] = cp
	return nil
}

// Get retrieves data for the given key, or returns an error if not found.
func (s *NoopStore) Get(_ context.Context, key string) ([]byte, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.objects[key]
	if !ok {
		return nil, fmt.Errorf("storage: key not found: %s", key)
	}
	cp := make([]byte, len(v))
	copy(cp, v)
	return cp, nil
}

// PresignedURL returns a deterministic stub URL for tests.
// Format: "https://noop-store.local/<key>?ttl=<seconds>"
func (s *NoopStore) PresignedURL(_ context.Context, key string, ttl time.Duration) (string, error) {
	return fmt.Sprintf("https://noop-store.local/%s?ttl=%d", key, int(ttl.Seconds())), nil
}

// Has reports whether the given key has been stored (helper for tests).
func (s *NoopStore) Has(key string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, ok := s.objects[key]
	return ok
}
