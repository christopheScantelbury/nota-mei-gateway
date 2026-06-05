package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/email"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog/log"
)

// validRegimes is the set of regime_tributario values accepted for ME/EPP.
// SIMPLES_MEI is intentionally excluded — it belongs only to MEI companies.
var validRegimes = map[string]bool{
	"SIMPLES_NACIONAL": true,
	"LUCRO_PRESUMIDO":  true,
	"LUCRO_REAL":       true,
}

// validTipos is the set of tipo values accepted at this endpoint.
// MEI companies register via POST /v1/auth/register.
var validTipos = map[string]bool{
	"ME":  true,
	"EPP": true,
}

type empresaRegistrar interface {
	RegisterEmpresa(ctx context.Context, p auth.RegisterEmpresaParams) (*auth.RegisterEmpresaResult, error)
}

// RegisterMEHandler handles POST /v1/auth/register/me.
type RegisterMEHandler struct {
	repo          empresaRegistrar
	cnpjValidator cnpjChecker // reused from register.go
	emailSvc      *email.Service
}

// NewRegisterMEHandler creates a RegisterMEHandler.
func NewRegisterMEHandler(repo empresaRegistrar) *RegisterMEHandler {
	return &RegisterMEHandler{repo: repo}
}

// WithCNPJValidator adds CNPJ check-digit validation (ME/EPP does not enforce MEI category).
func (h *RegisterMEHandler) WithCNPJValidator(v cnpjChecker) *RegisterMEHandler {
	h.cnpjValidator = v
	return h
}

// WithEmailService attaches an email.Service for welcome emails.
func (h *RegisterMEHandler) WithEmailService(svc *email.Service) *RegisterMEHandler {
	h.emailSvc = svc
	return h
}

type registerMERequest struct {
	Tipo               string `json:"tipo"`              // "ME" | "EPP"
	RegimeTributario   string `json:"regime_tributario"` // "SIMPLES_NACIONAL" | "LUCRO_PRESUMIDO"
	CNPJ               string `json:"cnpj"`
	RazaoSocial        string `json:"razao_social"`
	Email              string `json:"email"`
	MunicipioIBGE      string `json:"municipio_ibge"`
	CNAE               string `json:"cnae"`                // 7-digit CNAE code — required for DPS
	CEP                string `json:"cep"`                 // 8-digit CEP — required for DPS
	InscricaoMunicipal string `json:"inscricao_municipal"` // optional
}

