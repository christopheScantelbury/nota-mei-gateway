package webhook

import (
	"testing"
	"time"
)

// ─── signHMAC ──────────────────────────────────────────────────────────────

func TestSignHMAC_Deterministic(t *testing.T) {
	body := []byte(`{"nota_id":"123","event":"nfse.autorizada"}`)
	sig1 := signHMAC("supersecret", body)
	sig2 := signHMAC("supersecret", body)
	if sig1 != sig2 {
		t.Error("signHMAC is not deterministic")
	}
	if len(sig1) != 64 {
		t.Errorf("signature length = %d, want 64 hex chars", len(sig1))
	}
}

func TestSignHMAC_DifferentSecrets(t *testing.T) {
	body := []byte(`{"nota_id":"abc"}`)
	if signHMAC("secret1", body) == signHMAC("secret2", body) {
		t.Error("different secrets produced the same signature")
	}
}

func TestSignHMAC_DifferentBodies(t *testing.T) {
	if signHMAC("s", []byte("body1")) == signHMAC("s", []byte("body2")) {
		t.Error("different bodies produced the same signature")
	}
}

// ─── buildPayload ──────────────────────────────────────────────────────────

func TestBuildPayload_Autorizada(t *testing.T) {
	ts := time.Date(2026, 4, 26, 14, 0, 0, 0, time.UTC)
	msg := DeliveryMessage{
		NotaID:         "nota-uuid",
		Event:          EventAutorizada,
		Status:         "AUTORIZADA",
		NumeroNFSe:     "000123",
		CodVerificacao: "ABC12",
		WebhookURL:     "https://example.com/hook",
		EmitidaEm:      ts,
	}

	p := buildPayload(msg, "https://api.notameigateway.com.br")

	if p.Event != "nfse.autorizada" {
		t.Errorf("Event = %q, want nfse.autorizada", p.Event)
	}
	if p.NumeroNFSe != "000123" {
		t.Errorf("NumeroNFSe = %q, want 000123", p.NumeroNFSe)
	}
	if p.PDFURL != "https://api.notameigateway.com.br/v1/nfse/nota-uuid/pdf" {
		t.Errorf("PDFURL = %q", p.PDFURL)
	}
	if p.XMLURL != "https://api.notameigateway.com.br/v1/nfse/nota-uuid/xml" {
		t.Errorf("XMLURL = %q", p.XMLURL)
	}
	if p.EmitidaEm != "2026-04-26T14:00:00Z" {
		t.Errorf("EmitidaEm = %q", p.EmitidaEm)
	}
}

func TestBuildPayload_Rejeitada(t *testing.T) {
	msg := DeliveryMessage{
		NotaID:        "nota-uuid",
		Event:         EventRejeitada,
		Status:        "REJEITADA",
		ErroCodigo:    "E10",
		ErroDescricao: "CNPJ inválido",
		WebhookURL:    "https://example.com/hook",
	}

	p := buildPayload(msg, "https://api.notameigateway.com.br")

	if p.Event != "nfse.rejeitada" {
		t.Errorf("Event = %q, want nfse.rejeitada", p.Event)
	}
	// PDF/XML URLs must NOT be set for non-AUTORIZADA status.
	if p.PDFURL != "" {
		t.Errorf("PDFURL should be empty for REJEITADA, got %q", p.PDFURL)
	}
	if p.ErroCodigo != "E10" {
		t.Errorf("ErroCodigo = %q, want E10", p.ErroCodigo)
	}
}

func TestBuildPayload_NoAPIBase(t *testing.T) {
	msg := DeliveryMessage{
		NotaID: "nota-uuid",
		Event:  EventAutorizada,
		Status: "AUTORIZADA",
	}
	p := buildPayload(msg, "")
	if p.PDFURL != "" {
		t.Errorf("PDFURL should be empty when apiBase is empty, got %q", p.PDFURL)
	}
}

// ─── EventType constants ───────────────────────────────────────────────────

func TestEventTypeValues(t *testing.T) {
	if EventAutorizada != "nfse.autorizada" {
		t.Errorf("EventAutorizada = %q, want nfse.autorizada", EventAutorizada)
	}
	if EventRejeitada != "nfse.rejeitada" {
		t.Errorf("EventRejeitada = %q, want nfse.rejeitada", EventRejeitada)
	}
	if EventCancelada != "nfse.cancelada" {
		t.Errorf("EventCancelada = %q, want nfse.cancelada", EventCancelada)
	}
}
