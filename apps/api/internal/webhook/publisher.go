// Package webhook implements RabbitMQ-based async webhook delivery.
package webhook

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

const (
	// QueueWebhook is the durable queue name for webhook delivery jobs.
	QueueWebhook = "nfse.webhook.delivery"

	// QueueRetry1m holds failed messages for 1 minute before dead-lettering back to QueueWebhook.
	QueueRetry1m = "nfse.webhook.retry.1m"
	// QueueRetry5m holds failed messages for 5 minutes before dead-lettering back to QueueWebhook.
	QueueRetry5m = "nfse.webhook.retry.5m"
	// QueueRetry30m holds failed messages for 30 minutes before dead-lettering back to QueueWebhook.
	QueueRetry30m = "nfse.webhook.retry.30m"

	// MaxRetries is the number of delayed retries after the initial attempt.
	MaxRetries = 3
)

// EventType represents the type of NFS-e lifecycle event.
type EventType string

// EventAutorizada, EventRejeitada and EventCancelada are the NFS-e lifecycle
// event types delivered to customer webhook endpoints.
const (
	EventAutorizada EventType = "nfse.autorizada"
	EventRejeitada  EventType = "nfse.rejeitada"
	EventCancelada  EventType = "nfse.cancelada"
)

// DeliveryMessage is the message body persisted to RabbitMQ.
type DeliveryMessage struct {
	NotaID         string    `json:"nota_id"`
	Event          EventType `json:"event"`
	Status         string    `json:"status"`
	NumeroNFSe     string    `json:"numero_nfse,omitempty"`
	CodVerificacao string    `json:"codigo_verificacao,omitempty"`
	WebhookURL     string    `json:"webhook_url"`
	WebhookSecret  string    `json:"webhook_secret"` // HMAC key, never logged
	EmitidaEm      time.Time `json:"emitida_em,omitempty"`
	PDFURL         string    `json:"pdf_url,omitempty"`
	XMLURL         string    `json:"xml_url,omitempty"`
	ErroCodigo     string    `json:"erro_codigo,omitempty"`
	ErroDescricao  string    `json:"erro_descricao,omitempty"`
	RetryCount     int       `json:"retry_count,omitempty"` // number of retries already attempted
}

// Publisher holds an AMQP connection and channel for publishing webhook events.
type Publisher struct {
	conn *amqp.Connection
	ch   *amqp.Channel
}

// NewPublisher dials the given AMQP URL, declares the durable queue and returns a ready Publisher.
func NewPublisher(amqpURL string) (*Publisher, error) {
	conn, err := amqp.Dial(amqpURL)
	if err != nil {
		return nil, fmt.Errorf("amqp dial: %w", err)
	}
	ch, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("amqp channel: %w", err)
	}

	// Declare the main queue and retry queues idempotently.
	if _, err = ch.QueueDeclare(
		QueueWebhook,
		true,  // durable
		false, // auto-delete
		false, // exclusive
		false, // no-wait
		nil,
	); err != nil {
		_ = ch.Close()
		_ = conn.Close()
		return nil, fmt.Errorf("queue declare: %w", err)
	}

	if err = declareRetryQueues(ch); err != nil {
		_ = ch.Close()
		_ = conn.Close()
		return nil, err
	}

	return &Publisher{conn: conn, ch: ch}, nil
}

// declareRetryQueues declares the 3 TTL-based retry queues.
// Each queue uses a dead-letter exchange so expired messages route back to
// QueueWebhook after their respective TTL (1min, 5min, 30min).
func declareRetryQueues(ch *amqp.Channel) error {
	retries := []struct {
		name  string
		ttlMs int64
	}{
		{QueueRetry1m, 60_000},
		{QueueRetry5m, 300_000},
		{QueueRetry30m, 1_800_000},
	}
	for _, q := range retries {
		args := amqp.Table{
			"x-message-ttl":             q.ttlMs,
			"x-dead-letter-exchange":    "",           // default exchange
			"x-dead-letter-routing-key": QueueWebhook, // route back to main queue
		}
		if _, err := ch.QueueDeclare(q.name, true, false, false, false, args); err != nil {
			return fmt.Errorf("declare retry queue %s: %w", q.name, err)
		}
	}
	return nil
}

// Publish serialises msg as JSON and enqueues it for delivery.
func (p *Publisher) Publish(ctx context.Context, msg DeliveryMessage) error {
	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal webhook message: %w", err)
	}

	return p.ch.PublishWithContext(ctx,
		"",           // default exchange
		QueueWebhook, // routing key = queue name
		false,        // mandatory
		false,        // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         body,
		},
	)
}

// Close releases the channel and connection.
func (p *Publisher) Close() {
	_ = p.ch.Close()
	_ = p.conn.Close()
}
