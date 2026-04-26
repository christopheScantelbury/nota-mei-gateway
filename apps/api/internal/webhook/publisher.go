// Package webhook implements the RabbitMQ publisher for async webhook delivery.
package webhook

import (
	amqp "github.com/rabbitmq/amqp091-go"
)

// Publisher holds an AMQP connection and channel for publishing webhook events.
type Publisher struct {
	conn *amqp.Connection
	ch   *amqp.Channel
}

// NewPublisher dials the given AMQP URL and returns a ready Publisher.
func NewPublisher(amqpURL string) (*Publisher, error) {
	conn, err := amqp.Dial(amqpURL)
	if err != nil {
		return nil, err
	}
	ch, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &Publisher{conn: conn, ch: ch}, nil
}

// Close releases the channel and connection, ignoring close errors
// (resources are being torn down anyway).
func (p *Publisher) Close() {
	_ = p.ch.Close()
	_ = p.conn.Close()
}
