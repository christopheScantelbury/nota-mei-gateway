package document

import (
	"context"
	"crypto/tls"
	"fmt"
	"sync/atomic"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/metrics"
)

// DefaultWorkerPoolSize is the maximum number of concurrent Sign() calls
// allowed before additional callers start queuing.
// The value must be validated via benchmark on the target hardware.
// Override via XMLSEC_WORKER_POOL_SIZE environment variable.
const DefaultWorkerPoolSize = 50

// PooledSigner wraps a Signer with a semaphore that limits the number of
// concurrent signing operations.  This prevents runaway goroutine-per-request
// growth under peak load (e.g. 1 000 MEs emitting simultaneously at month-end).
//
// Behaviour:
//   - Up to maxWorkers sign operations run concurrently.
//   - Callers beyond that limit block until a slot is free OR ctx expires.
//   - A cancelled / timed-out context returns a wrapped error immediately,
//     never leaving the caller stuck.
//
// Metrics exposed:
//   - xmlsec_pool_active:      current number of in-flight sign calls
//   - xmlsec_pool_queue_depth: current number of goroutines waiting for a slot
type PooledSigner struct {
	inner   Signer
	sem     chan struct{} // buffered channel used as counting semaphore
	waiting atomic.Int64  // goroutines currently blocked waiting for a slot
}

// NewPooledSigner wraps inner with a concurrency semaphore.
// If maxWorkers ≤ 0, DefaultWorkerPoolSize is used.
func NewPooledSigner(inner Signer, maxWorkers int) *PooledSigner {
	if maxWorkers <= 0 {
		maxWorkers = DefaultWorkerPoolSize
	}
	return &PooledSigner{
		inner: inner,
		sem:   make(chan struct{}, maxWorkers),
	}
}

// Sign acquires a worker slot, delegates to the underlying Signer, then
// releases the slot.  If ctx is cancelled while waiting, it returns immediately
// with a wrapped context error — the underlying Sign is never called.
func (p *PooledSigner) Sign(ctx context.Context, xmlDoc []byte, cert *tls.Certificate) ([]byte, error) {
	// Try non-blocking acquire first (fast path — pool has free slots).
	select {
	case p.sem <- struct{}{}:
		// Slot acquired immediately.
	default:
		// Pool is full: update queue depth metric and block with context awareness.
		p.waiting.Add(1)
		metrics.XMLSecPoolQueueDepth.Set(float64(p.waiting.Load()))

		select {
		case p.sem <- struct{}{}:
			// Slot acquired after waiting.
			p.waiting.Add(-1)
			metrics.XMLSecPoolQueueDepth.Set(float64(p.waiting.Load()))
		case <-ctx.Done():
			p.waiting.Add(-1)
			metrics.XMLSecPoolQueueDepth.Set(float64(p.waiting.Load()))
			return nil, fmt.Errorf("xmlsec worker pool: %w", ctx.Err())
		}
	}

	// Update active-workers metric and ensure the slot is released on exit.
	metrics.XMLSecPoolActive.Set(float64(len(p.sem)))
	defer func() {
		<-p.sem
		metrics.XMLSecPoolActive.Set(float64(len(p.sem)))
	}()

	return p.inner.Sign(ctx, xmlDoc, cert)
}

// Capacity returns the maximum number of concurrent workers configured.
func (p *PooledSigner) Capacity() int { return cap(p.sem) }

// Active returns the current number of in-flight sign operations.
func (p *PooledSigner) Active() int { return len(p.sem) }

// Waiting returns the number of goroutines currently queued waiting for a slot.
func (p *PooledSigner) Waiting() int64 { return p.waiting.Load() }
