// Package email envia os e-mails transacionais do Nota MEI Gateway.
//
// Dois provedores, tentados em ordem (fallback):
//
//  1. Brevo API HTTP (api.brevo.com/v3/smtp/email, porta 443) — chave xkeysib-.
//     Pode falhar quando a conta Brevo tem bloqueio de IP para chaves de API
//     (o Railway não tem IP fixo) ou a chave é revogada.
//  2. Relay HTTPS no Vercel (EMAIL_RELAY_URL + EMAIL_RELAY_SECRET), que envia
//     pelo SMTP do Brevo. Existe porque o Railway bloqueia SMTP de saída
//     (587 e 2525 dão timeout — verificado em 2026-11-04).
//  3. Brevo SMTP direto (smtp-relay.brevo.com) — chave xsmtpsib- e login SMTP.
//     Porta configurada e depois 2525. Útil fora do Railway (dev, outro host).
//
// Variáveis de ambiente:
//
//	BREVO_API_KEY  chave da API HTTP (xkeysib-…)
//	SMTP_HOST      servidor SMTP (ex.: smtp-relay.brevo.com)
//	SMTP_PORT      porta SMTP (padrão 587; 2525 é tentada em seguida)
//	SMTP_USER      login SMTP (ex.: aa973b001@smtp-brevo.com)
//	SMTP_PASS      chave SMTP (xsmtpsib-…). Compat: se for uma xkeysib- e
//	               BREVO_API_KEY estiver vazia, é usada como chave da API.
//	EMAIL_RELAY_URL     ex.: https://www.emitirnotafacil.com.br/api/interno/email
//	EMAIL_RELAY_SECRET  segredo compartilhado com o Vercel
//	EMAIL_FROM     remetente, ex.: "NotaFácil <noreply@emitirnotafacil.com.br>"
//
// Sem nenhum provedor configurado o cliente fica em dev-noop: só registra no log.
// A entrega garantida (fila + reenvio) fica no Outbox, não aqui.
package email

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

const brevoAPIURL = "https://api.brevo.com/v3/smtp/email"

// Client envia um e-mail pelo primeiro provedor que funcionar.
type Client struct {
	apiKey   string // Brevo API HTTP
	smtpHost string
	smtpPort string
	smtpUser string
	smtpPass string
	from     string
	relayURL string
	relayKey string
	hc       *http.Client
	apiURL   string // sobrescrito em testes
	dial     func(ctx context.Context, addr string) (net.Conn, error)
}

// New cria um Client a partir das variáveis SMTP_* (compatível com a
// assinatura antiga). Use WithAPIKey para a API HTTP do Brevo.
func New(host, port, user, pass, from string) *Client {
	if port == "" {
		port = "587"
	}
	c := &Client{
		smtpHost: host,
		smtpPort: port,
		smtpUser: user,
		smtpPass: pass,
		from:     from,
		hc:       &http.Client{Timeout: 15 * time.Second},
		apiURL:   brevoAPIURL,
	}
	c.dial = func(ctx context.Context, addr string) (net.Conn, error) {
		d := net.Dialer{Timeout: 5 * time.Second}
		return d.DialContext(ctx, "tcp", addr)
	}
	// Compat: antes SMTP_PASS guardava a chave da API HTTP.
	if strings.HasPrefix(pass, "xkeysib-") {
		c.apiKey = pass
		c.smtpPass = ""
	}
	return c
}

// NewFromEnv mantém a assinatura antiga (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM).
func NewFromEnv(host, port, user, pass, from string) *Client {
	return New(host, port, user, pass, from)
}

// WithAPIKey configura a chave da API HTTP do Brevo (BREVO_API_KEY).
func (c *Client) WithAPIKey(key string) *Client {
	if key = strings.TrimSpace(key); key != "" {
		c.apiKey = key
	}
	return c
}

// WithRelay configura o relay HTTPS (EMAIL_RELAY_URL / EMAIL_RELAY_SECRET).
func (c *Client) WithRelay(url, secret string) *Client {
	c.relayURL, c.relayKey = strings.TrimSpace(url), strings.TrimSpace(secret)
	return c
}

