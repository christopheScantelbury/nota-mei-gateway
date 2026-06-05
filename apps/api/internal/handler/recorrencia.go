package handler

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/recorrencia"
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

// recorrenciaRepo is the interface consumed by RecorrenciaHandler.
type recorrenciaRepo interface {
	List(ctx context.Context, meiID string) ([]recorrencia.Recorrencia, error)
	Get(ctx context.Context, id, meiID string) (*recorrencia.Recorrencia, error)
	Create(ctx context.Context, meiID string, req recorrencia.CreateRequest) (*recorrencia.Recorrencia, error)
	Update(ctx context.Context, id, meiID string, req recorrencia.UpdateRequest) (*recorrencia.Recorrencia, error)
	Delete(ctx context.Context, id, meiID string) error
}

// RecorrenciaHandler handles CRUD operations for nota recurrence rules.
type RecorrenciaHandler struct {
	repo recorrenciaRepo
}

// NewRecorrenciaHandler creates a RecorrenciaHandler.
func NewRecorrenciaHandler(repo recorrenciaRepo) *RecorrenciaHandler {
	return &RecorrenciaHandler{repo: repo}
}

// ─── request / response types ────────────────────────────────────────────────

type recorrenciaCreateRequest struct {
	Nome           string          `json:"nome"`
	DiaVencimento  int             `json:"dia_vencimento"`
	Servico        json.RawMessage `json:"servico"`
	Tomador        json.RawMessage `json:"tomador"`
	WebhookURL     string          `json:"webhook_url,omitempty"`
	ProximaEmissao string          `json:"proxima_emissao"`
}

type recorrenciaUpdateRequest struct {
	Nome           *string         `json:"nome,omitempty"`
	Ativo          *bool           `json:"ativo,omitempty"`
	DiaVencimento  *int            `json:"dia_vencimento,omitempty"`
	Servico        json.RawMessage `json:"servico,omitempty"`
	Tomador        json.RawMessage `json:"tomador,omitempty"`
	WebhookURL     *string         `json:"webhook_url,omitempty"`
	ProximaEmissao *string         `json:"proxima_emissao,omitempty"`
}

// ─── handlers ────────────────────────────────────────────────────────────────

// ListRecorrencias handles GET /v1/recorrencias → 200 {"data":[],"total":n}.
func (h *RecorrenciaHandler) ListRecorrencias(c *fiber.Ctx) error {
	meiID := ownerIDOrUnauthorized(c)
	if meiID == "" {
		return nil
	}

	items, err := h.repo.List(c.Context(), meiID)
	if err != nil {
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", meiID).Msg("list recorrencias failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "erro ao listar recorrências",
			"request_id": c.Locals("request_id"),
		})
	}

	if items == nil {
		items = []recorrencia.Recorrencia{}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":  items,
		"total": len(items),
	})
}

// CreateRecorrencia handles POST /v1/recorrencias → 201 or 422.
func (h *RecorrenciaHandler) CreateRecorrencia(c *fiber.Ctx) error {
	meiID := ownerIDOrUnauthorized(c)
	if meiID == "" {
		return nil
	}

	var req recorrenciaCreateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":      "VALIDATION_ERROR",
			"message":    "corpo da requisição inválido",
			"request_id": c.Locals("request_id"),
		})
	}

	// Bug R3-P1: client não precisa enviar proxima_emissao — derivamos da
	// próxima ocorrência de `dia_vencimento` a partir de hoje. Se dia já
	// passou no mês corrente, vai pro mês seguinte.
	if req.ProximaEmissao == "" && req.DiaVencimento >= 1 && req.DiaVencimento <= 28 {
		req.ProximaEmissao = nextOccurrenceOfDay(time.Now().UTC(), req.DiaVencimento)
	}

	if errs := validateRecorrenciaCreate(req); len(errs) > 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":      "VALIDATION_ERROR",
			"message":    "campos inválidos",
			"fields":     errs,
			"request_id": c.Locals("request_id"),
		})
	}

	rec, err := h.repo.Create(c.Context(), meiID, recorrencia.CreateRequest{
		Nome:           strings.TrimSpace(req.Nome),
		DiaVencimento:  req.DiaVencimento,
		Servico:        req.Servico,
		Tomador:        req.Tomador,
		WebhookURL:     req.WebhookURL,
		ProximaEmissao: req.ProximaEmissao,
	})
	if err != nil {
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", meiID).Msg("create recorrencia failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "erro ao criar recorrência",
			"request_id": c.Locals("request_id"),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(rec)
}

// GetRecorrencia handles GET /v1/recorrencias/:id → 200 or 404.
func (h *RecorrenciaHandler) GetRecorrencia(c *fiber.Ctx) error {
	meiID := ownerIDOrUnauthorized(c)
	if meiID == "" {
		return nil
	}
	id := c.Params("id")

	rec, err := h.repo.Get(c.Context(), id, meiID)
	if err != nil {
		if errors.Is(err, recorrencia.ErrNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error":      "NOT_FOUND",
				"message":    "recorrência não encontrada",
				"request_id": c.Locals("request_id"),
			})
		}
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", meiID).Str("id", id).Msg("get recorrencia failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "erro ao buscar recorrência",
			"request_id": c.Locals("request_id"),
		})
	}

	return c.Status(fiber.StatusOK).JSON(rec)
}

