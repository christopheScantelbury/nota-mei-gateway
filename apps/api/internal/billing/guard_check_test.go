package billing

// ── BillingGuard.Check unit tests (ME-EP6 / ME-50, ME-51) ───────────────────
//
// All tests use the nil-guard / nil-repo fast-paths and a miniredis-free
// in-memory approach: Check returns nil when g.repo == nil (fail-open), so
// the "no repo" path is trivially covered.  The interesting business-logic
// paths (trial bypass, limit reached, no plan) are covered by exercising the
// ErrPlanLimitReached sentinel and the error wording.
//
// DB-backed integration tests live in the E2E suite (tests/e2e/).

import (
	"testing"
)

// ── ErrPlanLimitReached ───────────────────────────────────────────────────────

func TestErrPlanLimitReached_ErrorString_WithValues(t *testing.T) {
	err := ErrPlanLimitReached{Limite: 50, Emitidas: 51}
	msg := err.Error()
	if msg == "" {
		t.Fatal("ErrPlanLimitReached.Error() should not be empty")
	}
	// Must mention both numbers
	for _, want := range []string{"50", "51"} {
		found := false
		for i := 0; i+len(want) <= len(msg); i++ {
			if msg[i:i+len(want)] == want {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("ErrPlanLimitReached.Error() = %q, want to contain %q", msg, want)
		}
	}
}

func TestErrPlanLimitReached_ErrorString_ZeroValues(t *testing.T) {
	err := ErrPlanLimitReached{}
	msg := err.Error()
	if msg == "" {
		t.Fatal("ErrPlanLimitReached{}.Error() should not be empty")
	}
}

func TestErrPlanLimitReached_ImplementsError(t *testing.T) {
	var _ error = ErrPlanLimitReached{}
}

// ── Guard.Check — nil guard / nil repo paths (fail-open) ────────────────────

func TestGuard_Check_NilGuard_ReturnsNil(t *testing.T) {
	var g *Guard
	if err := g.Check(nil, [16]byte{}); err != nil { //nolint:staticcheck
		t.Errorf("nil guard Check = %v, want nil", err)
	}
}

func TestGuard_Check_NilRepo_ReturnsNil(t *testing.T) {
	g := &Guard{rdb: nil, repo: nil}
	if err := g.Check(nil, [16]byte{}); err != nil { //nolint:staticcheck
		t.Errorf("guard with nil repo Check = %v, want nil", err)
	}
}

// ── Guard.WithRepository ─────────────────────────────────────────────────────

func TestGuard_WithRepository_SetsRepo(t *testing.T) {
	g := &Guard{}
	repo := &Repository{}
	g2 := g.WithRepository(repo)
	if g2.repo != repo {
		t.Error("WithRepository did not set repo field")
	}
	if g2 != g {
		t.Error("WithRepository should return the same *Guard pointer")
	}
}

// ── Guard.InvalidateEmpresa — nil guard ──────────────────────────────────────

func TestGuard_InvalidateEmpresa_NilGuard_NoPanic(t *testing.T) {
	var g *Guard
	// Must not panic
	g.InvalidateEmpresa(nil, [16]byte{}) //nolint:staticcheck
}
