package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/billing"
	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/email"
	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/supabase"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	stripelib "github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/webhook"
)

// StripeWebhookHandler handles POST /v1/webhooks/stripe.
type StripeWebhookHandler struct {
	secret     string
	db         *supabase.Client
	billingGrd *billing.Guard // optional — invalidates subscription cache on events
	emailSvc   *email.Service // optional — sends transactional emails
}

// NewStripeWebhookHandler creates a handler that validates Stripe events
// using the given webhook signing secret.
func NewStripeWebhookHandler(secret string, db *supabase.Client) *StripeWebhookHandler {
	return &StripeWebhookHandler{secret: secret, db: db}
}

// WithBillingGuard sets the BillingGuard so the webhook handler can invalidate
// the Stripe subscription-status cache whenever a subscription event fires.
// This ensures NFSe requests always see fresh subscription state within one
// request cycle after a Stripe event arrives.
func (h *StripeWebhookHandler) WithBillingGuard(g *billing.Guard) *StripeWebhookHandler {
	h.billingGrd = g
	return h
}

// WithEmailService attaches an email.Service so transactional emails are sent
// on billing events (e.g. invoice.payment_failed).
func (h *StripeWebhookHandler) WithEmailService(svc *email.Service) *StripeWebhookHandler {
	h.emailSvc = svc
	return h
}

// Handle validates the Stripe signature, deduplicates the event,
// and dispatches to the appropriate processor.
func (h *StripeWebhookHandler) Handle(c *fiber.Ctx) error {
	payload := c.Body()
	sig := c.Get("Stripe-Signature")

	event, err := webhook.ConstructEvent(payload, sig, h.secret)
	if err != nil {
		log.Ctx(c.Context()).Warn().Err(err).Msg("stripe webhook signature invalid")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid signature",
		})
	}

	ctx := c.Context()

	// Idempotency: skip already-processed events.
	if processed, _ := h.isProcessed(ctx, event.ID); processed {
		return c.SendStatus(fiber.StatusOK)
	}

	var processingErr error
	switch event.Type {
	case "checkout.session.completed":
		processingErr = h.handleCheckoutCompleted(ctx, event)
	case "customer.subscription.created",
		"customer.subscription.updated",
		"customer.subscription.deleted":
		processingErr = h.handleSubscription(ctx, event)
	case "invoice.paid":
		processingErr = h.handleInvoicePaid(ctx, event)
	case "invoice.payment_failed":
		processingErr = h.handleInvoicePaymentFailed(ctx, event)
	default:
		// Acknowledge unhandled events — Stripe will not retry.
	}

	if processingErr != nil {
		log.Ctx(ctx).Error().Err(processingErr).
			Str("event_id", event.ID).Str("type", string(event.Type)).
			Msg("stripe webhook processing failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "processing error"})
	}

	_ = h.markProcessed(ctx, event.ID, string(event.Type))
	return c.SendStatus(fiber.StatusOK)
}

