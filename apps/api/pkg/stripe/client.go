package stripe

import (
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/client"
)

type Client struct {
	api *client.API
}

func New(secretKey string) *Client {
	stripe.Key = secretKey
	c := &client.API{}
	c.Init(secretKey, nil)
	return &Client{api: c}
}
