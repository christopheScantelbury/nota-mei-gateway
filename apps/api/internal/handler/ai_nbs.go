package handler

import (
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/ai"
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

// AINBSHandler expõe o classificador NBS por IA.
type AINBSHandler struct {
	classifier *ai.NBSClassifier
}

func NewAINBSHandler(c *ai.NBSClassifier) *AINBSHandler {
	return &AINBSHandler{classifier: c}
}

type sugerirNBSRequest struct {
	Descricao string `json:"descricao"`
}

// Sugerir handles POST /v1/ai/nbs/sugerir
// Recebe uma descrição livre de serviço e retorna até 3 códigos NBS sugeridos.
// Cacheado em Redis por 30 dias por hash da descrição normalizada.
func (h *AINBSHandler) Sugerir(c *fiber.Ctx) error {
	if h.classifier == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "AI_DISABLED",
			"message": "classificador NBS indisponível neste ambiente",
		})
	}

	var req sugerirNBSRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "VALIDATION_ERROR",
			"message": "corpo da requisição inválido",
		})
	}

	sugestoes, err := h.classifier.Sugerir(c.Context(), req.Descricao)
	if err != nil {
		log.Ctx(c.Context()).Warn().Err(err).Str("descricao", req.Descricao).Msg("nbs: sugerir falhou")
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":   "AI_FAILED",
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"sugestoes": sugestoes,
		"total":     len(sugestoes),
	})
}
