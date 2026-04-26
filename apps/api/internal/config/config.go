package config

import (
	"fmt"
	"os"
)

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

	ReceitaAPIURL string
}

func Load() *Config {
	return &Config{
		AppEnv:   getEnv("APP_ENV", "development"),
		Port:     getEnv("PORT", "8080"),
		LogLevel: getEnv("LOG_LEVEL", "info"),

		DatabaseURL:        mustEnv("DATABASE_URL"),
		SupabaseServiceKey: mustEnv("SUPABASE_SERVICE_ROLE_KEY"),

		RedisURL:    mustEnv("REDIS_URL"),
		RabbitMQURL: mustEnv("RABBITMQ_URL"),

		AWSRegion:    mustEnv("AWS_REGION"),
		AWSKMSKeyARN: mustEnv("AWS_KMS_KEY_ARN"),

		StripeSecretKey:     mustEnv("STRIPE_SECRET_KEY"),
		StripeWebhookSecret: mustEnv("STRIPE_WEBHOOK_SECRET"),
		StripePriceStarter:  mustEnv("STRIPE_PRICE_STARTER"),
		StripePriceBasic:    mustEnv("STRIPE_PRICE_BASIC"),
		StripePricePro:      mustEnv("STRIPE_PRICE_PRO"),
		StripePriceBusiness: mustEnv("STRIPE_PRICE_BUSINESS"),

		ReceitaAPIURL: mustEnv("RECEITA_API_URL"),
	}
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("variável de ambiente obrigatória não definida: %s", key))
	}
	return v
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
