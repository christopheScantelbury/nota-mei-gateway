package webhook

import (
	"context"
	"strings"
	"testing"
)

// deadURL aponta pra uma porta fechada em loopback — o dial falha rápido
// (connection refused), sem depender de rede externa ou de um broker.
const deadURL = "amqp://guest:guest@127.0.0.1:1/"

// TestPublisher_PublishReconnectsGracefully trava o contrato do fix da issue
// #256: quando a conexão está morta, Publish tenta reconectar e retorna erro
// — NUNCA dá panic. O código antigo chamava p.ch.PublishWithContext direto,
// que dava nil-panic quando o canal tinha caído.
func TestPublisher_PublishReconnectsGracefully(t *testing.T) {
	// Publisher com conexão nunca estabelecida (conn == nil), simulando o
	// estado pós-queda. ensure() vai tentar reconectar no deadURL e falhar.
	p := &Publisher{url: deadURL}

	err := func() (err error) {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("Publish deu panic em conexão morta (regressão #256): %v", r)
			}
		}()
		return p.Publish(context.Background(), DeliveryMessage{NotaID: "x"})
	}()

	if err == nil {
		t.Fatal("esperava erro de reconexão com broker inalcançável, veio nil")
	}
	if !strings.Contains(err.Error(), "reconnect") {
		t.Fatalf("esperava erro de reconexão, veio: %v", err)
	}
}

// TestPublisher_PingReconnects garante que o health check tenta reconectar
// (reflete "recuperável") em vez de reportar uma conexão velha morta.
func TestPublisher_PingReconnects(t *testing.T) {
	p := &Publisher{url: deadURL}
	if err := p.Ping(); err == nil {
		t.Fatal("Ping deveria falhar com broker inalcançável")
	}

	// Nil receiver não pode dar panic.
	var nilP *Publisher
	if err := nilP.Ping(); err == nil {
		t.Fatal("Ping em publisher nil deveria retornar erro, não nil")
	}
}

// TestPublisher_CloseSafeOnPartial garante que Close não dá panic quando a
// conexão nunca foi estabelecida (conn/ch nil) — acontece se o worker é
// encerrado durante a espera do RabbitMQ no boot.
func TestPublisher_CloseSafeOnPartial(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("Close deu panic com conn/ch nil: %v", r)
		}
	}()
	(&Publisher{url: deadURL}).Close()

	var nilP *Publisher
	nilP.Close() // nil receiver também é seguro
}
