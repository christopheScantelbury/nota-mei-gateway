// Package stripe wraps the Stripe Go SDK for use within the API.
package stripe

import (
	"context"
	"fmt"

	stripelib "github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/client"
)

// Client wraps the Stripe API client with the project's secret key pre-configured.
type Client struct {
	api *client.API
}

// New sets the global Stripe key and returns a Client ready for API calls.
func New(secretKey string) *Client {
	stripelib.Key = secretKey
	c := &client.API{}
	c.Init(secretKey, nil)
	return &Client{api: c}
}

// ReportUsage records one unit of metered usage for the given subscription item.
// Call this every time a note is authorized beyond the plan's included limit.
// The idempotency key prevents double-counting if the request is retried.
func (c *Client) ReportUsage(ctx context.Context, subscriptionItemID, idempotencyKey string) error {
	params := &stripelib.UsageRecordParams{
		Quantity:         stripelib.Int64(1),
		SubscriptionItem: stripelib.String(subscriptionItemID),
		Action:           stripelib.String("increment"),
	}
	if idempotencyKey != "" {
		params.IdempotencyKey = stripelib.String(idempotencyKey)
	}
	_, err := c.api.UsageRecords.New(params)
	if err != nil {
		return fmt.Errorf("stripe usage report for item %s: %w", subscriptionItemID, err)
	}
	return nil
}
