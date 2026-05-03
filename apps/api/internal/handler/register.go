package handler

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog/log"
)

var cnpjRe = regexp.MustCompile(`^\d{14}$`)

type meiRegistrar interface {
	RegisterMEI(ctx context.Context, p auth.RegisterMEIParams) (*auth.RegisterMEIResult, error)
}

type cnpjChecker interface {
	Validate(ctx context.Context, cnpj string) error
}

// RegisterHandler handles POST /v1/auth/register.
type RegisterHandler struct {
	repo          meiRegistrar
	cnpjValidator cnpjChecker
}

// NewRegisterHandler creates a RegisterHandler.
func NewRegisterHandler(repo meiRegistrar) *RegisterHandler {
	return &RegisterHandler{repo: repo}
}

// WithCNPJValidator adds CNPJ check-digit and MEI verification to the handler.
func (h *RegisterHandler) WithCNPJValidator(v cnpjChecker) *RegisterHandler {
	h.cnpjValidator = v
	return h
}

type registerRequest struct {
	CNPJ          string `json:"cnpj"`
	RazaoSocial   string `json:"razao_social"`
	Email         string `json:"email"`
	MunicipioIBGE string `json:"municipio_ibge"`
}

// Register handles POST /v1/auth/register — public, no Bearer token required.
func (h *RegisterHandler) Register(c *fiber.Ctx) error {
	var req registerRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":      "VALIDATION_ERROR",
			"message":    "corpo da requisição inválido",
			"request_id": c.Locals("request_id"),
		})
	}

	// Normalise CNPJ — accept formatted (XX.XXX.XXX/XXXX-XX) or raw digits.
	req.CNPJ = strings.NewReplacer(".", "", "/", "", "-", "").Replace(req.CNPJ)

	type fieldErr struct {
		Field   string `json:"field"`
		Message string `json:"message"`
	}
	var fields []fieldErr

	if !cnpjRe.MatchString(req.CNPJ) {
		fields = append(fields, fieldErr{"cnpj", "deve conter 14 dígitos numéricos"})
	}
	if strings.TrimSpace(req.RazaoSocial) == "" {
		fields = append(fields, fieldErr{"razao_social", "obrigatório"})
	}
	if strings.TrimSpace(req.Email) == "" {
		fields = append(fields, fieldErr{"email", "obrigatório"})
	}
	if len(req.MunicipioIBGE) != 7 || !regexp.MustCompile(`^\d{7}$`).MatchString(req.MunicipioIBGE) {
		fields = append(fields, fieldErr{"municipio_ibge", "deve conter 7 dígitos numéricos"})
	}
	if len(fields) > 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":      "VALIDATION_ERROR",
			"message":    "campos inválidos",
			"fields":     fields,
			"request_id": c.Locals("request_id"),
		})
	}

	// CNPJ check-digit + MEI verification (with Redis cache + RF API).
	if h.cnpjValidator != nil {
		if err := h.cnpjValidator.Validate(c.Context(), req.CNPJ); err != nil {
			switch {
			case errors.Is(err, auth.ErrInvalidCNPJ):
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error":      "INVALID_CNPJ",
					"message":    "CNPJ inválido",
					"request_id": c.Locals("request_id"),
				})
			case errors.Is(err, auth.ErrNotMEI):
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error":      "NOT_MEI",
					"message":    "CNPJ não pertence a um MEI",
					"request_id": c.Locals("request_id"),
				})
			default:
				log.Ctx(c.Context()).Error().Err(err).Str("cnpj", req.CNPJ).Msg("cnpj validation error")
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error":      "INTERNAL_ERROR",
					"message":    "erro ao validar CNPJ",
					"request_id": c.Locals("request_id"),
				})
			}
		}
	}

	result, err := h.repo.RegisterMEI(c.Context(), auth.RegisterMEIParams{
		CNPJ:          req.CNPJ,
		RazaoSocial:   strings.TrimSpace(req.RazaoSocial),
		Email:         strings.TrimSpace(strings.ToLower(req.Email)),
		MunicipioIBGE: req.MunicipioIBGE,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error":      "CONFLICT",
				"message":    "CNPJ ou e-mail já cadastrado",
				"request_id": c.Locals("request_id"),
			})
		}
		log.Ctx(c.Context()).Error().Err(err).Str("cnpj", req.CNPJ).Msg("register MEI failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "erro ao cadastrar MEI",
			"request_id": c.Locals("request_id"),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"mei_id":  result.MeiID,
		"api_key": result.APIKey,
		"plano":   "Trial",
		"message": "MEI cadastrado com sucesso. Guarde sua api_key — ela não será exibida novamente.",
	})
}