// RegisterME handles POST /v1/auth/register/me — public, no Bearer token required.
func (h *RegisterMEHandler) RegisterME(c *fiber.Ctx) error {
	var req registerMERequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":      "VALIDATION_ERROR",
			"message":    "corpo da requisição inválido",
			"request_id": c.Locals("request_id"),
		})
	}

	// Normalise CNPJ — accept formatted (XX.XXX.XXX/XXXX-XX) or raw digits.
	req.CNPJ = strings.NewReplacer(".", "", "/", "", "-", "").Replace(req.CNPJ)
	req.Tipo = strings.ToUpper(strings.TrimSpace(req.Tipo))
	req.RegimeTributario = strings.ToUpper(strings.TrimSpace(req.RegimeTributario))

	type fieldErr struct {
		Field   string `json:"field"`
		Message string `json:"message"`
	}
	var fields []fieldErr

	if !validTipos[req.Tipo] {
		fields = append(fields, fieldErr{"tipo", "deve ser ME ou EPP"})
	}
	if !validRegimes[req.RegimeTributario] {
		fields = append(fields, fieldErr{"regime_tributario", "deve ser SIMPLES_NACIONAL, LUCRO_PRESUMIDO ou LUCRO_REAL"})
	}
	if !cnpjRe.MatchString(req.CNPJ) {
		fields = append(fields, fieldErr{"cnpj", "deve conter 14 dígitos numéricos"})
	}
	if strings.TrimSpace(req.RazaoSocial) == "" {
		fields = append(fields, fieldErr{"razao_social", "obrigatório"})
	}
	if strings.TrimSpace(req.Email) == "" {
		fields = append(fields, fieldErr{"email", "obrigatório"})
	}
	if !regexp.MustCompile(`^\d{7}$`).MatchString(req.MunicipioIBGE) {
		fields = append(fields, fieldErr{"municipio_ibge", "deve conter 7 dígitos numéricos"})
	}
	if req.CNAE != "" && !regexp.MustCompile(`^\d{7}$`).MatchString(strings.NewReplacer("-", "", "/", "").Replace(req.CNAE)) {
		fields = append(fields, fieldErr{"cnae", "deve conter 7 dígitos numéricos (ex: 6201500)"})
	}
	if req.CEP != "" && !regexp.MustCompile(`^\d{8}$`).MatchString(strings.NewReplacer("-", "").Replace(req.CEP)) {
		fields = append(fields, fieldErr{"cep", "deve conter 8 dígitos numéricos"})
	}
	if len(fields) > 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":      "VALIDATION_ERROR",
			"message":    "campos inválidos",
			"fields":     fields,
			"request_id": c.Locals("request_id"),
		})
	}

	// CNPJ check-digit validation only (no MEI category check for ME/EPP).
	if h.cnpjValidator != nil {
		if err := h.cnpjValidator.Validate(c.Context(), req.CNPJ); err != nil {
			// For ME/EPP we only surface INVALID_CNPJ — NOT_MEI is irrelevant here.
			if errors.Is(err, auth.ErrInvalidCNPJ) {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error":      "INVALID_CNPJ",
					"message":    "CNPJ inválido (dígito verificador incorreto)",
					"request_id": c.Locals("request_id"),
				})
			}
			// Soft fail on RF API errors — do not block registration.
			log.Ctx(c.Context()).Warn().Err(err).Str("cnpj", req.CNPJ).
				Msg("cnpj validation soft-fail (ME registration proceeds)")
		}
	}

	result, err := h.repo.RegisterEmpresa(c.Context(), auth.RegisterEmpresaParams{
		Tipo:               req.Tipo,
		RegimeTributario:   req.RegimeTributario,
		CNPJ:               req.CNPJ,
		RazaoSocial:        strings.TrimSpace(req.RazaoSocial),
		Email:              strings.TrimSpace(strings.ToLower(req.Email)),
		MunicipioIBGE:      req.MunicipioIBGE,
		CNAE:               strings.NewReplacer("-", "", "/", "").Replace(strings.TrimSpace(req.CNAE)),
		CEP:                strings.NewReplacer("-", "").Replace(strings.TrimSpace(req.CEP)),
		InscricaoMunicipal: strings.TrimSpace(req.InscricaoMunicipal),
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
		log.Ctx(c.Context()).Error().Err(err).Str("cnpj", req.CNPJ).Msg("register ME failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "erro ao cadastrar empresa",
			"request_id": c.Locals("request_id"),
		})
	}

	// Trigger Supabase OTP magic link em background — Supabase manda o email
	// usando o template customizado em PT-BR (já configurado via Management API).
	// A api_key fica armazenada no banco mas NÃO é exposta em response/email —
	// usuário acessa via dashboard quando precisar (/configuracoes > API Keys).
	toEmail := strings.TrimSpace(strings.ToLower(req.Email))
	go func() {
		ctx2, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := triggerSupabaseSignupMagicLink(ctx2, toEmail); err != nil {
			log.Warn().Err(err).Str("email", toEmail).Msg("supabase signup OTP falhou")
		}
	}()

	// Response NÃO inclui api_key — frontend mostra tela "verifique seu e-mail"
	// em vez de exibir a chave. Para devs que querem API Key imediata, criar
	// via /v1/auth/api-keys após login.
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"empresa_id":        result.EmpresaID,
		"tipo":              req.Tipo,
		"regime_tributario": req.RegimeTributario,
		"trial":             true,
		"email_sent_to":     toEmail,
		"message":           "Empresa cadastrada. Enviamos um link de acesso para seu e-mail.",
	})
}

// triggerSupabaseSignupMagicLink dispara um signup-OTP no Supabase Auth para
// o email informado. Supabase cria o auth.users row (create_user: true) E
// envia o e-mail magic link automaticamente usando o template customizado
// em PT-BR. O callback /auth/callback consome o token PKCE e linka o user_id
// ao empresa.email correspondente.
func triggerSupabaseSignupMagicLink(ctx context.Context, email string) error {
	supabaseURL := os.Getenv("NEXT_PUBLIC_SUPABASE_URL")
	if supabaseURL == "" {
		supabaseURL = os.Getenv("SUPABASE_URL")
	}
	anonKey := os.Getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
	if anonKey == "" {
		anonKey = os.Getenv("SUPABASE_ANON_KEY")
	}
	siteURL := os.Getenv("APP_SITE_URL")
	if siteURL == "" {
		siteURL = "https://www.emitirnotafacil.com.br"
	}
	if supabaseURL == "" || anonKey == "" {
		return errors.New("supabase URL/anon-key not configured")
	}

	payload, _ := json.Marshal(map[string]any{
		"email":             email,
		"create_user":       true,
		"email_redirect_to": siteURL + "/auth/callback?next=/home",
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		strings.TrimRight(supabaseURL, "/")+"/auth/v1/otp",
		bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", anonKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return errors.New("supabase otp non-2xx: " + resp.Status)
	}
	return nil
}
