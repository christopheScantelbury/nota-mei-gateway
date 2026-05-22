// Package email provides a Brevo HTTP API client for sending
// transactional emails from the Nota MEI Gateway.
//
// Uses the Brevo transactional email API (api.brevo.com/v3/smtp/email)
// over HTTPS (port 443) instead of SMTP (port 587) to avoid Railway's
// outbound SMTP port block.
//
// Required environment variables:
//
//	SMTP_HOST     kept for backward compat — value ignored (uses Brevo API)
//	SMTP_USER     kept for backward compat — value ignored (uses SMTP_PASS as API key)
//	SMTP_PASS     Brevo API key (same key used for SMTP auth)
//	EMAIL_FROM    display address (e.g. "NotaFácil MEI <nao-responda@emitirnotafacil.com.br>")
package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

const brevoAPIURL = "https://api.brevo.com/v3/smtp/email"

// Client sends transactional emails via the Brevo HTTP API.
// When apiKey is empty the client runs in dev-noop mode: emails are logged
// but no HTTP request is made.
type Client struct {
	host   string // kept for Enabled() compat — not used for sending
	port   string // kept for compat — not used
	user   string // kept for compat — not used
	pass   string // Brevo API key
	from   string // display address e.g. "Name <email@domain>"
	hc     *http.Client
}

// New creates a Client.
// Pass an empty host to enable dev-noop mode (useful in local development
// when no SMTP server is configured).
func New(host, port, user, pass, from string) *Client {
	if port == "" {
		port = "587"
	}
	return &Client{
		host: host,
		port: port,
		user: user,
		pass: pass,
		from: from,
		hc:   &http.Client{Timeout: 15 * time.Second},
	}
}

// NewFromEnv is a convenience wrapper — call it with the values loaded from
// environment variables SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM.
// Returns a Client ready to use; dev-noop when host is empty.
func NewFromEnv(host, port, user, pass, from string) *Client {
	return New(host, port, user, pass, from)
}

// Enabled reports whether the client is configured to actually send emails.
func (c *Client) Enabled() bool { return c.host != "" && c.pass != "" }

// SendRequest holds the data for one outbound email.
type SendRequest struct {
	To      []string
	Subject string
	HTML    string
}

// brevoRequest is the JSON body for POST /v3/smtp/email.
type brevoRequest struct {
	Sender      brevoAddr   `json:"sender"`
	To          []brevoAddr `json:"to"`
	Subject     string      `json:"subject"`
	HTMLContent string      `json:"htmlContent"`
}

type brevoAddr struct {
	Name  string `json:"name,omitempty"`
	Email string `json:"email"`
}

type brevoResponse struct {
	MessageID string `json:"messageId"`
}

// Send delivers one email via the Brevo HTTP API.
// In dev-noop mode (empty host/pass) the email is logged only.
func (c *Client) Send(ctx context.Context, req SendRequest) (string, error) {
	if !c.Enabled() {
		log.Ctx(ctx).Info().
			Strs("to", req.To).
			Str("subject", req.Subject).
			Msg("email: dev-noop mode — não configurado, email não enviado")
		return "dev-noop", nil
	}

	senderName, senderEmail := parseFromAddr(c.from)

	toAddrs := make([]brevoAddr, 0, len(req.To))
	for _, addr := range req.To {
		name, email := parseFromAddr(addr)
		toAddrs = append(toAddrs, brevoAddr{Name: name, Email: email})
	}

	payload := brevoRequest{
		Sender:      brevoAddr{Name: senderName, Email: senderEmail},
		To:          toAddrs,
		Subject:     req.Subject,
		HTMLContent: req.HTML,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("email: marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, brevoAPIURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("email: build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("api-key", c.pass)
	httpReq.Header.Set("Accept", "application/json")

	resp, err := c.hc.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("email: HTTP request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("email: Brevo API returned %d: %s", resp.StatusCode, string(respBody))
	}

	var brevoResp brevoResponse
	if err := json.Unmarshal(respBody, &brevoResp); err != nil {
		// non-fatal — API returned 2xx but body isn't JSON we expect
		return "ok", nil
	}

	log.Ctx(ctx).Info().
		Strs("to", req.To).
		Str("subject", req.Subject).
		Str("message_id", brevoResp.MessageID).
		Msg("email: enviado via Brevo API")

	return brevoResp.MessageID, nil
}

// parseFromAddr parses "Display Name <email@domain>" → (name, email).
// Falls back to ("", addr) for plain addresses.
func parseFromAddr(addr string) (name, email string) {
	addr = strings.TrimSpace(addr)
	if i := strings.Index(addr, "<"); i >= 0 {
		name = strings.TrimSpace(addr[:i])
		rest := addr[i+1:]
		if j := strings.Index(rest, ">"); j >= 0 {
			email = strings.TrimSpace(rest[:j])
		}
		return
	}
	return "", addr
}
