package handler

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/email"
	supabasepkg "github.com/christopheScantelbury/nota-mei-gateway/api/pkg/supabase"
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
	emailSvc      *email.Service
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

// WithEmailService attaches an email.Service so a welcome email is sent after
// successful registration.
func (h *RegisterHandler) WithEmailService(svc *email.Service) *RegisterHandler {
	h.emailSvc = svc
	return h
}

type registerRequest struct {
	CNPJ          string `json:"cnpj"`
	RazaoSocial   string `json:"razao_social"`
	Email         string `json:"email"`
	MunicipioIBGE string `json:"municipio_ibge"`
	Produto       string `json:"produto"` // "mei" | "gateway" — optional, defaults to "gateway"
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
			case errors.Is(err, auth.ErrCNPJNotFound):
				// CNPJ estruturalmente válido (DV ok) mas ausente da base pública —
				// tipicamente empresa recém-aberta ainda não indexada. NÃO bloqueia:
				// sem isso, o cadastro morria aqui no `default` com 500. A emissão
				// exige cert A1 do próprio CNPJ, então um número falso não passa lá.
				log.Ctx(c.UserContext()).Warn().Str("cnpj", req.CNPJ).
					Msg("CNPJ não indexado na base pública — cadastro MEI prossegue")
			default:
				log.Ctx(c.UserContext()).Error().Err(err).Str("cnpj", req.CNPJ).Msg("cnpj validation error")
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
		TipoUsuario:   req.Produto,
	})
	if err != nil {
		// ErrUserExists: email already in auth.users (Supabase Auth constraint).
		if errors.Is(err, supabasepkg.ErrUserExists) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error":      "CONFLICT",
				"message":    "E-mail já cadastrado. Faça login ou use outro e-mail.",
				"request_id": c.Locals("request_id"),
			})
		}
		// 23505: unique constraint violation on cnpj or email in meis/empresas tables.
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error":      "CONFLICT",
				"message":    "CNPJ ou e-mail já cadastrado. Faça login ou use outro e-mail.",
				"request_id": c.Locals("request_id"),
			})
		}
		log.Ctx(c.UserContext()).Error().
			Err(err).
			Str("cnpj", req.CNPJ).
			Str("email", req.Email).
			Str("municipio_ibge", req.MunicipioIBGE).
			Msg("register MEI failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "erro ao cadastrar MEI",
			"request_id": c.Locals("request_id"),
		})
	}

	// Fire welcome email in background — failure must not block the response.
	if h.emailSvc != nil {
		reqEmail := strings.TrimSpace(strings.ToLower(req.Email))
		razaoSocial := strings.TrimSpace(req.RazaoSocial)
		rawAPIKey := result.APIKey
		cnpj := req.CNPJ
		go func() {
			ctx2, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := h.emailSvc.SendBoasVindas(ctx2, reqEmail, razaoSocial, cnpj, rawAPIKey); err != nil {
				log.Ctx(c.Context()).Warn().Err(err).Msg("email boas-vindas falhou")
			}
		}()
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"mei_id":  result.MeiID,
		"api_key": result.APIKey,
		"plano":   "Trial",
		"message": "MEI cadastrado com sucesso. Guarde sua api_key — ela não será exibida novamente.",
	})
}
