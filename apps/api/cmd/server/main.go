package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/audit"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/billing"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/config"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/document"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/handler"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/middleware"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/nfse"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/recorrencia"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/sandbox"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/template"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/webhook"
	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/cert"
	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/email"
	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/storage"
	stripeClient "github.com/christopheScantelbury/nota-mei-gateway/api/pkg/stripe"
	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/supabase"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
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
	db, err := supabase.New(ctx, cfg.DatabaseURL, supabase.PoolConfig{
		MaxConns: cfg.PGMaxConns, // 0 → package default (25)
		MinConns: cfg.PGMinConns, // 0 → package default (5)
	})
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer db.Close()

	// cert.New only loads AWS SDK config; actual credentials are verified on first call.
	// CachingProvider wraps it with a 4 h in-memory TTL cache (ARCH-01) so SM is
	// called at most once per cert ARN per instance every 4 hours, protecting against
	// throttling at ME/EPP scale (SM limit: ~5 000 req/s, sa-east-1).
	rawCertProv, err := cert.New(ctx, cfg.AWSRegion, cfg.AWSKMSKeyARN)
	if err != nil {
		log.Warn().Err(err).Msg("cert provider unavailable — certificate features disabled")
	}

	var certProv cert.CertProvider
	if rawCertProv != nil {
		certProv = cert.NewCachingProvider(rawCertProv, cert.NewCache(0))
		log.Info().Msg("cert cache inicializado (TTL 4 h)")
	}

	// ── Object storage (STOR-01) ───────────────────────────────────────────
	// S3Store is used in staging/production; NoopStore is used in development
	// or when S3_BUCKET_NOTAS is not configured.
	var objectStore storage.ObjectStore
	if cfg.S3BucketNotas != "" {
		s3Store, err := storage.NewS3Store(ctx, cfg.AWSRegion, cfg.S3BucketNotas)
		if err != nil {
			log.Warn().Err(err).Str("bucket", cfg.S3BucketNotas).
				Msg("S3 storage unavailable — falling back to NoopStore (XMLs stored in DB)")
			objectStore = storage.NewNoopStore()
		} else {
			objectStore = s3Store
			log.Info().Str("bucket", cfg.S3BucketNotas).Msg("S3 object storage configurado")
		}
	} else {
		log.Warn().Msg("S3_BUCKET_NOTAS não configurado — XMLs/PDFs armazenados em memória (NoopStore)")
		objectStore = storage.NewNoopStore()
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

	// Wire billing repository into the guard so Check (ME/EPP) can query
	// trial status and plano limits without a separate DB round-trip per request.
	if billingGrd != nil {
		billingGrd = billingGrd.WithRepository(billingRepo)
	}

	// ── Adapters & builders ────────────────────────────────────────────────
	adapter := nfse.NewAdapterWithSefin(cfg.ReceitaAPIURL, cfg.SefinAPIURL)
	builder := document.NewBuilder()
	dpsBuilder := document.NewDPSBuilder()

	// XMLDSigSigner is used in staging/production where a real A1 certificate
	// is loaded from AWS Secrets Manager.  NoopSigner is kept for local
	// development because no real certificate is available without AUTH-04.
	// PooledSigner (ARCH-02) caps concurrent Sign() calls to prevent runaway
	// goroutine growth at month-end peak load (e.g. 1 000 MEIs emitting at once).
	var rawSigner document.Signer = document.NoopSigner{}
	if cfg.AppEnv != "development" {
		rawSigner = document.XMLDSigSigner{}
	}
	signer := document.NewPooledSigner(rawSigner, cfg.XMLSecWorkerPoolSize)
	log.Info().Int("pool_size", signer.Capacity()).Msg("XMLDSig worker pool inicializado")

	// ── NBS validator (Redis cache + DB fallback) ──────────────────────────
	nbsValidator, err := document.NewNBSValidator(cfg.RedisURL, db.Pool())
	if err != nil {
		log.Warn().Err(err).Msg("NBS validator unavailable — NBS validation will use DB-only fallback")
		nbsValidator = nil
	} else if err := nbsValidator.Warm(ctx); err != nil {
		log.Warn().Err(err).Msg("NBS warm failed — validator will fall back to DB")
	}

	// ── ISS rate lookup (DB + Redis, lazy — no memory pre-load) ──────────
	// A dedicated Redis client is created for the ISS lookup.  The billing
	// guard uses its own internal client; sharing would require refactoring.
	var issRedis *redis.Client
	if cfg.RedisURL != "" {
		if opt, parseErr := redis.ParseURL(cfg.RedisURL); parseErr != nil {
			log.Warn().Err(parseErr).Msg("ISS Redis: invalid URL — cache disabled")
		} else {
			issRedis = redis.NewClient(opt)
		}
	}
	issLookup, err := document.NewISSLookup(ctx, db.Pool(), issRedis)
	if err != nil {
		log.Warn().Err(err).Msg("ISS lookup unavailable — ISS rates will not be validated")
		issLookup = nil
	}

	// ── Handlers ───────────────────────────────────────────────────────────
	// apiBase is used in webhook payloads and presigned URL redirects.
	// In development it points to localhost; in all other envs it uses the
	// API_BASE_URL env var (default: https://api.emitirnotafacil.com.br).
	apiBase := cfg.APIBaseURL
	if cfg.AppEnv == "development" {
		apiBase = "http://localhost:" + cfg.Port
	}

	cnpjValidator, err := auth.NewCNPJValidator(cfg.RedisURL)
	if err != nil {
		log.Warn().Err(err).Msg("CNPJ validator unavailable — CNPJ dedup cache disabled")
	}

	// ── Email service ──────────────────────────────────────────────────────
	emailClient := email.New(cfg.ResendAPIKey, cfg.EmailFrom)
	emailSvc := email.NewService(emailClient, log.Logger)

	registerH := handler.NewRegisterHandler(authRepo).WithCNPJValidator(cnpjValidator).WithEmailService(emailSvc)
	registerMEH := handler.NewRegisterMEHandler(authRepo).WithCNPJValidator(cnpjValidator).WithEmailService(emailSvc)
	certH := handler.NewCertificateHandler(certProv, authRepo, db)
	seedH := handler.NewSeedHandler(auth.NewSeeder(db))

	nfseH := handler.NewNFSeHandler(
		notaRepo, adapter, builder, dpsBuilder, signer, certProv,
		billingRepo, billingGrd, publisher,
		apiBase, cfg.WebhookHMACSecret,
	).WithNBSValidator(nbsValidator).WithISSLookup(issLookup).WithStripeClient(sc).WithStorage(objectStore)
	if cfg.AppEnv == "development" {
		nfseH = nfseH.WithDevMode()
	}
	billingH := handler.NewBillingHandler(
		sc,
		cfg.StripePriceStarter, cfg.StripePriceBasic,
		cfg.StripePricePro, cfg.StripePriceBusiness,
		apiBase,
	)
	stripeWH := handler.NewStripeWebhookHandler(cfg.StripeWebhookSecret, db).
		WithBillingGuard(billingGrd).
		WithEmailService(emailSvc)

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

	app.Use(cors.New(cors.Config{
		// Origins exatos (Vercel prod + custom domains). Quando AllowCredentials
		// é true, AllowOrigins NÃO pode ser "*" — precisa listar cada origem.
		AllowOrigins:     "https://emitirnotafacil.com.br,https://www.emitirnotafacil.com.br,https://nota-mei-gateway-web.vercel.app",
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-Request-ID,X-Idempotency-Key",
		ExposeHeaders:    "X-Request-ID,X-RateLimit-Remaining,X-RateLimit-Limit",
		AllowCredentials: true,
		MaxAge:           300,
	}))
	app.Use(middleware.PanicRecovery())
	app.Use(middleware.RequestLogger())
	app.Use(middleware.PrometheusMetrics())

	// ── Public endpoints ───────────────────────────────────────────────────
	// Health check always returns 200 so Railway's liveness probe passes.
	// DB reachability is reported in the response body (not as HTTP status)
	// so a temporary DB blip doesn't take the service offline unnecessarily.
	app.Get("/v1/health", func(c *fiber.Ctx) error {
		// DB
		dbStatus := "ok"
		if err := db.Pool().Ping(c.Context()); err != nil {
			dbStatus = "unreachable"
		}

		// Redis (via billing guard — shares the same connection pool)
		redisStatus := "ok"
		if billingGrd == nil {
			redisStatus = "unreachable"
		} else if err := billingGrd.Ping(c.Context()); err != nil {
			redisStatus = "unreachable"
		}

		// RabbitMQ (via webhook publisher)
		rabbitmqStatus := "ok"
		if publisher == nil {
			rabbitmqStatus = "unreachable"
		} else if err := publisher.Ping(); err != nil {
			rabbitmqStatus = "unreachable"
		}

		return c.JSON(fiber.Map{
			"status": "ok",
			"env":    cfg.AppEnv,
			"services": fiber.Map{
				"db":       fiber.Map{"status": dbStatus},
				"redis":    fiber.Map{"status": redisStatus},
				"receita":  fiber.Map{"status": "ok"},
				"stripe":   fiber.Map{"status": "ok"},
				"rabbitmq": fiber.Map{"status": rabbitmqStatus},
			},
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

	// ME/EPP registration — public, no Bearer token required.
	// Inserts into empresas table with tipo='ME'|'EPP' and regime_tributario.
	app.Post("/v1/auth/register/me", registerMEH.RegisterME)

	// Municipalities list — public, no auth required (ME-20 / ME-22).
	// Uses the new DB-backed handler that queries municipios_nfse + iss_aliquotas.
	{
		lister := handler.NewDBMunicipioLister(db.Pool(), issRedis)
		municipioH := handler.NewMunicipioHandler(lister)
		app.Get("/v1/municipios", municipioH.ListMunicipios)
	}

	// Admin: ME/EPP relatorio CSV — IP-whitelist protected (ME-52).
	// ADMIN_ALLOWED_IPS env var: comma-separated list of allowed IPs.
	// In development mode, all IPs are allowed regardless of the list.
	adminRelatorioH := handler.NewAdminRelatorioMEHandler(db.Pool())
	adminIPs := cfg.AdminAllowedIPs
	if cfg.AppEnv == "development" {
		adminIPs = nil // fail-open in dev
	}
	adminGroup := app.Group("/v1/admin", middleware.IPWhitelist(adminIPs))
	adminGroup.Get("/relatorio-me", adminRelatorioH.RelatorioME)

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
	sbxGroup.Delete("/nfse/:id", func(c *fiber.Ctx) error {
		if !sandbox.IsSandboxKey(c.Get("Authorization")) {
			return c.Next()
		}
		return sbx.CancelarNota(c)
	})
	// Sandbox webhook receiver — public, no auth needed.
	app.Post("/v1/sandbox/webhook", sbx.ReceiveWebhook)
	app.Get("/v1/sandbox/webhook", sbx.ListWebhooks)

	// Seed endpoint — only available outside production.
	if cfg.AppEnv != "production" {
		app.Post("/v1/sandbox/seed", seedH.Seed)
	}

	// ── JWT-authenticated endpoints (Supabase session — humans/dashboard) ──
	// IMPORTANTE: Estes precisam ser registrados ANTES do v1 group com authMw,
	// porque app.Group("/v1", authMw) em Fiber intercepta TODAS as rotas /v1/*,
	// incluindo as registradas depois com middlewares diferentes. Sem essa
	// ordem, /v1/auth/api-keys e /v1/auth/migrar caem no auth.Middleware
	// (API key) em vez do jwtMw.
	apiKeyH := auth.NewAPIKeyHandler(authRepo)
	jwtMw := auth.JWTMiddleware(cfg.SupabaseURL, cfg.SupabaseServiceKey)
	apiKeys := app.Group("/v1/auth/api-keys", jwtMw)
	apiKeys.Get("/", apiKeyH.ListKeys)
	apiKeys.Post("/", apiKeyH.CreateKey)
	apiKeys.Delete("/:id", apiKeyH.RevokeKey)

	// MEI → ME migration — authenticated via Supabase JWT (dashboard action)
	auditor := audit.New(db.Pool())
	migrarH := handler.NewMigrarHandler(db.Pool(), auditor)
	app.Post("/v1/auth/migrar", jwtMw, migrarH.MigrarMEI)

	// ── API-key authenticated endpoints (machine-to-machine) ───────────────
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
	v1.Post("/nfse/:id/substituir", nfseH.SubstituirNota) // ME-32: 9-day substitution window (ME/EPP only)
	v1.Get("/nfse/:id/xml", nfseH.DownloadXML)
	v1.Get("/nfse/:id/pdf", nfseH.DownloadPDF)

	// Auth (authenticated — certificate renewal)
	v1.Post("/auth/certificate", certH.Renew)

	// Billing
	v1.Get("/billing/usage", billingH.GetUsage)
	v1.Get("/billing/portal", billingH.GetPortal)
	v1.Post("/billing/checkout", billingH.CreateCheckout)

	// Nota templates (Pro+ feature)
	templateRepo := template.NewRepository(db.Pool())
	templateH := handler.NewTemplateHandler(templateRepo)
	v1.Get("/templates", templateH.ListTemplates)
	v1.Post("/templates", templateH.CreateTemplate)
	v1.Get("/templates/:id", templateH.GetTemplate)
	v1.Put("/templates/:id", templateH.UpdateTemplate)
	v1.Delete("/templates/:id", templateH.DeleteTemplate)

	// Nota recorrências (BE-03)
	recRepo := recorrencia.NewRepository(db.Pool())
	sched := recorrencia.NewScheduler(recRepo, &recorrencia.NoopEmissor{}, time.Hour)
	go sched.Run(ctx)
	recH := handler.NewRecorrenciaHandler(recRepo)
	v1.Get("/recorrencias", recH.ListRecorrencias)
	v1.Post("/recorrencias", recH.CreateRecorrencia)
	v1.Get("/recorrencias/:id", recH.GetRecorrencia)
	v1.Put("/recorrencias/:id", recH.UpdateRecorrencia)
	v1.Delete("/recorrencias/:id", recH.DeleteRecorrencia)

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