// handleSubscription updates the emissoes_mensais row with Stripe subscription
// data — INCLUDING the new plano_id when the user upgrades/downgrades.
//
// Reads from sub.Metadata (set by the checkout endpoint):
//   - mei_id      → MEI legacy owner (also used as empresa_id under ARCH-03)
//   - empresa_id  → ME/EPP empresa owner
//   - plano_id    → uuid of the plan the user is moving to (preferred)
//
// Fallback: when plano_id metadata is missing, we resolve it by looking up
// planos.stripe_price_id against the first subscription item's price.id.
//
// Side effects:
//   - UPDATE emissoes_mensais SET plano_id, stripe_subscription_id/status
//   - UPDATE empresas SET trial_me=false (if owner is ME/EPP)
//   - Invalidate BillingGuard cache (MEI or empresa scope)
func (h *StripeWebhookHandler) handleSubscription(ctx context.Context, event stripelib.Event) error {
	var sub stripelib.Subscription
	if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
		return err
	}

	// Resolve owner: empresa_id wins over mei_id (ME/EPP path).
	meiIDStr := sub.Metadata["mei_id"]
	empresaIDStr := sub.Metadata["empresa_id"]
	if meiIDStr == "" && empresaIDStr == "" {
		log.Ctx(ctx).Warn().Str("sub_id", sub.ID).
			Msg("subscription missing mei_id/empresa_id metadata — cannot update plan")
		return nil
	}

	// Resolve plano_id: metadata first, then via stripe_price_id of the sub item.
	planoID, _ := uuid.Parse(sub.Metadata["plano_id"]) // zero UUID if missing/invalid
	if planoID == uuid.Nil && len(sub.Items.Data) > 0 && sub.Items.Data[0].Price != nil {
		priceID := sub.Items.Data[0].Price.ID
		var pid uuid.UUID
		row := h.db.Pool().QueryRow(ctx, `
			SELECT id FROM planos WHERE stripe_price_id = $1 AND ativo = true LIMIT 1
		`, priceID)
		if err := row.Scan(&pid); err == nil {
			planoID = pid
		} else {
			log.Ctx(ctx).Warn().Str("sub_id", sub.ID).Str("price_id", priceID).
				Msg("subscription: cannot resolve plano_id from stripe_price_id")
		}
	}

	// Downgrade pra Trial quando subscription é cancelada (user cancelou pelo
	// Stripe Customer Portal ou Stripe expirou subscription com falha de
	// pagamento). Resolve o Trial pelo tipo da empresa.
	if string(sub.Status) == "canceled" {
		tipoEmpresa := "MEI"
		if empresaIDStr != "" {
			var t string
			if err := h.db.Pool().QueryRow(ctx, `
				SELECT tipo FROM empresas WHERE id = $1
			`, empresaIDStr).Scan(&t); err == nil && t != "" {
				tipoEmpresa = t
			}
		}
		var trialID uuid.UUID
		err := h.db.Pool().QueryRow(ctx, `
			SELECT id FROM planos
			WHERE nome ILIKE 'Trial%'
			  AND ativo = true
			  AND (tipo_empresa = $1 OR tipo_empresa = 'ALL')
			ORDER BY emissoes_limite DESC
			LIMIT 1
		`, tipoEmpresa).Scan(&trialID)
		if err == nil {
			planoID = trialID
			log.Ctx(ctx).Info().
				Str("sub_id", sub.ID).
				Str("tipo_empresa", tipoEmpresa).
				Str("trial_plano_id", trialID.String()).
				Msg("subscription canceled — downgrading owner to Trial")
		} else {
			log.Ctx(ctx).Warn().Err(err).
				Str("sub_id", sub.ID).
				Str("tipo_empresa", tipoEmpresa).
				Msg("subscription canceled but Trial plano not found — keeping current plano_id")
		}
	}

	// Build UPDATE — only set plano_id when we resolved it (avoid wiping a
	// good plan because metadata was missing).
	if empresaIDStr != "" {
		empresaID, err := uuid.Parse(empresaIDStr)
		if err != nil {
			return fmt.Errorf("invalid empresa_id: %w", err)
		}
		if err := h.updateSubscriptionByOwner(ctx, ownerKindEmpresa, empresaID, sub.ID, string(sub.Status), planoID); err != nil {
			return err
		}
		// ME/EPP that paid → no more trial_me bypass.
		if _, err := h.db.Pool().Exec(ctx, `
			UPDATE empresas SET trial_me = false, updated_at = NOW() WHERE id = $1
		`, empresaID); err != nil {
			log.Ctx(ctx).Warn().Err(err).Str("empresa_id", empresaID.String()).
				Msg("subscription: could not unset trial_me")
		}
		if h.billingGrd != nil {
			h.billingGrd.InvalidateEmpresa(ctx, empresaID)
		}
		return nil
	}

	// MEI legacy path.
	meiID, err := uuid.Parse(meiIDStr)
	if err != nil {
		return fmt.Errorf("invalid mei_id: %w", err)
	}
	if err := h.updateSubscriptionByOwner(ctx, ownerKindMEI, meiID, sub.ID, string(sub.Status), planoID); err != nil {
		return err
	}
	if h.billingGrd != nil {
		if cerr := h.billingGrd.InvalidateSubscriptionCache(ctx, meiID); cerr != nil {
			log.Ctx(ctx).Warn().Err(cerr).Str("mei_id", meiID.String()).
				Msg("failed to invalidate billing stripe-status cache")
		}
	}
	return nil
}

type ownerKind int

const (
	ownerKindMEI ownerKind = iota
	ownerKindEmpresa
)

