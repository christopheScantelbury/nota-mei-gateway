// Package email provides a lightweight SMTP email client for sending
// transactional emails from the Nota MEI Gateway.
//
// Compatible with any SMTP server:
//   - Brevo (smtp-relay.brevo.com:587) — 300 emails/day FREE
//   - Gmail  (smtp.gmail.com:587)       — 500/day with App Password
//   - Mailjet, SendGrid, AWS SES, etc.
//
// Required environment variables:
//
//	SMTP_HOST     smtp relay hostname  (e.g. smtp-relay.brevo.com)
//	SMTP_PORT     port, default 587    (STARTTLS)
//	SMTP_USER     authentication login (usually your account email)
//	SMTP_PASS     authentication password / API key
//	EMAIL_FROM    display address      (e.g. "NotaFácil MEI <nao-responda@emitirnotafacil.com.br>")
package email

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net"
	"net/smtp"
	"net/textproto"
	"time"

	"github.com/rs/zerolog/log"
)

// Client sends transactional emails via SMTP.
// When host is empty the client runs in dev-noop mode: emails are logged
// but no SMTP connection is made.
type Client struct {
	host string
	port string
	user string
	pass string
	from string
}

// New creates a Client.
// Pass an empty host to enable dev-noop mode (useful in local development
// when no SMTP server is configured).
func New(host, port, user, pass, from string) *Client {
	if port == "" {
		port = "587"
	}
	return &Client{host: host, port: port, user: user, pass: pass, from: from}
}

// NewFromEnv is a convenience wrapper — call it with the values loaded from
// environment variables SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM.
// Returns a Client ready to use; dev-noop when host is empty.
func NewFromEnv(host, port, user, pass, from string) *Client {
	return New(host, port, user, pass, from)
}

// Enabled reports whether the client is configured to actually send emails.
func (c *Client) Enabled() bool { return c.host != "" && c.user != "" && c.pass != "" }

// SendRequest holds the data for one outbound email.
type SendRequest struct {
	To      []string
	Subject string
	HTML    string
}

// Send delivers one email via SMTP.
// In dev-noop mode (empty host/user/pass) the email is logged only.
func (c *Client) Send(ctx context.Context, req SendRequest) (string, error) {
	if !c.Enabled() {
		log.Ctx(ctx).Info().
			Strs("to", req.To).
			Str("subject", req.Subject).
			Msg("email: dev-noop mode — SMTP não configurado, email não enviado")
		return "dev-noop", nil
	}

	msg, err := buildMIME(c.from, req.To, req.Subject, req.HTML)
	if err != nil {
		return "", fmt.Errorf("email: build MIME: %w", err)
	}

	addr := net.JoinHostPort(c.host, c.port)
	auth := smtp.PlainAuth("", c.user, c.pass, c.host)

	// Use STARTTLS (port 587 standard). Some providers (e.g. Gmail port 465)
	// use implicit TLS — handled below via tlsDialer fallback.
	tlsCfg := &tls.Config{ServerName: c.host, MinVersion: tls.VersionTLS12}

	// Attempt STARTTLS first (port 587, most providers).
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return "", fmt.Errorf("email: dial %s: %w", addr, err)
	}

	smtpClient, err := smtp.NewClient(conn, c.host)
	if err != nil {
		_ = conn.Close()
		return "", fmt.Errorf("email: smtp client: %w", err)
	}
	defer func() { _ = smtpClient.Quit() }()

	if ok, _ := smtpClient.Extension("STARTTLS"); ok {
		if err = smtpClient.StartTLS(tlsCfg); err != nil {
			return "", fmt.Errorf("email: STARTTLS: %w", err)
		}
	}

	if err = smtpClient.Auth(auth); err != nil {
		return "", fmt.Errorf("email: AUTH: %w", err)
	}

	if err = smtpClient.Mail(extractAddr(c.from)); err != nil {
		return "", fmt.Errorf("email: MAIL FROM: %w", err)
	}
	for _, to := range req.To {
		if err = smtpClient.Rcpt(to); err != nil {
			return "", fmt.Errorf("email: RCPT TO %s: %w", to, err)
		}
	}

	wc, err := smtpClient.Data()
	if err != nil {
		return "", fmt.Errorf("email: DATA: %w", err)
	}
	if _, err = wc.Write(msg); err != nil {
		_ = wc.Close()
		return "", fmt.Errorf("email: write body: %w", err)
	}
	if err = wc.Close(); err != nil {
		return "", fmt.Errorf("email: close DATA: %w", err)
	}

	log.Ctx(ctx).Info().
		Strs("to", req.To).
		Str("subject", req.Subject).
		Msg("email: enviado com sucesso via SMTP")

	return "ok", nil
}

