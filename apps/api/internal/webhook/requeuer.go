package webhook

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"
)

// SweepFunc is a function that returns pending DeliveryMessages from the DB.
// The caller (worker main) provides this as a closure over the nota repository,
// mapping nfse.Nota rows into DeliveryMessage values.
type SweepFunc func(ctx context.Context, limit int) ([]DeliveryMessage, error)

// RequeueLock acquires a distributed lock so that only one Worker instance
// runs the requeue sweep at a time, preventing duplicate webhook deliveries.
// Returns (true, nil) when the lock was acquired; (false, nil) when another
// instance holds it.
type RequeueLock interface {
	Acquire(ctx context.Context, key string, ttl time.Duration) (bool, error)
}

const (
	requeueLockKey = "wbk:requeue:lock"
	// requeueLockTTL must be long enough to cover a full sweep cycle (100 msgs).
	// 10 minutes is ample; the lock auto-expires if the instance crashes.
	requeueLockTTL = 10 * time.Minute
)

// Requeuer periodically sweeps the DB for undelivered webhooks and re-publishes
// them to the RabbitMQ queue, acting as a safety net for messages that were
// never enqueued (e.g. due to server crashes between DB write and AMQP publish).
type Requeuer struct {
	sweepFn   SweepFunc
	publisher *Publisher
	interval  time.Duration
	locker    RequeueLock // optional; nil disables the distributed lock
}

// NewRequeuer creates a Requeuer that sweeps at the given interval.
func NewRequeuer(sweepFn SweepFunc, publisher *Publisher, interval time.Duration) *Requeuer {
	return &Requeuer{
		sweepFn:   sweepFn,
		publisher: publisher,
		interval:  interval,
	}
}

// WithLocker attaches a distributed lock so that only one Worker instance
// runs the requeue sweep in any given window, preventing duplicate deliveries
// when the service is horizontally scaled (SCALE-01).
func (r *Requeuer) WithLocker(l RequeueLock) *Requeuer {
	r.locker = l
	return r
}

// Run starts the requeue loop. It blocks until ctx is cancelled.
func (r *Requeuer) Run(ctx context.Context) {
	log.Ctx(ctx).Info().Dur("interval", r.interval).Msg("webhook requeuer started")
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	// Run one sweep immediately on startup.
	r.sweep(ctx)

	for {
		select {
		case <-ctx.Done():
			log.Ctx(ctx).Info().Msg("webhook requeuer stopping")
			return
		case <-ticker.C:
			r.sweep(ctx)
		}
	}
}

func (r *Requeuer) sweep(ctx context.Context) {
	// ── Distributed lock (SCALE-01) ─────────────────────────────────────────
	// Without the lock, two Worker pods running simultaneously would both fetch
	// the same pending webhooks and publish them to RabbitMQ twice — resulting
	// in duplicate webhook deliveries to the MEI's endpoint.
	if r.locker != nil {
		acquired, err := r.locker.Acquire(ctx, requeueLockKey, requeueLockTTL)
		if err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("requeuer: failed to acquire redis lock — skipping sweep")
			return
		}
		if !acquired {
			log.Ctx(ctx).Debug().Msg("requeuer: another instance is running sweep — skipping")
			return
		}
	}

	msgs, err := r.sweepFn(ctx, 100)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("requeuer: failed to query pending webhooks")
		return
	}
	if len(msgs) == 0 {
		return
	}

	log.Ctx(ctx).Info().Int("count", len(msgs)).Msg("requeuer: re-publishing pending webhooks")

	for _, msg := range msgs {
		if err := r.publisher.Publish(ctx, msg); err != nil {
			log.Ctx(ctx).Error().Err(err).Str("nota_id", msg.NotaID).Msg("requeuer: publish failed")
		}
	}
}
