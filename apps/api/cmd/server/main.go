package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/billing"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/config"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/document"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/handler"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/middleware"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/nfse"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/sandbox"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/webhook"
	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/cert"
	stripeClient "github.com/christopheScantelbury/nota-mei-gateway/api/pkg/stripe"
	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/supabase"
	"github.com/gofiber/fiber/v2"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/valyala/fasthttp/fasthttpadaptor"
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

	// ── Infrastructure ─────────────────────────────────────────────────────
	db, err := supabase.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer db.Close()

	// cert.New only loads AWS SDK config; actual credentials are verified on first call.
	certProv, err := cert.New(ctx, cfg.AWSRegion, cfg.AWSKMSKeyARN)
	if err != nil {
		log.Warn().Err(err).Msg("cert provider unavailable — certificate features disabled")
		certProv = nil
	}

	billingGrd, err := billing.NewGuard(cfg.RedisURL)
	if err != nil {
		log.Warn().Err(err).Msg("billing guard unavailable — emission limits not enforced")
		billingGrd = nil
	}

	rateLimiter, err := middleware.NewRateLimiter(cfg.RedisURL, 100)
	if err != nil {
		log.Warn().Err(err).Msg("rate limiter unavailable — rate limiting disabled")
		rateLimiter = nil
	}

	// RabbitMQ dials immediately; if not yet ready, API starts without webhook delivery.
	publisher, err := webhook.NewPublisher(cfg.RabbitMQURL)
	if err != nil {
		log.Warn().Err(err).Msg("RabbitMQ unavailable — webhook delivery disabled")
		publisher = nil
	}
	defer publisher.Close()

	sc := stripeClient.New(cfg.StripeSecretKey)

	// ── Repositories ───────────────────────────────────────────────────────
	authRepo := auth.NewRepository(db)
	billingRepo := billing.NewRepository(db)
	notaRepo := nfse.NewNotaRepository(db)

	// ── Adapters & builders ────────────────────────────────────────────────
	adapter := nfse.NewAdapter(cfg.ReceitaAPIURL)
	builder := document.NewBuilder()

	// XMLDSigSigner is used in staging/production where a real A1 certificate
	// is loaded from AWS Secrets Manager.  NoopSigner is kept for local
	// development because no real certificate is available without AUTH-04.
	var signer document.Signer = document.NoopSigner{}
	if cfg.AppEnv != "development" {
		signer = document.XMLDSigSigner{}
	}

	// ── NBS validator (Redis cache + DB fallback) ──────────────────────────
	nbsValidator, err := document.NewNBSValidator(cfg.RedisURL, db.Pool())
	if err != nil {
		log.Warn().Err(err).Msg("NBS validator unavailable — NBS validation will use DB-only fallback")
		nbsValidator = nil
	} else if err := nbsValidator.Warm(ctx); err != nil {
		log.Warn().Err(err).Msg("NBS warm failed — validator will fall back to DB")
	}

	// ── ISS rate lookup (in-memory, loaded from DB at startup) ────────────
	issLookup, err := document.NewISSLookup(ctx, db.Pool())
	if err != nil {
		log.Warn().Err(err).Msg("ISS lookup unavailable — ISS rates will not be validated at startup")
		issLookup = nil
	}

	// ── Handlers ───────────────────────────────────────────────────────────
	apiBase := "https://api.notameigateway.com.br"
	if cfg.AppEnv == "development" {
		apiBase = "http://localhost:" + cfg.Port
	}

	cnpjValidator, err := auth.NewCNPJValidator(cfg.RedisURL)
	if err != nil {
		log.Warn().Err(err).Msg("CNPJ validator unavailable — CNPJ dedup cache disabled")
	}

	registerH := handler.NewRegisterHandler(authRepo).WithCNPJValidator(cnpjValidator)
	certH := handler.NewCertificateHandler(certProv, authRepo, db)
	seedH := handler.NewSeedHandler(auth.NewSeeder(db))

	nfseH := handler.NewNFSeHandler(
		notaRepo, adapter, builder, signer, certProv,
		billingRepo, billingGrd, publisher,
		apiBase, cfg.WebhookHMACSecret,
	).WithNBSValidator(nbsValidator).WithISSLookup(issLookup).WithStripeClient(sc)
	billingH := handler.NewBillingHandler(
		sc,
		cfg.StripePriceStarter, cfg.StripePriceBasic,
		cfg.StripePricePro, cfg.StripePriceBusiness,
		apiBase,
	)
	stripeWH := handler.NewStripeWebhookHandler(cfg.StripeWebhookSecret, db).
		WithBillingGuard(billingGrd)

	// ── Fiber app ──────────────────────────────────────────────────────────
	app := fiber.New(fiber.Config{
		AppName:      "Nota MEI Gateway",
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		// Disable error stack in production.
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"error":      "INTERNAL_ERROR",
				"message":    err.Error(),
				"request_id": c.Locals("request_id"),
			})
		},
	})

	app.Use(middleware.PanicRecovery())
	app.Use(middleware.RequestLogger())
	app.Use(middleware.PrometheusMetrics())

	// ── Public endpoints ───────────────────────────────────────────────────
	app.Get("/v1/health", func(c *fiber.Ctx) error {
		if err := db.Pool().Ping(c.Context()); err != nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"status": "degraded",
				"db":     "unhealthy",
			})
		}
		return c.JSON(fiber.Map{
			"status": "ok",
			"env":    cfg.AppEnv,
		})
	})

	// Prometheus metrics — scraped by Grafana Agent running in Railway.
	metricsH := fasthttpadaptor.NewFastHTTPHandler(promhttp.Handler())
	app.Get("/metrics", func(c *fiber.Ctx) error {
		metricsH(c.Context())
		return nil
	})

	// MEI registration — public, no Bearer token required.
	app.Post("/v1/auth/register", registerH.Register)

	// Stripe webhook — raw body needed for signature verification.
	app.Post("/v1/webhooks/stripe", stripeWH.Handle)

	// ── Sandbox (public demo, no real Receita Federal calls) ───────────────
	sbx := sandbox.New()
	sbxGroup := app.Group("/v1", func(c *fiber.Ctx) error {
		if !sandbox.IsSandboxKey(c.Get("Authorization")) {
			return c.Next() // not a sandbox request — fall through to real auth
		}
		return c.Next()
	}, sbx.RateLimitMiddleware)

	sbxGroup.Post("/nfse", func(c *fiber.Ctx) error {
		if !sandbox.IsSandboxKey(c.Get("Authorization")) {
			return c.Next()
		}
		return sbx.EmitirNota(c)
	})
	sbxGroup.Get("/nfse", func(c *fiber.Ctx) error {
		if !sandbox.IsSandboxKey(c.Get("Authorization")) {
			return c.Next()
		}
		return sbx.ListarNotas(c)
	})
	sbxGroup.Get("/nfse/:id", func(c *fiber.Ctx) error {
		if !sandbox.IsSandboxKey(c.Get("Authorization")) {
			return c.Next()
		}
		return sbx.ConsultarNota(c)
	})
	// Sandbox webhook receiver — public, no auth needed.
	app.Post("/v1/sandbox/webhook", sbx.ReceiveWebhook)
	app.Get("/v1/sandbox/webhook", sbx.ListWebhooks)

	// Seed endpoint — only available outside production.
	if cfg.AppEnv != "production" {
		app.Post("/v1/sandbox/seed", seedH.Seed)
	}

	// ── Authenticated endpoints ────────────────────────────────────────────
	authMw := auth.Middleware(authRepo)

	var rlMw fiber.Handler
	if rateLimiter != nil {
		rlMw = rateLimiter.Middleware()
	} else {
		rlMw = func(c *fiber.Ctx) error { return c.Next() } // no-op when Redis unavailable
	}
	v1 := app.Group("/v1", authMw, rlMw)

	// NFS-e
	v1.Post("/nfse", nfseH.EmitirNota)
	v1.Get("/nfse", nfseH.ListarNotas)
	v1.Get("/nfse/:id", nfseH.ConsultarNota)
	v1.Delete("/nfse/:id", nfseH.CancelarNota)
	v1.Get("/nfse/:id/xml", nfseH.DownloadXML)
	v1.Get("/nfse/:id/pdf", nfseH.DownloadPDF)

	// Auth (authenticated — certificate renewal)
	v1.Post("/auth/certificate", certH.Renew)

	// Billing
	v1.Get("/billing/usage", billingH.GetUsage)
	v1.Get("/billing/portal", billingH.GetPortal)
	v1.Post("/billing/checkout", billingH.CreateCheckout)

	// ── Start server ───────────────────────────────────────────────────────
	addr := "0.0.0.0:" + cfg.Port
	log.Info().Str("addr", addr).Str("env", cfg.AppEnv).Msg("servidor iniciado")

	errCh := make(chan error, 1)
	go func() { errCh <- app.Listen(addr) }()

	select {
	case <-ctx.Done():
		log.Info().Msg("shutdown signal received")
		_ = app.ShutdownWithTimeout(10 * time.Second)
	case err := <-errCh:
		if err != nil {
			log.Fatal().Err(err).Msg("server error")
		}
	}
}
