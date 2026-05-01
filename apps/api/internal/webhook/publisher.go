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

	// Declare the queue idempotently so both publisher and consumer agree on it.
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

	return &Publisher{conn: conn, ch: ch}, nil
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