// updateSubscriptionByOwner upserts the current-month emissoes_mensais row
// with subscription state. When planoID != Nil it also moves the plan;
// otherwise the existing plan stays.
func (h *StripeWebhookHandler) updateSubscriptionByOwner(
	ctx context.Context,
	kind ownerKind,
	ownerID uuid.UUID,
	subID, subStatus string,
	planoID uuid.UUID,
) error {
	ownerCol := "mei_id"
	if kind == ownerKindEmpresa {
		ownerCol = "empresa_id"
	}

	// 2-step: try UPDATE first (keeps total_emitidas intact). If 0 rows
	// affected, INSERT a fresh row for this competência.
	planoUpdate := ""
	planoUpsertCol := ""
	planoUpsertVal := "DEFAULT"
	args := []interface{}{subID, subStatus, ownerID}
	if planoID != uuid.Nil {
		planoUpdate = ", plano_id = $4"
		planoUpsertCol = ", plano_id"
		planoUpsertVal = "$4"
		args = append(args, planoID)
	}

	tag, err := h.db.Pool().Exec(ctx, fmt.Sprintf(`
		UPDATE emissoes_mensais
		SET stripe_subscription_id     = $1,
		    stripe_subscription_status = $2%s
		WHERE %s = $3
		  AND competencia = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
	`, planoUpdate, ownerCol), args...)
	if err != nil {
		return fmt.Errorf("update emissoes_mensais (%s): %w", ownerCol, err)
	}

	if tag.RowsAffected() == 0 {
		// Row doesn't exist yet for this competência — INSERT it.
		// For MEI legacy, the empresa_id mirrors mei_id (ARCH-03 invariant).
		insertCols := ownerCol
		insertVals := "$3"
		if kind == ownerKindMEI {
			insertCols = "mei_id, empresa_id"
			insertVals = "$3, $3"
		}
		_, err = h.db.Pool().Exec(ctx, fmt.Sprintf(`
			INSERT INTO emissoes_mensais (%s, competencia, stripe_subscription_id, stripe_subscription_status%s, total_emitidas)
			VALUES (%s, to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM'), $1, $2, %s, 0)
			ON CONFLICT DO NOTHING
		`, insertCols, planoUpsertCol, insertVals, planoUpsertVal), args...)
		if err != nil {
			return fmt.Errorf("insert emissoes_mensais (%s): %w", ownerCol, err)
		}
	}
	return nil
}

// handleCheckoutCompleted fires when a Stripe Checkout Session completes.
// It persists stripe_customer_id on the owner row (meis OR empresas) so
// future portal/checkout calls reuse the same customer instead of creating
// duplicates in Stripe.
func (h *StripeWebhookHandler) handleCheckoutCompleted(ctx context.Context, event stripelib.Event) error {
	var session stripelib.CheckoutSession
	if err := json.Unmarshal(event.Data.Raw, &session); err != nil {
		return err
	}
	if session.Customer == nil {
		return nil
	}
	customerID := session.Customer.ID

	// Prefer empresa_id (new ME/EPP path); fallback to mei_id.
	if empresaIDStr, ok := session.Metadata["empresa_id"]; ok && empresaIDStr != "" {
		empresaID, err := uuid.Parse(empresaIDStr)
		if err != nil {
			return fmt.Errorf("invalid empresa_id in checkout metadata: %w", err)
		}
		_, err = h.db.Pool().Exec(ctx, `
			UPDATE empresas
			SET stripe_customer_id = $1, updated_at = NOW()
			WHERE id = $2
		`, customerID, empresaID)
		return err
	}

	if meiIDStr, ok := session.Metadata["mei_id"]; ok && meiIDStr != "" {
		meiID, err := uuid.Parse(meiIDStr)
		if err != nil {
			return fmt.Errorf("invalid mei_id in checkout metadata: %w", err)
		}
		_, err = h.db.Pool().Exec(ctx, `
			UPDATE meis
			SET stripe_customer_id = $1, updated_at = NOW()
			WHERE id = $2
		`, customerID, meiID)
		return err
	}

	log.Ctx(ctx).Warn().Str("session_id", session.ID).
		Msg("checkout.session.completed: missing both mei_id and empresa_id metadata")
	return nil
}

// handleInvoicePaid ensures the subscription status is active when an
// invoice is paid (covers initial payment and renewals).
func (h *StripeWebhookHandler) handleInvoicePaid(ctx context.Context, event stripelib.Event) error {
	var inv stripelib.Invoice
	if err := json.Unmarshal(event.Data.Raw, &inv); err != nil {
		return err
	}
	if inv.Subscription == nil {
		return nil
	}
	_, err := h.db.Pool().Exec(ctx, `
		UPDATE emissoes_mensais
		SET stripe_subscription_status = 'active',
		    updated_at                  = NOW()
		WHERE stripe_subscription_id = $1
		  AND competencia = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
	`, inv.Subscription.ID)
	if err != nil {
		return err
	}
	h.invalidateCacheBySubscriptionID(ctx, inv.Subscription.ID)
	return nil
}