func (c *Client) relayEnabled() bool { return c.relayURL != "" && c.relayKey != "" }
func (c *Client) apiEnabled() bool   { return c.apiKey != "" }
func (c *Client) smtpEnabled() bool  { return c.smtpHost != "" && c.smtpUser != "" && c.smtpPass != "" }

// Enabled informa se algum provedor está configurado.
func (c *Client) Enabled() bool { return c.apiEnabled() || c.relayEnabled() || c.smtpEnabled() }

// SendRequest holds the data for one outbound email.
type SendRequest struct {
	To      []string
	Subject string
	HTML    string
}

// Resultado descreve uma entrega bem-sucedida.
type Resultado struct {
	Provedor  string // "brevo_api" | "brevo_smtp" | "dev-noop"
	MessageID string
}

// Send entrega pelo primeiro provedor que funcionar. Mantido por compat;
// prefira Entregar, que informa o provedor usado.
func (c *Client) Send(ctx context.Context, req SendRequest) (string, error) {
	r, err := c.Entregar(ctx, req)
	if err != nil {
		return "", err
	}
	return r.MessageID, nil
}

// Entregar tenta a API HTTP e, se falhar, o SMTP. O erro devolvido junta as
// falhas de todos os provedores tentados.
func (c *Client) Entregar(ctx context.Context, req SendRequest) (Resultado, error) {
	if !c.Enabled() {
		log.Ctx(ctx).Info().Str("subject", req.Subject).
			Msg("email: dev-noop mode — não configurado, email não enviado")
		return Resultado{Provedor: "dev-noop", MessageID: "dev-noop"}, nil
	}
	var falhas []error
	if c.apiEnabled() {
		id, err := c.sendAPI(ctx, req)
		if err == nil {
			return Resultado{Provedor: "brevo_api", MessageID: id}, nil
		}
		falhas = append(falhas, fmt.Errorf("brevo_api: %w", err))
	}
	if c.relayEnabled() {
		id, err := c.sendRelay(ctx, req)
		if err == nil {
			if len(falhas) > 0 {
				log.Ctx(ctx).Warn().Err(errors.Join(falhas...)).Msg("email: API do Brevo falhou, entregue pelo relay (fallback)")
			}
			return Resultado{Provedor: "relay_smtp", MessageID: id}, nil
		}
		falhas = append(falhas, fmt.Errorf("relay_smtp: %w", err))
	}
	if c.smtpEnabled() {
		id, err := c.sendSMTP(ctx, req)
		if err == nil {
			if len(falhas) > 0 {
				log.Ctx(ctx).Warn().Err(errors.Join(falhas...)).Msg("email: API do Brevo falhou, entregue pelo SMTP (fallback)")
			}
			return Resultado{Provedor: "brevo_smtp", MessageID: id}, nil
		}
		falhas = append(falhas, fmt.Errorf("brevo_smtp: %w", err))
	}
	return Resultado{}, errors.Join(falhas...)
}

// ── Brevo API HTTP ──────────────────────────────────────────────────────────

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

func (c *Client) sendAPI(ctx context.Context, req SendRequest) (string, error) {
	senderName, senderEmail := parseFromAddr(c.from)
	toAddrs := make([]brevoAddr, 0, len(req.To))
	for _, addr := range req.To {
		name, em := parseFromAddr(addr)
		toAddrs = append(toAddrs, brevoAddr{Name: name, Email: em})
	}
	body, err := json.Marshal(brevoRequest{
		Sender:      brevoAddr{Name: senderName, Email: senderEmail},
		To:          toAddrs,
		Subject:     req.Subject,
		HTMLContent: req.HTML,
	})
	if err != nil {
		return "", fmt.Errorf("marshal: %w", err)
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("api-key", c.apiKey)

	resp, err := c.hc.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := string(respBody)
		if len(msg) > 300 {
			msg = msg[:300]
		}
		return "", fmt.Errorf("HTTP %d: %s", resp.StatusCode, msg)
	}
	var r struct {
		MessageID string `json:"messageId"`
	}
	_ = json.Unmarshal(respBody, &r)
	if r.MessageID == "" {
		r.MessageID = "ok"
	}
	return r.MessageID, nil
}

// ── Relay HTTPS (Vercel → SMTP do Brevo) ─────────────────────────────────────

