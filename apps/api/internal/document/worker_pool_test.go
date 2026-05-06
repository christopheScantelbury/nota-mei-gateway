package document_test

import (
	"context"
	"crypto/tls"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/document"
)

// ── test helpers ─────────────────────────────────────────────────────────────

// slowSigner blocks for the given duration before returning.
type slowSigner struct {
	delay time.Duration
	calls atomic.Int64
}

func (s *slowSigner) Sign(ctx context.Context, xmlDoc []byte, _ *tls.Certificate) ([]byte, error) {
	s.calls.Add(1)
	select {
	case <-time.After(s.delay):
		return xmlDoc, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// errSigner always returns an error.
type errSigner struct{}

func (errSigner) Sign(_ context.Context, _ []byte, _ *tls.Certificate) ([]byte, error) {
	return nil, errors.New("signer error")
}

// echoSigner returns the input unchanged.
type echoSigner struct{}

func (echoSigner) Sign(_ context.Context, xmlDoc []byte, _ *tls.Certificate) ([]byte, error) {
	return xmlDoc, nil
}

// ── tests ─────────────────────────────────────────────────────────────────────

func TestPooledSigner_DefaultPoolSize(t *testing.T) {
	p := document.NewPooledSigner(echoSigner{}, 0)
	if p.Capacity() != document.DefaultWorkerPoolSize {
		t.Fatalf("expected capacity %d, got %d", document.DefaultWorkerPoolSize, p.Capacity())
	}
}

func TestPooledSigner_CustomPoolSize(t *testing.T) {
	p := document.NewPooledSigner(echoSigner{}, 7)
	if p.Capacity() != 7 {
		t.Fatalf("expected capacity 7, got %d", p.Capacity())
	}
}

func TestPooledSigner_SignPassThrough(t *testing.T) {
	p := document.NewPooledSigner(echoSigner{}, 2)
	input := []byte("<xml>test</xml>")
	out, err := p.Sign(context.Background(), input, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(out) != string(input) {
		t.Fatalf("expected %q, got %q", input, out)
	}
}

func TestPooledSigner_SignPropagatesError(t *testing.T) {
	p := document.NewPooledSigner(errSigner{}, 2)
	_, err := p.Sign(context.Background(), []byte("<xml/>"), nil)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestPooledSigner_ActiveMetric(t *testing.T) {
	slow := &slowSigner{delay: 100 * time.Millisecond}
	p := document.NewPooledSigner(slow, 3)

	// Start 2 concurrent sign calls.
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = p.Sign(context.Background(), []byte("<xml/>"), nil)
		}()
	}

	// Give goroutines time to acquire slots.
	time.Sleep(20 * time.Millisecond)
	active := p.Active()
	if active < 1 || active > 2 {
		t.Fatalf("expected 1-2 active workers, got %d", active)
	}

	wg.Wait()

	if p.Active() != 0 {
		t.Fatalf("expected 0 active workers after completion, got %d", p.Active())
	}
}

func TestPooledSigner_ConcurrencyLimit(t *testing.T) {
	const maxWorkers = 3
	const totalCallers = 10

	slow := &slowSigner{delay: 80 * time.Millisecond}
	p := document.NewPooledSigner(slow, maxWorkers)

	var (
		wg         sync.WaitGroup
		peakActive atomic.Int64
	)

	for i := 0; i < totalCallers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = p.Sign(context.Background(), []byte("<xml/>"), nil)
		}()
	}

	// Sample active workers while calls are in flight.
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			select {
			case <-done:
				return
			default:
				v := int64(p.Active())
				for {
					old := peakActive.Load()
					if v <= old || peakActive.CompareAndSwap(old, v) {
						break
					}
				}
				time.Sleep(5 * time.Millisecond)
			}
		}
	}()

	wg.Wait()
	done <- struct{}{} // signal sampler to stop

	if peak := peakActive.Load(); peak > int64(maxWorkers) {
		t.Fatalf("concurrency exceeded pool size: peak active=%d, max=%d", peak, maxWorkers)
	}
	if slow.calls.Load() != totalCallers {
		t.Fatalf("expected %d Sign calls, got %d", totalCallers, slow.calls.Load())
	}
}

func TestPooledSigner_ContextCancellation(t *testing.T) {
	const maxWorkers = 1

	// Occupy the single slot indefinitely (until the background ctx is cancelled).
	blockCtx, blockCancel := context.WithCancel(context.Background())
	defer blockCancel()

	slow := &slowSigner{delay: 10 * time.Second}
	p := document.NewPooledSigner(slow, maxWorkers)

	// Occupy the only slot.
	go func() { _, _ = p.Sign(blockCtx, []byte("<xml/>"), nil) }()

	// Wait until the slot is occupied.
	time.Sleep(20 * time.Millisecond)

	// Second caller — cancel after a short timeout.
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	_, err := p.Sign(ctx, []byte("<xml/>"), nil)
	if err == nil {
		t.Fatal("expected context error, got nil")
	}
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected DeadlineExceeded, got: %v", err)
	}

	// Waiting counter must be back to 0 after cancellation.
	if p.Waiting() != 0 {
		t.Fatalf("expected waiting=0 after cancel, got %d", p.Waiting())
	}
}

func TestPooledSigner_WaitingCounterAccurate(t *testing.T) {
	const maxWorkers = 1

	blockCtx, blockCancel := context.WithCancel(context.Background())
	defer blockCancel()

	slow := &slowSigner{delay: 10 * time.Second}
	p := document.NewPooledSigner(slow, maxWorkers)

	// Occupy the only slot.
	go func() { _, _ = p.Sign(blockCtx, []byte("<xml/>"), nil) }()
	time.Sleep(20 * time.Millisecond)

	// Queue 3 callers.
	var wg sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
			defer cancel()
			_, _ = p.Sign(ctx, []byte("<xml/>"), nil)
		}()
	}

	// Give callers time to enter the wait queue.
	time.Sleep(30 * time.Millisecond)
	waiting := p.Waiting()
	if waiting < 1 {
		t.Fatalf("expected at least 1 waiting goroutine, got %d", waiting)
	}

	wg.Wait()

	if p.Waiting() != 0 {
		t.Fatalf("expected 0 waiting after all callers finish, got %d", p.Waiting())
	}
}

func TestPooledSigner_NegativeMaxWorkersUsesDefault(t *testing.T) {
	p := document.NewPooledSigner(echoSigner{}, -5)
	if p.Capacity() != document.DefaultWorkerPoolSize {
		t.Fatalf("expected default capacity, got %d", p.Capacity())
	}
}
