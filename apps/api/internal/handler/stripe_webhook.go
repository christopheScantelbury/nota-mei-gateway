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

// handleSubscription updates the emissoes_mensais row with Stripe subscription data.
func (h *StripeWebhookHandler) handleSubscription(ctx context.Context, event stripelib.Event) error {
	var sub stripelib.Subscription
	if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
		return err
	}

	meiIDStr, ok := sub.Metadata["mei_id"]
	if !ok {
		log.Ctx(ctx).Warn().Str("sub_id", sub.ID).Msg("subscription missing mei_id metadata")
		return nil
	}
	meiID, err := uuid.Parse(meiIDStr)
	if err != nil {
		return err
	}

	_, err = h.db.Pool().Exec(ctx, `
		UPDATE emissoes_mensais
		SET stripe_subscription_id     = $1,
		    stripe_subscription_status = $2,
		    updated_at                 = NOW()
		WHERE mei_id     = $3
		  AND competencia = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
	`, sub.ID, string(sub.Status), meiID)
	if err != nil {
		return err
	}

	// Invalidate Redis cache so the next NFSe request sees the new status
	// without waiting for the 5-minute TTL to expire.
	if h.billingGrd != nil {
		if cerr := h.billingGrd.InvalidateSubscriptionCache(ctx, meiID); cerr != nil {
			log.Ctx(ctx).Warn().Err(cerr).Str("mei_id", meiID.String()).
				Msg("failed to invalidate billing stripe-status cache")
		}
	}
	return nil
}

// handleCheckoutCompleted fires when a Stripe Checkout Session completes.
// It saves the stripe_customer_id on the MEI so future portal/checkout calls
// can reference the customer without creating a duplicate.
func (h *StripeWebhookHandler) handleCheckoutCompleted(ctx context.Context, event stripelib.Event) error {
	var session stripelib.CheckoutSession
	if err := json.Unmarshal(event.Data.Raw, &session); err != nil {
		return err
	}

	meiIDStr, ok := session.Metadata["mei_id"]
	if !ok {
		log.Ctx(ctx).Warn().Str("session_id", session.ID).Msg("checkout.session.completed missing mei_id metadata")
		return nil
	}
	meiID, err := uuid.Parse(meiIDStr)
	if err != nil {
		return fmt.Errorf("invalid mei_id in checkout metadata: %w", err)
	}

	if session.Customer == nil {
		return nil
	}

	_, err = h.db.Pool().Exec(ctx, `
		UPDATE meis
		SET stripe_customer_id = $1, updated_at = NOW()
		WHERE id = $2
	`, session.Customer.ID, meiID)
	return err
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
		go func(baseCtx context.Context) {
			ctx2, cancel := context.WithTimeout(baseCtx, 10*time.Second)
			defer cancel()

			type meiRow struct {
				Email       string
				RazaoSocial string
			}
			row := db.Pool().QueryRow(ctx2, `
				SELECT m.email, m.razao_social
				FROM meis m
				JOIN emissoes_mensais em ON em.mei_id = m.id
				WHERE em.stripe_subscription_id = $1
				LIMIT 1
			`, subID)
			var mei meiRow
			if err := row.Scan(&mei.Email, &mei.RazaoSocial); err != nil {
				log.Ctx(ctx2).Warn().Err(err).Str("sub_id", subID).
					Msg("stripe webhook: could not fetch MEI for payment-failed email")
				return
			}

			// Format amount: Stripe stores in centavos (BRL).
			valorBRL := fmt.Sprintf("%.2f", float64(amountDue)/100.0)
			portalURL := "https://billing.stripe.com/p/login/"

			if err := emailSvc.SendPagamentoFalhou(ctx2, mei.Email, mei.RazaoSocial, "", valorBRL, portalURL); err != nil {
				log.Ctx(ctx2).Warn().Err(err).Msg("email pagamento-falhou falhou")
			}
		}(context.Background())
	}

	return nil
}

// invalidateCacheBySubscriptionID looks up the MEI for a given Stripe
// subscription ID and invalidates their subscription status cache.
// Errors are logged but do not fail the webhook — the cache TTL is the fallback.
func (h *StripeWebhookHandler) invalidateCacheBySubscriptionID(ctx context.Context, subID string) {
	if h.billingGrd == nil {
		return
	}
	row := h.db.Pool().QueryRow(ctx, `
		SELECT mei_id FROM emissoes_mensais
		WHERE stripe_subscription_id = $1
		LIMIT 1
	`, subID)
	var meiID uuid.UUID
	if err := row.Scan(&meiID); err != nil {
		return // subscription not yet in DB or already cleaned up
	}
	if err := h.billingGrd.InvalidateSubscriptionCache(ctx, meiID); err != nil {
		log.Ctx(ctx).Warn().Err(err).Str("sub_id", subID).
			Msg("failed to invalidate billing stripe-status cache")
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
