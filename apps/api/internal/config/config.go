// Package config loads and validates application configuration from environment variables.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds all runtime configuration for the API server.
type Config struct {
	AppEnv   string
	Port     string
	LogLevel string

	DatabaseURL        string
	SupabaseURL        string
	SupabaseServiceKey string

	// PGMaxConns / PGMinConns tune the pgx connection pool.
	// Defaults (25 / 5) are set in pkg/supabase when these are zero.
	// Override via PG_MAX_CONNS / PG_MIN_CONNS for production tuning without redeploy.
	PGMaxConns int32
	PGMinConns int32

	// XMLSecWorkerPoolSize limits concurrent XMLDSig signing operations (ARCH-02).
	// Default (0) → document.DefaultWorkerPoolSize (50).
	// Override via XMLSEC_WORKER_POOL_SIZE without redeploy.
	XMLSecWorkerPoolSize int

	RedisURL    string
	RabbitMQURL string

	AWSRegion    string
	AWSKMSKeyARN string

	StripeSecretKey     string
	StripeWebhookSecret string
	StripePriceStarter  string
	StripePriceBasic    string
	StripePricePro      string
	StripePriceBusiness string

	WebhookHMACSecret string

	// AI assistive features (NBS classifier, etc) — optional.
	AnthropicAPIKey string

	ReceitaAPIURL string
	// SefinAPIURL is the base URL for the SEFIN Nacional endpoint used by ME/EPP companies.
	// When empty the adapter falls back to ReceitaAPIURL (degraded mode — logs a warning on first call).
	// Override via SEFIN_API_URL env var; homologação is selected automatically when APP_ENV != production.
	SefinAPIURL string

	// S3BucketNotas is the AWS S3 bucket name for fiscal document storage (STOR-01).
	// When empty the API falls back to NoopStore (in-memory, dev/test only).
	S3BucketNotas string

	// APIBaseURL is the public base URL of the API, used in webhook payloads and
	// presigned URL responses.  Override via API_BASE_URL env var; defaults to
	// https://api.emitirnotafacil.com.br in production.
	APIBaseURL string

	ResendAPIKey string
	EmailFrom    string

	// AdminAllowedIPs is the list of IP addresses permitted to access
	// /v1/admin/* endpoints (e.g. relatorio-me).
	// Set via ADMIN_ALLOWED_IPS as a comma-separated list.
	// If empty, the IP whitelist middleware fails-open (all IPs allowed) —
	// set this explicitly in production.
	AdminAllowedIPs []string
}

// Load lê variáveis de ambiente, valida as obrigatórias e devolve a configuração.
// Variáveis essenciais causam panic se ausentes.
// Variáveis de serviços externos (Redis, RabbitMQ, AWS, Stripe) emitem warning —
// a API sobe em modo degradado e as features dependentes retornam erro na primeira chamada.
func Load() *Config {
	// Essential: sem estas a API não consegue nem autenticar requests.
	essential := []string{
		"DATABASE_URL",
		"SUPABASE_SERVICE_ROLE_KEY",
		"WEBHOOK_HMAC_SECRET",
		"RECEITA_API_URL",
	}
	var missing []string
	for _, k := range essential {
		if os.Getenv(k) == "" {
			missing = append(missing, k)
		}
	}
	if len(missing) > 0 {
		panic(fmt.Sprintf("variáveis de ambiente obrigatórias ausentes: %v", missing))
	}

	// Soft-required: serviços externos opcionais. Log de aviso se ausentes.
	softRequired := []string{
		"SUPABASE_URL",
		"REDIS_URL",
		"RABBITMQ_URL",
		"AWS_REGION",
		"AWS_KMS_KEY_ARN",
		"S3_BUCKET_NOTAS",
		"STRIPE_SECRET_KEY",
		"STRIPE_WEBHOOK_SECRET",
		"STRIPE_PRICE_STARTER",
		"STRIPE_PRICE_BASIC",
		"STRIPE_PRICE_PRO",
		"STRIPE_PRICE_BUSINESS",
		"SEFIN_API_URL",
	}
	var softMissing []string
	for _, k := range softRequired {
		if os.Getenv(k) == "" {
			softMissing = append(softMissing, k)
		}
	}
	if len(softMissing) > 0 {
		fmt.Printf("WARN: variáveis de serviços externos ausentes (modo degradado): %v\n", softMissing)
	}

	return &Config{
		AppEnv:   getEnv("APP_ENV", "development"),
		Port:     getEnv("PORT", "8080"),
		LogLevel: getEnv("LOG_LEVEL", "info"),

		DatabaseURL:        os.Getenv("DATABASE_URL"),
		SupabaseURL:        os.Getenv("SUPABASE_URL"),
		SupabaseServiceKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),

		PGMaxConns: parseInt32Env("PG_MAX_CONNS", 0),
		PGMinConns: parseInt32Env("PG_MIN_CONNS", 0),

		XMLSecWorkerPoolSize: parseIntEnv("XMLSEC_WORKER_POOL_SIZE", 0),

		RedisURL:    os.Getenv("REDIS_URL"),
		RabbitMQURL: os.Getenv("RABBITMQ_URL"),

		AWSRegion:    os.Getenv("AWS_REGION"),
		AWSKMSKeyARN: os.Getenv("AWS_KMS_KEY_ARN"),

		StripeSecretKey:     os.Getenv("STRIPE_SECRET_KEY"),
		StripeWebhookSecret: os.Getenv("STRIPE_WEBHOOK_SECRET"),
		StripePriceStarter:  os.Getenv("STRIPE_PRICE_STARTER"),
		StripePriceBasic:    os.Getenv("STRIPE_PRICE_BASIC"),
		StripePricePro:      os.Getenv("STRIPE_PRICE_PRO"),
		StripePriceBusiness: os.Getenv("STRIPE_PRICE_BUSINESS"),

		WebhookHMACSecret: os.Getenv("WEBHOOK_HMAC_SECRET"),

		AnthropicAPIKey: os.Getenv("ANTHROPIC_API_KEY"),

		ReceitaAPIURL: os.Getenv("RECEITA_API_URL"),
		SefinAPIURL:   sefinURL(),

		S3BucketNotas: os.Getenv("S3_BUCKET_NOTAS"),

		APIBaseURL: getEnv("API_BASE_URL", "https://api.emitirnotafacil.com.br"),

		ResendAPIKey: os.Getenv("RESEND_API_KEY"),
		EmailFrom:    getEnv("EMAIL_FROM", "Nota MEI Gateway <noreply@emitirnotafacil.com.br>"),

		AdminAllowedIPs: parseCSVEnv("ADMIN_ALLOWED_IPS"),
	}
}

// sefinURL returns the SEFIN Nacional base URL.
// When SEFIN_API_URL is set it is used as-is (production or custom).
// When SEFIN_API_URL_HOM is set and APP_ENV is not "production", the homologação URL is used.
// Falls back to the production SEFIN Nacional URL so the API starts without panicking.
func sefinURL() string {
	if v := os.Getenv("SEFIN_API_URL"); v != "" {
		return v
	}
	if os.Getenv("APP_ENV") != "production" {
		if v := os.Getenv("SEFIN_API_URL_HOM"); v != "" {
			return v
		}
	}
	return ""
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseInt32Env(key string, fallback int32) int32 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 32); err == nil {
			return int32(n)
		}
	}
	return fallback
}

func parseIntEnv(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

// parseCSVEnv parses a comma-separated environment variable into a string slice.
// Returns nil if the variable is empty or unset.
func parseCSVEnv(key string) []string {
	v := os.Getenv(key)
	if v == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}
