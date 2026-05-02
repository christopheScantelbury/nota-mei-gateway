package nfse

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

const (
	stuckLockKey = "nfs:stuck:lock"
	stuckLockTTL = 2 * time.Minute
)

// StuckLocker acquires a distributed lock. Returns (true, nil) when the lock
// was acquired, (false, nil) when it is already held by another instance.
type StuckLocker interface {
	Acquire(ctx context.Context, key string, ttl time.Duration) (bool, error)
}

// StuckNotaRepo is the subset of NotaRepository needed by StuckPoller.
type StuckNotaRepo interface {
	FindProcessandoSemProtocolo(ctx context.Context, olderThan time.Duration, limit int) ([]Nota, error)
	MarcarErroTemporario(ctx context.Context, notaID uuid.UUID, erroCodigo, erroDescricao string) error
}

// StuckPoller detects PROCESSANDO notas that never received a protocol from the
// Receita Federal (i.e. Enviar failed silently) and transitions them to
// ERRO_TEMPORARIO so they can be retried or surfaced to the MEI.
type StuckPoller struct {
	repo     StuckNotaRepo
	locker   StuckLocker
	age      time.Duration
	interval time.Duration
	limit    int
}

// NewStuckPoller returns a StuckPoller configured to find notas older than age
// and sweep every interval, processing at most limit notas per cycle.
func NewStuckPoller(repo StuckNotaRepo, locker StuckLocker, age, interval time.Duration, limit int) *StuckPoller {
	return &StuckPoller{
		repo:     repo,
		locker:   locker,
		age:      age,
		interval: interval,
		limit:    limit,
	}
}

// Run sweeps immediately on start, then on each interval tick until ctx is
// cancelled.
func (p *StuckPoller) Run(ctx context.Context) {
	p.sweep(ctx)

	ticker := time.NewTicker(p.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			p.sweep(ctx)
		}
	}
}

// sweep finds stuck notas and marks them ERRO_TEMPORARIO.
func (p *StuckPoller) sweep(ctx context.Context) {
	acquired, err := p.locker.Acquire(ctx, stuckLockKey, stuckLockTTL)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("stuck_poller: failed to acquire redis lock")
		return
	}
	if !acquired {
		return
	}

	notas, err := p.repo.FindProcessandoSemProtocolo(ctx, p.age, p.limit)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("stuck_poller: query failed")
		return
	}

	if len(notas) == 0 {
		return
	}

	marked := 0
	for _, n := range notas {
		if err := p.repo.MarcarErroTemporario(ctx, n.ID, "STUCK", "nota sem protocolo após timeout — reenvio necessário"); err != nil {
			log.Ctx(ctx).Error().Err(err).
				Str("nota_id", n.ID.String()).
				Msg("stuck_poller: failed to mark nota as ERRO_TEMPORARIO")
			continue
		}
		marked++
	}

	log.Ctx(ctx).Info().
		Int("found", len(notas)).
		Int("marked", marked).
		Msg("stuck_poller: sweep complete")
}
