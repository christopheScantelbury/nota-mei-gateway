package handler

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/template"
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

// templateRepo is the interface consumed by TemplateHandler.
type templateRepo interface {
	List(ctx context.Context, meiID string) ([]template.Template, error)
	Get(ctx context.Context, id, meiID string) (*template.Template, error)
	Create(ctx context.Context, meiID string, p template.CreateParams) (*template.Template, error)
	Update(ctx context.Context, id, meiID string, p template.UpdateParams) (*template.Template, error)
	Delete(ctx context.Context, id, meiID string) error
}

// TemplateHandler handles CRUD operations for nota templates.
type TemplateHandler struct {
	repo templateRepo
}

// NewTemplateHandler creates a TemplateHandler.
func NewTemplateHandler(repo templateRepo) *TemplateHandler {
	return &TemplateHandler{repo: repo}
}

// ─── request / response types ────────────────────────────────────────────────

type templateCreateRequest struct {
	Nome       string          `json:"nome"`
	Descricao  *string         `json:"descricao"`
	Servico    json.RawMessage `json:"servico"`
	Tomador    json.RawMessage `json:"tomador"`
	WebhookURL *string         `json:"webhook_url"`
}

type templateUpdateRequest struct {
	Nome       *string         `json:"nome"`
	Descricao  *string         `json:"descricao"`
	Servico    json.RawMessage `json:"servico"`
	Tomador    json.RawMessage `json:"tomador"`
	WebhookURL *string         `json:"webhook_url"`
}

// ─── handlers ────────────────────────────────────────────────────────────────

// ListTemplates handles GET /v1/templates.
func (h *TemplateHandler) ListTemplates(c *fiber.Ctx) error {
	meiID := c.Locals("mei_id").(string)

	templates, err := h.repo.List(c.Context(), meiID)
	if err != nil {
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", meiID).Msg("list templates failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "erro ao listar templates",
			"request_id": c.Locals("request_id"),
		})
	}

	// Return an empty array rather than null.
	if templates == nil {
		templates = []template.Template{}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":  templates,
		"total": len(templates),
	})
}

// CreateTemplate handles POST /v1/templates.
func (h *TemplateHandler) CreateTemplate(c *fiber.Ctx) error {
	meiID := c.Locals("mei_id").(string)

	var req templateCreateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":      "VALIDATION_ERROR",
			"message":    "corpo da requisição inválido",
			"request_id": c.Locals("request_id"),
		})
	}

	if errs := validateTemplateFields(req.Nome, req.Servico); len(errs) > 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":      "VALIDATION_ERROR",
			"message":    "campos inválidos",
			"fields":     errs,
			"request_id": c.Locals("request_id"),
		})
	}

	t, err := h.repo.Create(c.Context(), meiID, template.CreateParams{
		Nome:       strings.TrimSpace(req.Nome),
		Descricao:  req.Descricao,
		Servico:    req.Servico,
		Tomador:    req.Tomador,
		WebhookURL: req.WebhookURL,
	})
	if err != nil {
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", meiID).Msg("create template failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "erro ao criar template",
			"request_id": c.Locals("request_id"),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(t)
}

// GetTemplate handles GET /v1/templates/:id.
func (h *TemplateHandler) GetTemplate(c *fiber.Ctx) error {
	meiID := c.Locals("mei_id").(string)
	id := c.Params("id")

	t, err := h.repo.Get(c.Context(), id, meiID)
	if err != nil {
		if errors.Is(err, template.ErrNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error":      "NOT_FOUND",
				"message":    "template não encontrado",
				"request_id": c.Locals("request_id"),
			})
		}
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", meiID).Str("template_id", id).Msg("get template failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "erro ao buscar template",
			"request_id": c.Locals("request_id"),
		})
	}

	return c.Status(fiber.StatusOK).JSON(t)
}

// UpdateTemplate handles PUT /v1/templates/:id.
func (h *TemplateHandler) UpdateTemplate(c *fiber.Ctx) error {
	meiID := c.Locals("mei_id").(string)
	id := c.Params("id")

	var req templateUpdateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":      "VALIDATION_ERROR",
			"message":    "corpo da requisição inválido",
			"request_id": c.Locals("request_id"),
		})
	}

	// Validate only the fields that were provided.
	nome := ""
	if req.Nome != nil {
		nome = *req.Nome
	}
	if errs := validateTemplateFields(nome, req.Servico); len(errs) > 0 {
		// Filter: only report errors for fields explicitly set in the request.
		var filtered []fieldError
		for _, fe := range errs {
			if fe.Field == "nome" && req.Nome == nil {
				continue
			}
			filtered = append(filtered, fe)
		}
		if len(filtered) > 0 {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"error":      "VALIDATION_ERROR",
				"message":    "campos inválidos",
				"fields":     filtered,
				"request_id": c.Locals("request_id"),
			})
		}
	}

	var nomePtr *string
	if req.Nome != nil {
		trimmed := strings.TrimSpace(*req.Nome)
		nomePtr = &trimmed
	}

	t, err := h.repo.Update(c.Context(), id, meiID, template.UpdateParams{
		Nome:       nomePtr,
		Descricao:  req.Descricao,
		Servico:    req.Servico,
		Tomador:    req.Tomador,
		WebhookURL: req.WebhookURL,
	})
	if err != nil {
		if errors.Is(err, template.ErrNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error":      "NOT_FOUND",
				"message":    "template não encontrado",
				"request_id": c.Locals("request_id"),
			})
		}
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", meiID).Str("template_id", id).Msg("update template failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "erro ao atualizar template",
			"request_id": c.Locals("request_id"),
		})
	}

	return c.Status(fiber.StatusOK).JSON(t)
}

// DeleteTemplate handles DELETE /v1/templates/:id.
func (h *TemplateHandler) DeleteTemplate(c *fiber.Ctx) error {
	meiID := c.Locals("mei_id").(string)
	id := c.Params("id")

	err := h.repo.Delete(c.Context(), id, meiID)
	if err != nil {
		if errors.Is(err, template.ErrNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error":      "NOT_FOUND",
				"message":    "template não encontrado",
				"request_id": c.Locals("request_id"),
			})
		}
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", meiID).Str("template_id", id).Msg("delete template failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "erro ao deletar template",
			"request_id": c.Locals("request_id"),
		})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// ─── validation helpers ───────────────────────────────────────────────────────

type fieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// validateTemplateFields checks nome and servico constraints.
// nome is only validated when non-empty (to allow partial updates).
// servico is only validated when provided.
func validateTemplateFields(nome string, servico json.RawMessage) []fieldError {
	var errs []fieldError

	trimmed := strings.TrimSpace(nome)
	if trimmed == "" {
		errs = append(errs, fieldError{"nome", "obrigatório"})
	} else if len(trimmed) > 100 {
		errs = append(errs, fieldError{"nome", "máximo 100 caracteres"})
	}

	if len(servico) == 0 {
		errs = append(errs, fieldError{"servico", "obrigatório"})
	} else if !json.Valid(servico) || servico[0] != '{' {
		errs = append(errs, fieldError{"servico", "deve ser um objeto JSON válido"})
	}

	return errs
}
