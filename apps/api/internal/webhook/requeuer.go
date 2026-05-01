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

// Requeuer periodically sweeps the DB for undelivered webhooks and re-publishes
// them to the RabbitMQ queue, acting as a safety net for messages that were
// never enqueued (e.g. due to server crashes between DB write and AMQP publish).
type Requeuer struct {
	sweepFn   SweepFunc
	publisher *Publisher
	interval  time.Duration
}

// NewRequeuer creates a Requeuer that sweeps at the given interval.
func NewRequeuer(sweepFn SweepFunc, publisher *Publisher, interval time.Duration) *Requeuer {
	return &Requeuer{
		sweepFn:   sweepFn,
		publisher: publisher,
		interval:  interval,
	}
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