// handleInvoicePaymentFailed marks the subscription as past_due so the
// BillingGuard can block new emissions until payment is resolved.
func (h *StripeWebhookHandler) handleInvoicePaymentFailed(ctx context.Context, event stripelib.Event) error {
	var inv stripelib.Invoice
	if err := json.Unmarshal(event.Data.Raw, &inv); err != nil {
		return err
	}
	if inv.Subscription == nil {
		return nil
	}
	_, err := h.db.Pool().Exec(ctx, `
		UPDATE emissoes_mensais
		SET stripe_subscription_status = 'past_due',
		    updated_at                  = NOW()
		WHERE stripe_subscription_id = $1
		  AND competencia = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
	`, inv.Subscription.ID)
	if err != nil {
		return err
	}
	h.invalidateCacheBySubscriptionID(ctx, inv.Subscription.ID)

	// Send payment-failed email asynchronously — fetch MEI details from DB.
	if h.emailSvc != nil {
		subID := inv.Subscription.ID
		var amountDue int64
		if inv.AmountDue != 0 {
			amountDue = inv.AmountDue
		}
		emailSvc := h.emailSvc
		db := h.db
		go func(baseCtx context.Context) { //nolint:contextcheck
			ctx2, cancel := context.WithTimeout(baseCtx, 10*time.Second)
			defer cancel()

			// Owner = MEI OR empresa. Try empresas first (ME/EPP), fall back to meis.
			type ownerRow struct {
				Email       string
				RazaoSocial string
			}
			var owner ownerRow
			row := db.Pool().QueryRow(ctx2, `
				SELECT e.email, e.razao_social
				FROM empresas e
				JOIN emissoes_mensais em ON em.empresa_id = e.id
				WHERE em.stripe_subscription_id = $1
				LIMIT 1
			`, subID)
			if err := row.Scan(&owner.Email, &owner.RazaoSocial); err != nil {
				row = db.Pool().QueryRow(ctx2, `
					SELECT m.email, m.razao_social
					FROM meis m
					JOIN emissoes_mensais em ON em.mei_id = m.id
					WHERE em.stripe_subscription_id = $1
					LIMIT 1
				`, subID)
				if err := row.Scan(&owner.Email, &owner.RazaoSocial); err != nil {
					log.Ctx(ctx2).Warn().Err(err).Str("sub_id", subID).
						Msg("stripe webhook: could not fetch owner for payment-failed email")
					return
				}
			}

			// Format amount: Stripe stores in centavos (BRL).
			valorBRL := fmt.Sprintf("%.2f", float64(amountDue)/100.0)
			portalURL := "https://billing.stripe.com/p/login/"

			if err := emailSvc.SendPagamentoFalhou(ctx2, owner.Email, owner.RazaoSocial, "", valorBRL, portalURL); err != nil {
				log.Ctx(ctx2).Warn().Err(err).Msg("email pagamento-falhou falhou")
			}
		}(context.WithoutCancel(ctx))
	}

	return nil
}

// invalidateCacheBySubscriptionID looks up the owner (MEI or empresa) for a
// given Stripe subscription ID and invalidates their billing cache.
// Errors are logged but do not fail the webhook — the cache TTL is fallback.
func (h *StripeWebhookHandler) invalidateCacheBySubscriptionID(ctx context.Context, subID string) {
	if h.billingGrd == nil {
		return
	}
	row := h.db.Pool().QueryRow(ctx, `
		SELECT mei_id, empresa_id FROM emissoes_mensais
		WHERE stripe_subscription_id = $1
		LIMIT 1
	`, subID)
	var meiID, empresaID *uuid.UUID
	if err := row.Scan(&meiID, &empresaID); err != nil {
		return // subscription not yet in DB or already cleaned up
	}
	// Empresa path takes precedence (ME/EPP). For MEI legacy both are equal.
	if empresaID != nil {
		h.billingGrd.InvalidateEmpresa(ctx, *empresaID)
	}
	if meiID != nil {
		if err := h.billingGrd.InvalidateSubscriptionCache(ctx, *meiID); err != nil {
			log.Ctx(ctx).Warn().Err(err).Str("sub_id", subID).
				Msg("failed to invalidate billing stripe-status cache")
		}
	}
}

func (h *StripeWebhookHandler) isProcessed(ctx context.Context, eventID string) (bool, error) {
	row := h.db.Pool().QueryRow(ctx, `
		SELECT 1 FROM stripe_events WHERE stripe_event_id = $1
	`, eventID)
	var v int
	if err := row.Scan(&v); err != nil {
		return false, nil
	}
	return true, nil
}

func (h *StripeWebhookHandler) markProcessed(ctx context.Context, eventID, tipo string) error {
	_, err := h.db.Pool().Exec(ctx, `
		INSERT INTO stripe_events (stripe_event_id, tipo)
		VALUES ($1, $2)
		ON CONFLICT (stripe_event_id) DO NOTHING
	`, eventID, tipo)
	return err
}
