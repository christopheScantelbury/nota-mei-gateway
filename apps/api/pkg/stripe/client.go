// Package stripe wraps the Stripe Go SDK for use within the API.
package stripe

import (
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/client"
)

// Client wraps the Stripe API client with the project's secret key pre-configured.
type Client struct {
	api *client.API
}

// New sets the global Stripe key and returns a Client ready for API calls.
func New(secretKey string) *Client {
	stripe.Key = secretKey
	c := &client.API{}
	c.Init(secretKey, nil)
	return &Client{api: c}
}
