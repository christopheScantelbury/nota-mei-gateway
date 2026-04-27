package main

import (
	"os"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/config"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/document"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/nfse"
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	cfg := config.Load()

	_ = &auth.Client{}
	_ = &document.Builder{}
	_ = &nfse.Adapter{}

	level, _ := zerolog.ParseLevel(cfg.LogLevel)
	zerolog.SetGlobalLevel(level)
	if cfg.AppEnv == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}

	app := fiber.New(fiber.Config{
		AppName: "Nota MEI Gateway",
	})

	app.Get("/v1/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "env": cfg.AppEnv})
	})

	addr := "0.0.0.0:" + cfg.Port
	log.Info().Str("addr", addr).Str("env", cfg.AppEnv).Msg("servidor iniciado")
	log.Fatal().Err(app.Listen(addr)).Send()
}