// UpdateRecorrencia handles PUT /v1/recorrencias/:id → 200 or 404.
func (h *RecorrenciaHandler) UpdateRecorrencia(c *fiber.Ctx) error {
	meiID := ownerIDOrUnauthorized(c)
	if meiID == "" {
		return nil
	}
	id := c.Params("id")

	var req recorrenciaUpdateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":      "VALIDATION_ERROR",
			"message":    "corpo da requisição inválido",
			"request_id": c.Locals("request_id"),
		})
	}

	rec, err := h.repo.Update(c.Context(), id, meiID, recorrencia.UpdateRequest{
		Nome:           req.Nome,
		Ativo:          req.Ativo,
		DiaVencimento:  req.DiaVencimento,
		Servico:        req.Servico,
		Tomador:        req.Tomador,
		WebhookURL:     req.WebhookURL,
		ProximaEmissao: req.ProximaEmissao,
	})
	if err != nil {
		if errors.Is(err, recorrencia.ErrNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error":      "NOT_FOUND",
				"message":    "recorrência não encontrada",
				"request_id": c.Locals("request_id"),
			})
		}
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", meiID).Str("id", id).Msg("update recorrencia failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "erro ao atualizar recorrência",
			"request_id": c.Locals("request_id"),
		})
	}

	return c.Status(fiber.StatusOK).JSON(rec)
}

// DeleteRecorrencia handles DELETE /v1/recorrencias/:id → 204 or 404.
func (h *RecorrenciaHandler) DeleteRecorrencia(c *fiber.Ctx) error {
	meiID := ownerIDOrUnauthorized(c)
	if meiID == "" {
		return nil
	}
	id := c.Params("id")

	err := h.repo.Delete(c.Context(), id, meiID)
	if err != nil {
		if errors.Is(err, recorrencia.ErrNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error":      "NOT_FOUND",
				"message":    "recorrência não encontrada",
				"request_id": c.Locals("request_id"),
			})
		}
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", meiID).Str("id", id).Msg("delete recorrencia failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "erro ao deletar recorrência",
			"request_id": c.Locals("request_id"),
		})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// ─── validation helpers ───────────────────────────────────────────────────────

// validateRecorrenciaCreate validates all required fields for a create request.
func validateRecorrenciaCreate(req recorrenciaCreateRequest) []fieldError {
	var errs []fieldError

	nome := strings.TrimSpace(req.Nome)
	if nome == "" {
		errs = append(errs, fieldError{"nome", "obrigatório"})
	} else if len(nome) > 100 {
		errs = append(errs, fieldError{"nome", "máximo 100 caracteres"})
	}

	if req.DiaVencimento < 1 || req.DiaVencimento > 28 {
		errs = append(errs, fieldError{"dia_vencimento", "deve ser entre 1 e 28"})
	}

	if len(req.Servico) == 0 {
		errs = append(errs, fieldError{"servico", "obrigatório"})
	} else if !json.Valid(req.Servico) || req.Servico[0] != '{' {
		errs = append(errs, fieldError{"servico", "deve ser um objeto JSON válido"})
	}

	if len(req.Tomador) == 0 {
		errs = append(errs, fieldError{"tomador", "obrigatório"})
	} else if !json.Valid(req.Tomador) || req.Tomador[0] != '{' {
		errs = append(errs, fieldError{"tomador", "deve ser um objeto JSON válido"})
	}

	if req.ProximaEmissao == "" {
		errs = append(errs, fieldError{"proxima_emissao", "obrigatório"})
	} else {
		if _, err := time.Parse("2006-01-02", req.ProximaEmissao); err != nil {
			errs = append(errs, fieldError{"proxima_emissao", "deve ser uma data válida no formato YYYY-MM-DD"})
		}
	}

	return errs
}

// nextOccurrenceOfDay devolve YYYY-MM-DD da próxima vez que o dia do mês `day`
// vai ocorrer a partir de `from` (inclusive). Se day já passou no mês corrente,
// vai pro mês seguinte. Usa UTC pra evitar drift entre TZ do cliente e DB.
//
// Exemplos (assumindo from = 2026-06-04):
//
//	day=15 → "2026-06-15" (no futuro mesmo mês)
//	day=4  → "2026-06-04" (hoje)
//	day=1  → "2026-07-01" (já passou, vai pro mês seguinte)
func nextOccurrenceOfDay(from time.Time, day int) string {
	year, month, today := from.Date()
	if day >= today {
		return time.Date(year, month, day, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	}
	next := time.Date(year, month+1, day, 0, 0, 0, 0, time.UTC)
	return next.Format("2006-01-02")
}
