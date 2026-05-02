package nfse

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

// ─── stubs ────────────────────────────────────────────────────────────────────

type stubStuckLocker struct {
	acquired bool
	err      error
	calls    int
}

func (s *stubStuckLocker) Acquire(_ context.Context, _ string, _ time.Duration) (bool, error) {
	s.calls++
	return s.acquired, s.err
}

type stubStuckRepo struct {
	notas  []Nota
	qErr   error
	marked []uuid.UUID
	mErr   error
}

func (r *stubStuckRepo) FindProcessandoSemProtocolo(_ context.Context, _ time.Duration, _ int) ([]Nota, error) {
	return r.notas, r.qErr
}

func (r *stubStuckRepo) MarcarErroTemporario(_ context.Context, notaID uuid.UUID, _, _ string) error {
	if r.mErr != nil {
		return r.mErr
	}
	r.marked = append(r.marked, notaID)
	return nil
}

// ─── tests ────────────────────────────────────────────────────────────────────

func TestStuckPoller_SweepMarksStuckNotas(t *testing.T) {
	id1 := uuid.New()
	id2 := uuid.New()
	repo := &stubStuckRepo{
		notas: []Nota{
			{ID: id1, Status: "PROCESSANDO"},
			{ID: id2, Status: "PROCESSANDO"},
		},
	}
	locker := &stubStuckLocker{acquired: true}
	p := NewStuckPoller(repo, locker, 2*time.Minute, 30*time.Second, 50)

	p.sweep(context.Background())

	if len(repo.marked) != 2 {
		t.Errorf("expected 2 notas marked, got %d", len(repo.marked))
	}
}

func TestStuckPoller_SweepSkipsWhenLockNotAcquired(t *testing.T) {
	repo := &stubStuckRepo{
		notas: []Nota{{ID: uuid.New(), Status: "PROCESSANDO"}},
	}
	locker := &stubStuckLocker{acquired: false}
	p := NewStuckPoller(repo, locker, 2*time.Minute, 30*time.Second, 50)

	p.sweep(context.Background())

	if len(repo.marked) != 0 {
		t.Errorf("expected 0 notas marked when lock not acquired, got %d", len(repo.marked))
	}
}

func TestStuckPoller_SweepHandlesLockError(t *testing.T) {
	repo := &stubStuckRepo{}
	locker := &stubStuckLocker{err: errors.New("redis down")}
	p := NewStuckPoller(repo, locker, 2*time.Minute, 30*time.Second, 50)

	// Must not panic.
	p.sweep(context.Background())

	if len(repo.marked) != 0 {
		t.Errorf("expected 0 notas marked on lock error, got %d", len(repo.marked))
	}
}

func TestStuckPoller_SweepHandlesQueryError(t *testing.T) {
	repo := &stubStuckRepo{qErr: errors.New("db error")}
	locker := &stubStuckLocker{acquired: true}
	p := NewStuckPoller(repo, locker, 2*time.Minute, 30*time.Second, 50)

	// Must not panic.
	p.sweep(context.Background())

	if len(repo.marked) != 0 {
		t.Errorf("expected 0 notas marked on query error, got %d", len(repo.marked))
	}
}

func TestStuckPoller_SweepContinuesOnMarkError(t *testing.T) {
	id1 := uuid.New()
	id2 := uuid.New()
	repo := &stubStuckRepo{
		notas: []Nota{
			{ID: id1, Status: "PROCESSANDO"},
			{ID: id2, Status: "PROCESSANDO"},
		},
		mErr: errors.New("update failed"),
	}
	locker := &stubStuckLocker{acquired: true}
	p := NewStuckPoller(repo, locker, 2*time.Minute, 30*time.Second, 50)

	// Must not panic — errors are logged but loop continues.
	p.sweep(context.Background())

	if len(repo.marked) != 0 {
		t.Errorf("expected 0 successfully marked notas, got %d", len(repo.marked))
	}
}

func TestStuckPoller_SweepNoOp_WhenEmpty(t *testing.T) {
	repo := &stubStuckRepo{notas: nil}
	locker := &stubStuckLocker{acquired: true}
	p := NewStuckPoller(repo, locker, 2*time.Minute, 30*time.Second, 50)

	p.sweep(context.Background())
	// No panic, no marks.
}

func TestStuckPoller_RunStopsOnContextCancel(t *testing.T) {
	repo := &stubStuckRepo{}
	locker := &stubStuckLocker{acquired: false}
	p := NewStuckPoller(repo, locker, 2*time.Minute, 30*time.Second, 50)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	done := make(chan struct{})
	go func() {
		p.Run(ctx)
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Error("Run did not stop after context cancellation")
	}
}
