package billing_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/billing"
)

// ── stubs ──────────────────────────────────────────────────────────────────

type stubQuotaRenewer struct {
	count int
	err   error
	calls []string
}

func (s *stubQuotaRenewer) RenewMonth(_ context.Context, competencia string) (int, error) {
	s.calls = append(s.calls, competencia)
	return s.count, s.err
}

type stubLocker struct {
	acquired bool
	err      error
	calls    int
}

func (s *stubLocker) Acquire(_ context.Context, _ string, _ time.Duration) (bool, error) {
	s.calls++
	return s.acquired, s.err
}

// ── tests ──────────────────────────────────────────────────────────────────

func TestRenewer_RenewsWhenLockAcquired(t *testing.T) {
	db := &stubQuotaRenewer{count: 7}
	locker := &stubLocker{acquired: true}
	r := billing.NewRenewer(db, locker, time.Minute)

	if err := r.TryRenew(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(db.calls) != 1 {
		t.Fatalf("want 1 RenewMonth call, got %d", len(db.calls))
	}
}

func TestRenewer_SkipsWhenLockNotAcquired(t *testing.T) {
	db := &stubQuotaRenewer{count: 3}
	locker := &stubLocker{acquired: false}
	r := billing.NewRenewer(db, locker, time.Minute)

	if err := r.TryRenew(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(db.calls) != 0 {
		t.Fatalf("want 0 RenewMonth calls when lock not acquired, got %d", len(db.calls))
	}
}

func TestRenewer_ReturnsLockError(t *testing.T) {
	locker := &stubLocker{err: errors.New("redis down")}
	r := billing.NewRenewer(&stubQuotaRenewer{}, locker, time.Minute)

	err := r.TryRenew(context.Background())
	if err == nil {
		t.Fatal("expected error from lock failure, got nil")
	}
}

func TestRenewer_ReturnsDBError(t *testing.T) {
	db := &stubQuotaRenewer{err: errors.New("db error")}
	locker := &stubLocker{acquired: true}
	r := billing.NewRenewer(db, locker, time.Minute)

	err := r.TryRenew(context.Background())
	if err == nil {
		t.Fatal("expected error from db failure, got nil")
	}
}

func TestRenewer_RunStopsOnContextCancel(t *testing.T) {
	db := &stubQuotaRenewer{count: 1}
	locker := &stubLocker{acquired: true}
	r := billing.NewRenewer(db, locker, 50*time.Millisecond)

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Millisecond)
	defer cancel()

	done := make(chan struct{})
	go func() {
		r.Run(ctx)
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("Run did not stop after context cancellation")
	}
}
