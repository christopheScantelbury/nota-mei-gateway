// Package email provides a lightweight Resend HTTP API client for sending
// transactional emails from the Nota MEI Gateway.
package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
)

const defaultBaseURL = "https://api.resend.com"

// Client sends transactional emails via the Resend HTTP API.
// When apiKey is empty the client runs in dev-noop mode: emails are logged
// but no HTTP call is made, so local development works without a Resend key.
type Client struct {
	apiKey  string
	from    string
	baseURL string
	http    *http.Client
}

// New creates a Client using the production Resend endpoint.
func New(apiKey, from string) *Client {
	return NewWithBase(apiKey, from, defaultBaseURL, &http.Client{Timeout: 10 * time.Second})
}

// Enabled reports whether the client is configured to actually send emails.
// When false, Send runs in dev-noop mode (logs but does not deliver), so
// user-facing handlers must surface an honest "not configured" message instead
// of pretending the email was delivered.
func (c *Client) Enabled() bool { return c.apiKey != "" }

// NewWithBase creates a Client with an overridable base URL and HTTP client.
// Useful for tests (httptest.NewServer).
func NewWithBase(apiKey, from, baseURL string, httpClient *http.Client) *Client {
	return &Client{
		apiKey:  apiKey,
		from:    from,
		baseURL: baseURL,
		http:    httpClient,
	}
}

// SendRequest holds the data for one outbound email.
type SendRequest struct {
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

// sendPayload is the JSON body sent to Resend — includes the "from" field
// which is managed by the Client and not exposed to callers.
type sendPayload struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

// SendResponse is the successful response from Resend.
type SendResponse struct {
	ID string `json:"id"`
}

// Send delivers one email via the Resend API and returns the generated email
// ID. In dev-noop mode (empty apiKey) the email is logged and "dev-noop" is
// returned without making any HTTP call.
func (c *Client) Send(ctx context.Context, req SendRequest) (string, error) {
	if c.apiKey == "" {
		log.Ctx(ctx).Info().
			Strs("to", req.To).
			Str("subject", req.Subject).
			Msg("email: dev-noop mode — email not sent")
		return "dev-noop", nil
	}

	payload := sendPayload{
		From:    c.from,
		To:      req.To,
		Subject: req.Subject,
		HTML:    req.HTML,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("email: marshal payload: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/emails", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("email: build request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("email: http request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("email: resend returned %d: %s", resp.StatusCode, string(respBody))
	}

	var sr SendResponse
	if err := json.Unmarshal(respBody, &sr); err != nil {
		return "", fmt.Errorf("email: decode response: %w", err)
	}
	return sr.ID, nil
}
