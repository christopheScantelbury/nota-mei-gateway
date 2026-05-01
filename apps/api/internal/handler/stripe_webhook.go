package handler

import (
	"context"
	"encoding/json"

	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/supabase"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	stripelib "github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/webhook"
)

// StripeWebhookHandler handles POST /v1/webhooks/stripe.
type StripeWebhookHandler struct {
	secret string
	db     *supabase.Client
}

// NewStripeWebhookHandler creates a handler that validates Stripe events
// using the given webhook signing secret.
func NewStripeWebhookHandler(secret string, db *supabase.Client) *StripeWebhookHandler {
	return &StripeWebhookHandler{secret: secret, db: db}
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

	switch event.Type {
	case "customer.subscription.created",
		"customer.subscription.updated",
		"customer.subscription.deleted":
		if err := h.handleSubscription(ctx, event); err != nil {
			log.Ctx(ctx).Error().Err(err).Str("event_id", event.ID).Msg("subscription event processing failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "processing error"})
		}
	default:
		// Acknowledge unhandled events — Stripe will not retry.
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
	return err
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