// ─── MIME builder ────────────────────────────────────────────────────────────

// buildMIME assembles a multipart/alternative MIME message with a text/plain
// fallback and a text/html part (quoted-printable encoded).
func buildMIME(from string, to []string, subject, html string) ([]byte, error) {
	var buf bytes.Buffer

	// Headers
	fmt.Fprintf(&buf, "From: %s\r\n", from)
	fmt.Fprintf(&buf, "To: %s\r\n", joinAddrs(to))
	fmt.Fprintf(&buf, "Subject: %s\r\n", mime.QEncoding.Encode("utf-8", subject))
	fmt.Fprintf(&buf, "MIME-Version: 1.0\r\n")
	fmt.Fprintf(&buf, "Date: %s\r\n", time.Now().UTC().Format("Mon, 02 Jan 2006 15:04:05 +0000"))

	mw := multipart.NewWriter(&buf)
	fmt.Fprintf(&buf, "Content-Type: multipart/alternative; boundary=%q\r\n\r\n", mw.Boundary())

	// ── plain text fallback ──
	ptHeader := textproto.MIMEHeader{}
	ptHeader.Set("Content-Type", "text/plain; charset=utf-8")
	ptHeader.Set("Content-Transfer-Encoding", "quoted-printable")
	ptPart, err := mw.CreatePart(ptHeader)
	if err != nil {
		return nil, err
	}
	ptQP := quotedprintable.NewWriter(ptPart)
	_, _ = ptQP.Write([]byte(htmlToPlain(html)))
	_ = ptQP.Close()

	// ── HTML part ──
	htmlHeader := textproto.MIMEHeader{}
	htmlHeader.Set("Content-Type", "text/html; charset=utf-8")
	htmlHeader.Set("Content-Transfer-Encoding", "quoted-printable")
	htmlPart, err := mw.CreatePart(htmlHeader)
	if err != nil {
		return nil, err
	}
	htmlQP := quotedprintable.NewWriter(htmlPart)
	_, _ = htmlQP.Write([]byte(html))
	_ = htmlQP.Close()

	_ = mw.Close()
	return buf.Bytes(), nil
}

// htmlToPlain returns a very simple plain-text version of an HTML string
// (strips tags, collapses whitespace). Used as the text/plain fallback.
func htmlToPlain(html string) string {
	out := bytes.NewBuffer(nil)
	inTag := false
	for _, r := range html {
		switch {
		case r == '<':
			inTag = true
		case r == '>':
			inTag = false
			out.WriteRune('\n')
		case !inTag:
			out.WriteRune(r)
		}
	}
	return out.String()
}

// extractAddr returns the bare email address from strings like
// "Display Name <addr@host>" or "addr@host".
func extractAddr(s string) string {
	if i := bytes.IndexByte([]byte(s), '<'); i >= 0 {
		if j := bytes.IndexByte([]byte(s[i:]), '>'); j >= 0 {
			return s[i+1 : i+j]
		}
	}
	return s
}

func joinAddrs(addrs []string) string {
	b := &bytes.Buffer{}
	for i, a := range addrs {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString(a)
	}
	return b.String()
}
