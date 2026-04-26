package main

import (
	"os"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/config"
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	cfg := config.Load()

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

	log.Info().Str("port", cfg.Port).Str("env", cfg.AppEnv).Msg("servidor iniciado")
	log.Fatal().Err(app.Listen(":" + cfg.Port)).Send()
}
