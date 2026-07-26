// Package webhook implements RabbitMQ-based async webhook delivery.
package webhook

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
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
//
// É auto-recuperável: guarda a URL e reconecta sozinho quando a conexão cai
// (ex: RabbitMQ redeploya no Railway). Antes disto, uma queda deixava o
// publisher morto até o worker reiniciar — e o worker crashava junto. Ver
// issue #256 e o incidente de 2026-07-26.
type Publisher struct {
	url  string
	mu   sync.Mutex
	conn *amqp.Connection
	ch   *amqp.Channel
}

// NewPublisher dials the given AMQP URL, declares the durable queue and returns a ready Publisher.
func NewPublisher(amqpURL string) (*Publisher, error) {
	p := &Publisher{url: amqpURL}
	if err := p.connect(); err != nil {
		return nil, err
	}
	return p, nil
}

// connect (re)dials e redeclara as filas. Assume o lock já tomado quando
// chamado de ensure(); NewPublisher chama antes de expor o ponteiro.
func (p *Publisher) connect() error {
	conn, err := amqp.Dial(p.url)
	if err != nil {
		return fmt.Errorf("amqp dial: %w", err)
	}
	ch, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		return fmt.Errorf("amqp channel: %w", err)
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
		return fmt.Errorf("queue declare: %w", err)
	}

	if err = declareRetryQueues(ch); err != nil {
		_ = ch.Close()
		_ = conn.Close()
		return err
	}

	p.conn, p.ch = conn, ch
	return nil
}

// ensure garante uma conexão viva, reconectando se a atual caiu. Idempotente
// e thread-safe (poller e requeuer publicam de goroutines diferentes).
func (p *Publisher) ensure() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.conn != nil && !p.conn.IsClosed() {
		return nil
	}
	return p.connect()
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
// Returns an error if the publisher is nil (RabbitMQ unavailable).
func (p *Publisher) Publish(ctx context.Context, msg DeliveryMessage) error {
	if p == nil {
		return fmt.Errorf("webhook publisher not available (RabbitMQ not connected)")
	}
	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal webhook message: %w", err)
	}

	// Reconecta se a conexão caiu desde a última publicação. Se o RabbitMQ
	// ainda estiver fora, retorna erro — o requeuer varre o banco depois e
	// re-publica, então nenhuma nota é perdida.
	if err := p.ensure(); err != nil {
		return fmt.Errorf("webhook publisher reconnect: %w", err)
	}

	p.mu.Lock()
	ch := p.ch
	p.mu.Unlock()

	return ch.PublishWithContext(ctx,
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

// Ping returns nil if a RabbitMQ connection can be established. Tenta
// reconectar — assim o health check reflete "recuperável", não uma conexão
// velha morta que já teria se recuperado na próxima publicação.
func (p *Publisher) Ping() error {
	if p == nil {
		return fmt.Errorf("rabbitmq publisher not initialised")
	}
	if err := p.ensure(); err != nil {
		return fmt.Errorf("rabbitmq unreachable: %w", err)
	}
	return nil
}

// Close releases the channel and connection. Safe to call on nil receiver.
func (p *Publisher) Close() {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.ch != nil {
		_ = p.ch.Close()
	}
	if p.conn != nil {
		_ = p.conn.Close()
	}
}
