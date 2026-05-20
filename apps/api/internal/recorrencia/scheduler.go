package recorrencia

import (
	"context"
	"encoding/json"
	"time"

	"github.com/rs/zerolog"
)

// SchedulerLocker is the minimal interface needed to acquire a distributed lock.
// Satisfied by billing.RedisLocker (the same locker used by the Poller and Requeuer).
type SchedulerLocker interface {
	Acquire(ctx context.Context, key string, ttl time.Duration) (bool, error)
}

const (
	schedulerLockKey = "rec:scheduler:lock"
	// schedulerLockTTL must exceed the scheduler interval so only one API replica
	// runs the tick at a time. With a 1 h interval the lock TTL is 55 min —
	// short enough to self-heal if the holding instance crashes mid-tick.
	schedulerLockTTL = 55 * time.Minute
)

// NotaEmissor is a minimal interface used by the Scheduler to emit notas.
// The real implementation is provided by the nfse handler/service layer;
// a NoopEmissor stub is used during development and tests.
type NotaEmissor interface {
	EmitirNota(ctx context.Context, meiID string, req map[string]interface{}) (string, error)
}

// NoopEmissor is a no-op stub that satisfies NotaEmissor.
// It logs the intent without making any real API calls.
type NoopEmissor struct{}

// EmitirNota implements NotaEmissor by returning a fake nota_id.
func (NoopEmissor) EmitirNota(_ context.Context, meiID string, req map[string]interface{}) (string, error) {
	return "noop-nota-id", nil
}

// Scheduler polls for due recorrencias and emits notas on their schedule.
type Scheduler struct {
	repo     *Repository
	emissor  NotaEmissor
	log      zerolog.Logger
	interval time.Duration
	locker   SchedulerLocker // optional; nil disables distributed locking (not recommended in prod)
}

// NewScheduler creates a Scheduler.
// interval controls how often the scheduler checks for due records.
// Pass time.Hour for production usage.
//
// Always attach a locker via WithLocker when running more than one API replica;
// without it both instances will query ListDue simultaneously and attempt to emit
// the same recorrencias twice.
func NewScheduler(repo *Repository, emissor NotaEmissor, interval time.Duration) *Scheduler {
	return &Scheduler{
		repo:     repo,
		emissor:  emissor,
		log:      zerolog.Ctx(context.Background()).With().Str("component", "recorrencia_scheduler").Logger(),
		interval: interval,
	}
}

// WithLocker attaches a distributed lock so that only one API replica runs
// the scheduler tick at a time (prevents double-emission with numReplicas > 1).
func (s *Scheduler) WithLocker(l SchedulerLocker) *Scheduler {
	s.locker = l
	return s
}

// Run starts the scheduler loop. It blocks until ctx is cancelled.
// Call it in a goroutine: go sched.Run(ctx).
func (s *Scheduler) Run(ctx context.Context) {
	s.log.Info().Dur("interval", s.interval).Msg("scheduler iniciado")

	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	// Run immediately on startup so there is no delay on first boot.
	s.tick(ctx)

	for {
		select {
		case <-ctx.Done():
			s.log.Info().Msg("scheduler encerrado")
			return
		case <-ticker.C:
			s.tick(ctx)
		}
	}
}

// tick performs one scheduler cycle: query due records, attempt emission.
func (s *Scheduler) tick(ctx context.Context) {
	// Distributed lock: with numReplicas=2 both instances would fire simultaneously
	// without this guard, causing each recorrencia to be emitted twice per cycle.
	if s.locker != nil {
		acquired, err := s.locker.Acquire(ctx, schedulerLockKey, schedulerLockTTL)
		if err != nil {
			s.log.Error().Err(err).Msg("scheduler: failed to acquire distributed lock — skipping tick")
			return
		}
		if !acquired {
			s.log.Debug().Msg("scheduler: another instance holds the lock — skipping tick")
			return
		}
	} else {
		s.log.Warn().Msg("scheduler: no distributed lock configured — double-emission risk with multiple replicas (wire WithLocker)")
	}

	due, err := s.repo.ListDue(ctx, time.Now())
	if err != nil {
		s.log.Error().Err(err).Msg("erro ao buscar recorrencias vencidas")
		return
	}

	for _, rec := range due {
		s.process(ctx, rec)
	}
}

// process attempts to emit a nota for a single recorrencia.
func (s *Scheduler) process(ctx context.Context, rec Recorrencia) {
	logger := s.log.With().
		Str("recorrencia_id", rec.ID).
		Str("mei_id", rec.MeiID).
		Logger()

	// Derive competencia (YYYY-MM) from proxima_emissao.
	competencia := ""
	if len(rec.ProximaEmissao) >= 7 {
		competencia = rec.ProximaEmissao[:7] // "YYYY-MM"
	}

	// Build the emission request map from stored JSONB blobs.
	var servicoMap, tomadorMap map[string]interface{}
	if err := json.Unmarshal(rec.Servico, &servicoMap); err != nil {
		logger.Error().Err(err).Msg("servico JSONB inválido — pulando recorrencia")
		return
	}
	if err := json.Unmarshal(rec.Tomador, &tomadorMap); err != nil {
		logger.Error().Err(err).Msg("tomador JSONB inválido — pulando recorrencia")
		return
	}

	req := map[string]interface{}{
		"servico":     servicoMap,
		"tomador":     tomadorMap,
		"competencia": competencia,
	}
	if rec.WebhookURL != "" {
		req["webhook_url"] = rec.WebhookURL
	}

	notaID, err := s.emissor.EmitirNota(ctx, rec.MeiID, req)
	if err != nil {
		logger.Error().
			Err(err).
			Bool("success", false).
			Str("competencia", competencia).
			Msg("falha ao emitir nota recorrente")
		return
	}

	// Advance the schedule.
	if markErr := s.repo.MarkEmitted(ctx, rec.ID, time.Now()); markErr != nil {
		logger.Error().Err(markErr).Str("nota_id", notaID).
			Msg("nota emitida mas falha ao avançar proxima_emissao")
		return
	}

	logger.Info().
		Bool("success", true).
		Str("nota_id", notaID).
		Str("competencia", competencia).
		Msg("nota recorrente emitida com sucesso")
}
