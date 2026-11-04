package document

import (
	"encoding/json"
	"testing"
)

func TestAutoEmailDestino(t *testing.T) {
	sim, nao := true, false
	r := EmissaoRequest{Tomador: TomadorRequest{Email: " fin@cliente.com "}}
	if r.AutoEmailDestino() != "" {
		t.Fatal("sem pedido explícito não envia (padrão da API)")
	}
	r.EnviarEmailTomador = &nao
	if r.AutoEmailDestino() != "" {
		t.Fatal("false não envia")
	}
	r.EnviarEmailTomador = &sim
	if r.AutoEmailDestino() != "fin@cliente.com" {
		t.Fatalf("usa tomador.email, veio %q", r.AutoEmailDestino())
	}
	r.EmailDestino = "outro@cliente.com"
	if r.AutoEmailDestino() != "outro@cliente.com" {
		t.Fatal("email_destino tem precedência")
	}
}

func TestDadosEmissaoJSON_SemCamposInternos(t *testing.T) {
	r := EmissaoRequest{
		Servico:        ServicoRequest{CodigoNBS: "1.0101", Discriminacao: "Dev", Valor: 10},
		Tomador:        TomadorRequest{Tipo: "PJ", Documento: "12345678000190", Email: "a@b.com", MunicipioIBGE: "3550308"},
		Competencia:    "2026-11",
		IdempotencyKey: "segredo-nao",
		WebhookURL:     "https://x",
	}
	var m map[string]any
	if err := json.Unmarshal(r.DadosEmissaoJSON(), &m); err != nil {
		t.Fatal(err)
	}
	if m["competencia"] != "2026-11" || m["servico"].(map[string]any)["discriminacao"] != "Dev" ||
		m["tomador"].(map[string]any)["municipio_ibge"] != "3550308" {
		t.Fatalf("faltam campos: %v", m)
	}
	for _, k := range []string{"idempotency_key", "webhook_url", "emit", "enviar_email_tomador"} {
		if _, ok := m[k]; ok {
			t.Errorf("não deveria gravar %q", k)
		}
	}
}
