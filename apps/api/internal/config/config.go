// Package config loads and validates application configuration from environment variables.
package config

import (
	"fmt"
	"os"
)

// Config holds all runtime configuration for the API server.
type Config struct {
	AppEnv   string
	Port     string
	LogLevel string

	DatabaseURL        string
	SupabaseServiceKey string

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

	ReceitaAPIURL string
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
		"REDIS_URL",
		"RABBITMQ_URL",
		"AWS_REGION",
		"AWS_KMS_KEY_ARN",
		"STRIPE_SECRET_KEY",
		"STRIPE_WEBHOOK_SECRET",
		"STRIPE_PRICE_STARTER",
		"STRIPE_PRICE_BASIC",
		"STRIPE_PRICE_PRO",
		"STRIPE_PRICE_BUSINESS",
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
		SupabaseServiceKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),

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

		ReceitaAPIURL: os.Getenv("RECEITA_API_URL"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
