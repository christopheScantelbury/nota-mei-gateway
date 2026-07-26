package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/billing"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/config"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/nfse"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/webhook"
	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/cert"
	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/supabase"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	cfg := config.Load()

	// ── Logger ─────────────────────────────────────────────────────────────
	level, _ := zerolog.ParseLevel(cfg.LogLevel)
	zerolog.SetGlobalLevel(level)
	if cfg.AppEnv == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}
	// Fallback for log.Ctx() — same rationale as cmd/server/main.go.
	zerolog.DefaultContextLogger = &log.Logger

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// ── Database ───────────────────────────────────────────────────────────
	db, err := supabase.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer db.Close()

	// ── Certificate provider ───────────────────────────────────────────────
	certProv, err := cert.New(ctx, cfg.AWSRegion)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to init cert provider")
	}

	// ── Billing renewer ────────────────────────────────────────────────────
	billingRepo := billing.NewRepository(db)
	redisLocker, err := billing.NewRedisLocker(cfg.RedisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to init redis locker")
	}
	renewer := billing.NewRenewer(billingRepo, redisLocker, 24*time.Hour)

	// ── Nota repository ────────────────────────────────────────────────────
	notaRepo := nfse.NewNotaRepository(db)

	// ── NFS-e adapter ──────────────────────────────────────────────────────
	adapter := nfse.NewAdapter(cfg.ReceitaAPIURL)

	// ── API base URL ───────────────────────────────────────────────────────
	apiBase := cfg.APIBaseURL
	if cfg.AppEnv == "development" {
		apiBase = "http://localhost:8080"
	}

	// ── RabbitMQ publisher ─────────────────────────────────────────────────
	// Retry no boot em vez de crashar: quando o RabbitMQ redeploya no Railway,
	// o worker sobe antes dele ficar pronto. Antes isto era log.Fatal → crash
	// loop (incidente 2026-07-26, issue #256). Espera o ctx OU o RabbitMQ subir.
	publisher, err := dialWithRetry(ctx, "webhook publisher", func() (*webhook.Publisher, error) {
		return webhook.NewPublisher(cfg.RabbitMQURL)
	})
	if err != nil {
		log.Info().Msg("worker encerrado durante espera do RabbitMQ (publisher)")
		return
	}
	defer publisher.Close()

	// ── Webhook consumer ───────────────────────────────────────────────────
	consumer, err := dialWithRetry(ctx, "webhook consumer", func() (*webhook.Consumer, error) {
		return webhook.NewConsumer(cfg.RabbitMQURL, notaRepo, apiBase)
	})
	if err != nil {
		log.Info().Msg("worker encerrado durante espera do RabbitMQ (consumer)")
		return
	}
	defer consumer.Close()

	// ── NFS-e status poller ────────────────────────────────────────────────
	// Polls the Receita Federal every 30s for PROCESSANDO notas with a protocol.
	// WithLocker ensures that concurrent Worker instances never process the same
	// nota in parallel (SCALE-01: per-nota Redis lock + DB status guard).
	poller := nfse.NewPoller(notaRepo, adapter, certProv, publisher, 30*time.Second).
		WithBillingCounter(billingRepo).
		WithLocker(redisLocker)

	// ── Stuck nota poller ─────────────────────────────────────────────────────
	// Marks PROCESSANDO notas that never received a protocol as ERRO_TEMPORARIO
	// after 2 minutes, cycling every 30 seconds.
	// Interval matches the lock TTL (2 min) to avoid burning Redis SETNX calls
	// on ticks that will always see the lock already held. Previously the interval
	// was 30s with a 2-min TTL, wasting 75% of Redis round-trips.
	stuckPoller := nfse.NewStuckPoller(notaRepo, redisLocker, 2*time.Minute, nfse.DefaultStuckInterval, 50)

	// ── Webhook requeuer ───────────────────────────────────────────────────
	// Sweeps the DB every 5 minutes for undelivered webhooks and re-publishes them.
	// WithLocker prevents duplicate deliveries when multiple Worker pods run (SCALE-01).
	sweepFn := buildSweepFn(notaRepo, cfg.WebhookHMACSecret)
	requeuer := webhook.NewRequeuer(sweepFn, publisher, 5*time.Minute).
		WithLocker(redisLocker)

	log.Info().Str("env", cfg.AppEnv).Msg("webhook worker iniciado")

	// ── Run all goroutines until SIGINT/SIGTERM ─────────────────────────────
	done := make(chan error, 5)

	go func() { done <- consumer.Start(ctx) }()
	go func() {
		poller.Run(ctx)
		done <- nil
	}()
	go func() {
		stuckPoller.Run(ctx)
		done <- nil
	}()
	go func() {
		requeuer.Run(ctx)
		done <- nil
	}()
	go func() {
		renewer.Run(ctx)
		done <- nil
	}()

	// Wait for first goroutine to return (or ctx cancel).
	select {
	case err := <-done:
		if err != nil && err != context.Canceled {
			log.Fatal().Err(err).Msg("worker goroutine exited with error")
		}
	case <-ctx.Done():
	}

	log.Info().Msg("worker encerrado")
}