func (c *Client) sendRelay(ctx context.Context, req SendRequest) (string, error) {
	if len(req.To) != 1 {
		return "", errors.New("relay aceita um destinatário por vez")
	}
	_, to := parseFromAddr(req.To[0])
	body, err := json.Marshal(map[string]string{"to": to, "subject": req.Subject, "html": req.HTML})
	if err != nil {
		return "", err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.relayURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.relayKey)
	resp, err := c.hc.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode != http.StatusOK {
		msg := string(respBody)
		if len(msg) > 300 {
			msg = msg[:300]
		}
		return "", fmt.Errorf("HTTP %d: %s", resp.StatusCode, msg)
	}
	var r struct {
		MessageID string `json:"message_id"`
	}
	_ = json.Unmarshal(respBody, &r)
	if r.MessageID == "" {
		r.MessageID = "ok"
	}
	return r.MessageID, nil
}

// ── Brevo SMTP direto ────────────────────────────────────────────────────────

func (c *Client) sendSMTP(ctx context.Context, req SendRequest) (string, error) {
	portas := []string{c.smtpPort}
	if c.smtpPort != "2525" {
		portas = append(portas, "2525")
	}
	msg, msgID := c.montarMIME(req)
	var falhas []error
	for _, porta := range portas {
		err := c.smtpEnviar(ctx, net.JoinHostPort(c.smtpHost, porta), req.To, msg)
		if err == nil {
			return msgID, nil
		}
		falhas = append(falhas, fmt.Errorf("porta %s: %w", porta, err))
	}
	return "", errors.Join(falhas...)
}

func (c *Client) smtpEnviar(ctx context.Context, addr string, to []string, msg []byte) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	conn, err := c.dial(ctx, addr)
	if err != nil {
		return err
	}
	if dl, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(dl)
	}
	host, _, _ := net.SplitHostPort(addr)
	cl, err := smtp.NewClient(conn, host)
	if err != nil {
		_ = conn.Close()
		return err
	}
	defer cl.Close()
	if ok, _ := cl.Extension("STARTTLS"); !ok {
		return errors.New("servidor sem STARTTLS — envio recusado")
	}
	if err := cl.StartTLS(&tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}); err != nil {
		return fmt.Errorf("starttls: %w", err)
	}
	if err := cl.Auth(smtp.PlainAuth("", c.smtpUser, c.smtpPass, host)); err != nil {
		return fmt.Errorf("auth: %w", err)
	}
	_, fromEmail := parseFromAddr(c.from)
	if err := cl.Mail(fromEmail); err != nil {
		return fmt.Errorf("mail from: %w", err)
	}
	for _, addr := range to {
		_, em := parseFromAddr(addr)
		if err := cl.Rcpt(em); err != nil {
			return fmt.Errorf("rcpt: %w", err)
		}
	}
	w, err := cl.Data()
	if err != nil {
		return fmt.Errorf("data: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("data close: %w", err)
	}
	return cl.Quit()
}

func (c *Client) montarMIME(req SendRequest) ([]byte, string) {
	fromName, fromEmail := parseFromAddr(c.from)
	dominio := "emitirnotafacil.com.br"
	if i := strings.LastIndex(fromEmail, "@"); i >= 0 {
		dominio = fromEmail[i+1:]
	}
	msgID := fmt.Sprintf("<%d.nmg@%s>", time.Now().UnixNano(), dominio)
	from := fromEmail
	if fromName != "" {
		from = fmt.Sprintf("%s <%s>", mime.QEncoding.Encode("utf-8", fromName), fromEmail)
	}
	var b bytes.Buffer
	fmt.Fprintf(&b, "From: %s\r\n", from)
	fmt.Fprintf(&b, "To: %s\r\n", strings.Join(req.To, ", "))
	fmt.Fprintf(&b, "Subject: %s\r\n", mime.QEncoding.Encode("utf-8", req.Subject))
	fmt.Fprintf(&b, "Message-ID: %s\r\n", msgID)
	fmt.Fprintf(&b, "Date: %s\r\n", time.Now().Format(time.RFC1123Z))
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	b.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
	b.WriteString(strings.ReplaceAll(strings.ReplaceAll(req.HTML, "\r\n", "\n"), "\n", "\r\n"))
	return b.Bytes(), msgID
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
