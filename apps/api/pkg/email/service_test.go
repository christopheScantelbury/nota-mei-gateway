package email_test

import (
	"context"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/email"
	"github.com/rs/zerolog"
)

// TestClientEnabled verifies the Enabled() flag for configured vs. unconfigured clients.
func TestClientEnabled(t *testing.T) {
	configured := email.New("smtp.example.com", "587", "user@example.com", "secret", "Test <test@example.com>")
	if !configured.Enabled() {
		t.Error("expected Enabled()=true when host+user+pass are set")
	}

	noop := email.New("", "587", "", "", "Test <test@example.com>")
	if noop.Enabled() {
		t.Error("expected Enabled()=false when host is empty")
	}
}

// TestServiceEnabled propagates client Enabled() to Service.Enabled().
func TestServiceEnabled(t *testing.T) {
	c := email.New("", "", "", "", "")
	svc := email.NewService(c, zerolog.Nop())
	if svc.Enabled() {
		t.Error("expected Service.Enabled()=false when client has no SMTP host")
	}
}

// TestSendDevNoop verifies that dev-noop mode returns nil error without dialing.
func TestSendDevNoop(t *testing.T) {
	c := email.New("", "587", "", "", "noop <noop@example.com>")
	svc := email.NewService(c, zerolog.Nop())

	// Should succeed silently (no SMTP connection attempted).
	if err := svc.SendBoasVindas(context.Background(),
		"mei@example.com", "MEI Ltda", "12345678000195", "sk_live_abc"); err != nil {
		t.Errorf("dev-noop SendBoasVindas returned error: %v", err)
	}

	if err := svc.SendNotaAutorizada(context.Background(),
		"mei@example.com", "MEI Ltda", "NFS-e-123", "ABC12", "R$ 1,00",
		"https://example.com/pdf", "https://example.com/xml"); err != nil {
		t.Errorf("dev-noop SendNotaAutorizada returned error: %v", err)
	}

	if err := svc.SendNotaRejeitada(context.Background(),
		"mei@example.com", "MEI Ltda", "E0001", "Erro de validação"); err != nil {
		t.Errorf("dev-noop SendNotaRejeitada returned error: %v", err)
	}
}