// dialWithRetry chama dial() até obter sucesso ou o ctx ser cancelado, com
// backoff exponencial (1s → 30s). Usado no boot pra esperar o RabbitMQ ficar
// pronto em vez de crashar o worker (issue #256).
func dialWithRetry[T any](ctx context.Context, what string, dial func() (T, error)) (T, error) {
	backoff := time.Second
	const maxBackoff = 30 * time.Second
	for {
		v, err := dial()
		if err == nil {
			return v, nil
		}
		log.Warn().Err(err).Str("dep", what).Dur("retry_in", backoff).
			Msg("dependência indisponível no boot — retry (sem crashar)")
		select {
		case <-ctx.Done():
			var zero T
			return zero, ctx.Err()
		case <-time.After(backoff):
		}
		if backoff < maxBackoff {
			backoff *= 2
		}
	}
}

// buildSweepFn creates the SweepFunc closure that maps nfse.Nota → webhook.DeliveryMessage.
func buildSweepFn(repo *nfse.NotaRepository, hmacSecret string) webhook.SweepFunc {
	return func(ctx context.Context, limit int) ([]webhook.DeliveryMessage, error) {
		notas, err := repo.FindPendingWebhooks(ctx, limit)
		if err != nil {
			return nil, err
		}

		msgs := make([]webhook.DeliveryMessage, 0, len(notas))
		for _, n := range notas {
			if n.WebhookURL == nil {
				continue
			}
			msg := webhook.DeliveryMessage{
				NotaID:        n.ID.String(),
				Event:         statusToEvent(n.Status),
				Status:        n.Status,
				WebhookURL:    *n.WebhookURL,
				WebhookSecret: hmacSecret,
			}
			if n.NumeroNFSe != nil {
				msg.NumeroNFSe = *n.NumeroNFSe
			}
			if n.CodVerificacao != nil {
				msg.CodVerificacao = *n.CodVerificacao
			}
			if n.ErroCodigo != nil {
				msg.ErroCodigo = *n.ErroCodigo
			}
			if n.ErroDescricao != nil {
				msg.ErroDescricao = *n.ErroDescricao
			}
			if n.EmitidaEm != nil {
				msg.EmitidaEm = *n.EmitidaEm
			}
			msgs = append(msgs, msg)
		}
		return msgs, nil
	}
}

// statusToEvent maps a nota status string to a webhook EventType.
func statusToEvent(status string) webhook.EventType {
	switch status {
	case "AUTORIZADA":
		return webhook.EventAutorizada
	case "REJEITADA":
		return webhook.EventRejeitada
	case "CANCELADA":
		return webhook.EventCancelada
	default:
		return webhook.EventType(status)
	}
}
