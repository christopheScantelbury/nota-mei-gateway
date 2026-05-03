package handler

import (
	"context"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

type meiSeeder interface {
	Seed(ctx context.Context) (*auth.SeedResult, error)
}

// SeedHandler handles POST /v1/sandbox/seed.
// Only registered when APP_ENV != production.
type SeedHandler struct {
	seeder meiSeeder
}

// NewSeedHandler creates a SeedHandler.
func NewSeedHandler(seeder meiSeeder) *SeedHandler {
	return &SeedHandler{seeder: seeder}
}

// Seed creates (or re-confirms) the test MEI and returns its fixed API key.
// The operation is idempotent — safe to call multiple times.
func (h *SeedHandler) Seed(c *fiber.Ctx) error {
	result, err := h.seeder.Seed(c.Context())
	if err != nil {
		log.Ctx(c.Context()).Error().Err(err).Msg("seed MEI failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "erro ao criar MEI de teste",
			"request_id": c.Locals("request_id"),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"mei_id":  result.MeiID,
		"cnpj":    auth.SeedCNPJ,
		"api_key": result.APIKey,
		"plano":   "Trial",
		"message": "MEI de teste pronto. Use o api_key no header Authorization: Bearer <api_key>.",
	})
}
