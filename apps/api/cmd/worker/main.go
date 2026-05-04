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
	publisher, err := webhook.NewPublisher(cfg.RabbitMQURL)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to init webhook publisher")
	}
	defer publisher.Close()

	// ── Webhook consumer ───────────────────────────────────────────────────
	consumer, err := webhook.NewConsumer(cfg.RabbitMQURL, notaRepo, apiBase)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to init webhook consumer")
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
	stuckPoller := nfse.NewStuckPoller(notaRepo, redisLocker, 2*time.Minute, 30*time.Second, 50)

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
