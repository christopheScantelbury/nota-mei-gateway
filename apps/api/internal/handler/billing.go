package handler

import (
	"math"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	stripeClient "github.com/christopheScantelbury/nota-mei-gateway/api/pkg/stripe"
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
	stripelib "github.com/stripe/stripe-go/v81"
	portalsession "github.com/stripe/stripe-go/v81/billingportal/session"
	checkoutsession "github.com/stripe/stripe-go/v81/checkout/session"
)

// BillingHandler handles billing-related endpoints.
type BillingHandler struct {
	stripe        *stripeClient.Client
	priceStarter  string
	priceBasic    string
	pricePro      string
	priceBusiness string
	apiBase       string
}

// NewBillingHandler creates a BillingHandler.
func NewBillingHandler(
	sc *stripeClient.Client,
	priceStarter, priceBasic, pricePro, priceBusiness string,
	apiBase string,
) *BillingHandler {
	return &BillingHandler{
		stripe:        sc,
		priceStarter:  priceStarter,
		priceBasic:    priceBasic,
		pricePro:      pricePro,
		priceBusiness: priceBusiness,
		apiBase:       apiBase,
	}
}

// GetUsage handles GET /v1/billing/usage.
// ME-51: returns trial:true for ME/EPP companies still on the trial plan.
func (h *BillingHandler) GetUsage(c *fiber.Ctx) error {
	mei := auth.GetMEI(c)
	empresa := auth.GetEmpresa(c)

	if mei == nil && empresa == nil {
		return internalError(c, "nenhuma empresa autenticada no contexto")
	}

	var utilizadas, limite int
	var planoNome string
	var precExcedente float64
	var trial bool

	if empresa != nil {
		utilizadas = empresa.TotalEmitidas
		limite = empresa.PlanoLimite
		planoNome = empresa.PlanoNome
		precExcedente = empresa.PlanoPrecExcedente
		trial = empresa.TrialMe
	} else {
		utilizadas = mei.TotalEmitidas
		limite = mei.PlanoLimite
		planoNome = mei.PlanoNome
		precExcedente = mei.PlanoPrecExcedente
	}

	disponiveis := max(0, limite-utilizadas)
	excedente := math.Max(0, float64(utilizadas-limite)) * precExcedente

	now := time.Now().UTC()
	renovacaoEm := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, time.UTC)

	resp := fiber.Map{
		"plano":                    planoNome,
		"emissoes_limite":          limite,
		"emissoes_utilizadas":      utilizadas,
		"emissoes_disponiveis":     disponiveis,
		"renovacao_em":             renovacaoEm.Format(time.RFC3339),
		"excedente_estimado_reais": math.Round(excedente*100) / 100,
	}
	if trial {
		resp["trial"] = true
		resp["trial_info"] = "acesso trial — plano comercial disponível em breve"
	}
	return c.JSON(resp)
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// GetPortal handles GET /v1/billing/portal — creates a Stripe Customer Portal session.
func (h *BillingHandler) GetPortal(c *fiber.Ctx) error {
	mei := auth.GetMEI(c)
	if mei == nil {
		return internalError(c, "MEI not in context")
	}
	if mei.StripeCustomerID == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "NO_STRIPE_CUSTOMER",
			"message": "MEI ainda não tem uma assinatura ativa",
		})
	}

	params := &stripelib.BillingPortalSessionParams{
		Customer:  stripelib.String(*mei.StripeCustomerID),
		ReturnURL: stripelib.String(h.apiBase + "/dashboard/billing"),
	}
	s, err := portalsession.New(params)
	if err != nil {
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", mei.ID.String()).Msg("stripe portal error")
		return internalError(c, "erro ao criar portal de cobrança")
	}

	return c.JSON(fiber.Map{"url": s.URL})
}

// CreateCheckout handles POST /v1/billing/checkout — creates a Stripe Checkout Session.
func (h *BillingHandler) CreateCheckout(c *fiber.Ctx) error {
	mei := auth.GetMEI(c)
	if mei == nil {
		return internalError(c, "MEI not in context")
	}

	var body struct {
		Plano string `json:"plano"` // starter | basic | pro | business
	}
	if err := c.BodyParser(&body); err != nil {
		return validationError(c, "corpo inválido")
	}

	priceID := h.priceForPlano(body.Plano)
	if priceID == "" {
		return validationError(c, "plano inválido: use starter, basic, pro ou business")
	}

	params := &stripelib.CheckoutSessionParams{
		Mode: stripelib.String(string(stripelib.CheckoutSessionModeSubscription)),
		LineItems: []*stripelib.CheckoutSessionLineItemParams{
			{Price: stripelib.String(priceID), Quantity: stripelib.Int64(1)},
		},
		SuccessURL: stripelib.String(h.apiBase + "/dashboard/billing?checkout=success"),
		CancelURL:  stripelib.String(h.apiBase + "/dashboard/billing?checkout=cancel"),
	}
	if mei.StripeCustomerID != nil {
		params.Customer = stripelib.String(*mei.StripeCustomerID)
	} else {
		params.CustomerEmail = stripelib.String(mei.Email)
	}

	params.AddMetadata("mei_id", mei.ID.String())

	s, err := checkoutsession.New(params)
	if err != nil {
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", mei.ID.String()).Msg("stripe checkout error")
		return internalError(c, "erro ao criar sessão de checkout")
	}

	return c.JSON(fiber.Map{"url": s.URL})
}

func (h *BillingHandler) priceForPlano(plano string) string {
	switch plano {
	case "starter":
		return h.priceStarter
	case "basic":
		return h.priceBasic
	case "pro":
		return h.pricePro
	case "business":
		return h.priceBusiness
	default:
		return ""
	}
}
