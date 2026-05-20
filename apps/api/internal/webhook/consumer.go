package webhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/metrics"
	"github.com/google/uuid"
	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/rs/zerolog/log"
)

// NotaUpdater is the subset of the nota repository needed by the consumer.
type NotaUpdater interface {
	MarcarWebhookEntregue(ctx context.Context, notaID uuid.UUID) error
	IncrementWebhookTentativas(ctx context.Context, notaID uuid.UUID) error
}

// Consumer listens to the webhook delivery queue and dispatches HTTP POST calls.
type Consumer struct {
	conn    *amqp.Connection
	ch      *amqp.Channel
	repo    NotaUpdater
	client  *http.Client
	apiBase string // e.g. https://api.emitirnotafacil.com.br
}

// NewConsumer dials AMQP and returns a Consumer ready to Start.
func NewConsumer(amqpURL string, repo NotaUpdater, apiBase string) (*Consumer, error) {
	conn, err := amqp.Dial(amqpURL)
	if err != nil {
		return nil, fmt.Errorf("amqp dial: %w", err)
	}
	ch, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("amqp channel: %w", err)
	}

	if _, err = ch.QueueDeclare(QueueWebhook, true, false, false, false, nil); err != nil {
		_ = ch.Close()
		_ = conn.Close()
		return nil, fmt.Errorf("queue declare: %w", err)
	}

	if err = declareRetryQueues(ch); err != nil {
		_ = ch.Close()
		_ = conn.Close()
		return nil, err
	}

	// Prefetch one message at a time for reliable processing.
	if err = ch.Qos(1, 0, false); err != nil {
		_ = ch.Close()
		_ = conn.Close()
		return nil, fmt.Errorf("qos: %w", err)
	}

	return &Consumer{
		conn:    conn,
		ch:      ch,
		repo:    repo,
		client:  &http.Client{Timeout: 15 * time.Second},
		apiBase: apiBase,
	}, nil
}

// Start begins consuming messages from the queue. It blocks until ctx is cancelled.
func (c *Consumer) Start(ctx context.Context) error {
	msgs, err := c.ch.Consume(
		QueueWebhook,
		"webhook-consumer",
		false, // manual ack
		false, // exclusive
		false, // no-local
		false, // no-wait
		nil,
	)
	if err != nil {
		return fmt.Errorf("consume: %w", err)
	}

	log.Ctx(ctx).Info().Str("queue", QueueWebhook).Msg("webhook consumer started")

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case d, ok := <-msgs:
			if !ok {
				return fmt.Errorf("AMQP channel closed")
			}
			c.handle(ctx, d)
		}
	}
}

// Close releases AMQP resources.
func (c *Consumer) Close() {
	_ = c.ch.Close()
	_ = c.conn.Close()
}

// handle processes one delivery.
func (c *Consumer) handle(ctx context.Context, d amqp.Delivery) {
	var msg DeliveryMessage
	if err := json.Unmarshal(d.Body, &msg); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("invalid webhook message JSON — discarding")
		_ = d.Nack(false, false) // discard unparseable messages
		return
	}

	notaID, err := uuid.Parse(msg.NotaID)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Str("nota_id", msg.NotaID).Msg("invalid nota_id — discarding")
		_ = d.Nack(false, false)
		return
	}

	l := log.Ctx(ctx).With().
		Str("nota_id", msg.NotaID).
		Str("event", string(msg.Event)).
		Str("webhook_url", msg.WebhookURL).
		Logger()

	payload := buildPayload(msg, c.apiBase)
	body, _ := json.Marshal(payload)

	if err := c.deliver(ctx, msg.WebhookURL, msg.WebhookSecret, body); err != nil {
		metrics.WebhookFailedTotal.Inc()
		l.Warn().Err(err).Int("retry_count", msg.RetryCount).Msg("webhook delivery failed")
		_ = c.repo.IncrementWebhookTentativas(ctx, notaID)

		nextQueue, ok := retryQueueFor(msg.RetryCount)
		if !ok {
			metrics.WebhookExhaustedTotal.Inc()
			l.Error().
				Str("nota_id", msg.NotaID).
				Int("attempts", msg.RetryCount+1).
				Msg("webhook: all retries exhausted — message abandoned")
		} else {
			msg.RetryCount++
			if pubErr := c.publishToQueue(ctx, nextQueue, msg); pubErr != nil {
				l.Error().Err(pubErr).Str("queue", nextQueue).Msg("webhook: failed to enqueue retry")
			}
		}
		_ = d.Ack(false) // remove from main queue; retry queue (or exhaustion) handles it
		return
	}

	metrics.WebhookDeliveredTotal.Inc()
	l.Info().Msg("webhook delivered")
	_ = c.repo.MarcarWebhookEntregue(ctx, notaID)
	_ = d.Ack(false)
}

// retryQueueFor returns the retry queue for the given retry count (0-indexed).
// Returns ("", false) when MaxRetries have been exhausted.
func retryQueueFor(retryCount int) (string, bool) {
	switch retryCount {
	case 0:
		return QueueRetry1m, true
	case 1:
		return QueueRetry5m, true
	case 2:
		return QueueRetry30m, true
	default:
		return "", false
	}
}

// publishToQueue serialises msg and publishes it to the named queue.
func (c *Consumer) publishToQueue(ctx context.Context, queue string, msg DeliveryMessage) error {
	body, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return c.ch.PublishWithContext(ctx, "", queue, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Body:         body,
	})
}

// deliver sends the signed HTTP POST to the customer's webhook_url.
func (c *Consumer) deliver(ctx context.Context, url, secret string, body []byte) error {
	sig := signHMAC(secret, body)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Nota-Signature", "sha256="+sig)
	req.Header.Set("User-Agent", "NotaMEIGateway/1.0")

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned HTTP %d", resp.StatusCode)
	}
	return nil
}

// signHMAC returns the HMAC-SHA256 hex signature of body using secret.
func signHMAC(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

// webhookPayload is the JSON sent to the customer's endpoint.
type webhookPayload struct {
	Event          string `json:"event"`
	NotaID         string `json:"nota_id"`
	Status         string `json:"status"`
	NumeroNFSe     string `json:"numero_nfse,omitempty"`
	CodVerificacao string `json:"codigo_verificacao,omitempty"`
	PDFURL         string `json:"pdf_url,omitempty"`
	XMLURL         string `json:"xml_url,omitempty"`
	ErroCodigo     string `json:"erro_codigo,omitempty"`
	ErroDescricao  string `json:"erro_descricao,omitempty"`
	EmitidaEm      string `json:"emitida_em,omitempty"`
}

func buildPayload(msg DeliveryMessage, apiBase string) webhookPayload {
	p := webhookPayload{
		Event:          string(msg.Event),
		NotaID:         msg.NotaID,
		Status:         msg.Status,
		NumeroNFSe:     msg.NumeroNFSe,
		CodVerificacao: msg.CodVerificacao,
		ErroCodigo:     msg.ErroCodigo,
		ErroDescricao:  msg.ErroDescricao,
	}
	if !msg.EmitidaEm.IsZero() {
		p.EmitidaEm = msg.EmitidaEm.UTC().Format(time.RFC3339)
	}
	if apiBase != "" && msg.Status == "AUTORIZADA" {
		p.PDFURL = apiBase + "/v1/nfse/" + msg.NotaID + "/pdf"
		p.XMLURL = apiBase + "/v1/nfse/" + msg.NotaID + "/xml"
	}
	return p
}
