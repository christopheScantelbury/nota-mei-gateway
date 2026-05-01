package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/config"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/nfse"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/webhook"
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

	// ── Nota repository ────────────────────────────────────────────────────
	notaRepo := nfse.NewNotaRepository(db)

	// ── API base URL ───────────────────────────────────────────────────────
	apiBase := "https://api.notameigateway.com.br"
	if cfg.AppEnv == "development" {
		apiBase = "http://localhost:8080"
	}

	// ── Webhook consumer ───────────────────────────────────────────────────
	consumer, err := webhook.NewConsumer(cfg.RabbitMQURL, notaRepo, apiBase)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to init webhook consumer")
	}
	defer consumer.Close()

	log.Info().Str("env", cfg.AppEnv).Msg("webhook worker iniciado")

	if err := consumer.Start(ctx); err != nil && err != context.Canceled {
		log.Fatal().Err(err).Msg("worker exited with error")
	}

	log.Info().Msg("worker encerrado")
}
