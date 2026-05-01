package nfse

import (
	"testing"
)

// ─── parseEnvioResponse ────────────────────────────────────────────────────

func TestParseEnvioResponse_AsyncBatch(t *testing.T) {
	body := []byte(`<?xml version="1.0" encoding="UTF-8"?>
<RececionarLoteRpsResposta>
  <Protocolo>202604011234567</Protocolo>
</RececionarLoteRpsResposta>`)

	r, err := parseEnvioResponse(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if r.Protocolo != "202604011234567" {
		t.Errorf("Protocolo = %q, want %q", r.Protocolo, "202604011234567")
	}
	if r.NumeroNFSe != "" {
		t.Errorf("NumeroNFSe should be empty for async batch response")
	}
}

func TestParseEnvioResponse_SyncAuthorized(t *testing.T) {
	body := []byte(`<?xml version="1.0" encoding="UTF-8"?>
<GerarNfseResposta>
  <ListaNfse>
    <CompNfse>
      <Nfse>
        <InfNfse>
          <Numero>000123</Numero>
          <CodigoVerificacao>ABC12345</CodigoVerificacao>
        </InfNfse>
      </Nfse>
    </CompNfse>
  </ListaNfse>
</GerarNfseResposta>`)

	r, err := parseEnvioResponse(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if r.NumeroNFSe != "000123" {
		t.Errorf("NumeroNFSe = %q, want %q", r.NumeroNFSe, "000123")
	}
	if r.CodVerificacao != "ABC12345" {
		t.Errorf("CodVerificacao = %q, want %q", r.CodVerificacao, "ABC12345")
	}
	if len(r.Erros) != 0 {
		t.Errorf("expected no errors, got %v", r.Erros)
	}
}

func TestParseEnvioResponse_SyncRejected(t *testing.T) {
	body := []byte(`<?xml version="1.0" encoding="UTF-8"?>
<GerarNfseResposta>
  <ListaMensagemRetorno>
    <MensagemRetorno>
      <Codigo>E10</Codigo>
      <Descricao>CNPJ inválido</Descricao>
    </MensagemRetorno>
  </ListaMensagemRetorno>
</GerarNfseResposta>`)

	r, err := parseEnvioResponse(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(r.Erros) != 1 {
		t.Fatalf("expected 1 error, got %d", len(r.Erros))
	}
	if r.Erros[0].Codigo != "E10" {
		t.Errorf("Codigo = %q, want %q", r.Erros[0].Codigo, "E10")
	}
	if r.Erros[0].Descricao != "CNPJ inválido" {
		t.Errorf("Descricao = %q, want %q", r.Erros[0].Descricao, "CNPJ inválido")
	}
}

func TestParseEnvioResponse_InvalidXML(t *testing.T) {
	_, err := parseEnvioResponse([]byte(`not xml at all`))
	if err == nil {
		t.Error("expected error for invalid XML, got nil")
	}
}

// ─── parseConsultaResponse ─────────────────────────────────────────────────

func TestParseConsultaResponse_Autorizada(t *testing.T) {
	body := []byte(`<?xml version="1.0" encoding="UTF-8"?>
<ConsultarLoteRpsResposta>
  <Protocolo>202604011234567</Protocolo>
  <Situacao>4</Situacao>
  <ListaNfse>
    <CompNfse>
      <Nfse>
        <InfNfse>
          <Numero>000456</Numero>
          <CodigoVerificacao>XYZ99</CodigoVerificacao>
        </InfNfse>
      </Nfse>
    </CompNfse>
  </ListaNfse>
</ConsultarLoteRpsResposta>`)

	r, err := parseConsultaResponse(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if r.Status != "AUTORIZADA" {
		t.Errorf("Status = %q, want AUTORIZADA", r.Status)
	}
	if r.NumeroNFSe != "000456" {
		t.Errorf("NumeroNFSe = %q, want 000456", r.NumeroNFSe)
	}
}

func TestParseConsultaResponse_Rejeitada(t *testing.T) {
	body := []byte(`<?xml version="1.0" encoding="UTF-8"?>
<ConsultarLoteRpsResposta>
  <Situacao>3</Situacao>
  <ListaMensagemRetorno>
    <MensagemRetorno>
      <Codigo>E55</Codigo>
      <Descricao>Alíquota inválida</Descricao>
    </MensagemRetorno>
  </ListaMensagemRetorno>
</ConsultarLoteRpsResposta>`)

	r, err := parseConsultaResponse(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if r.Status != "REJEITADA" {
		t.Errorf("Status = %q, want REJEITADA", r.Status)
	}
	if len(r.Erros) != 1 || r.Erros[0].Codigo != "E55" {
		t.Errorf("unexpected Erros: %v", r.Erros)
	}
}

func TestParseConsultaResponse_Processando(t *testing.T) {
	body := []byte(`<?xml version="1.0" encoding="UTF-8"?>
<ConsultarLoteRpsResposta>
  <Situacao>2</Situacao>
</ConsultarLoteRpsResposta>`)

	r, err := parseConsultaResponse(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if r.Status != "PROCESSANDO" {
		t.Errorf("Status = %q, want PROCESSANDO", r.Status)
	}
}

// ─── parseCancelamentoResponse ─────────────────────────────────────────────

func TestParseCancelamentoResponse_OK(t *testing.T) {
	body := []byte(`<?xml version="1.0" encoding="UTF-8"?>
<CancelarNfseResposta>
  <Sucesso>true</Sucesso>
</CancelarNfseResposta>`)

	r, err := parseCancelamentoResponse(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !r.OK {
		t.Error("expected OK=true")
	}
	if len(r.Erros) != 0 {
		t.Errorf("expected no errors, got %v", r.Erros)
	}
}

func TestParseCancelamentoResponse_Failed(t *testing.T) {
	body := []byte(`<?xml version="1.0" encoding="UTF-8"?>
<CancelarNfseResposta>
  <Sucesso>false</Sucesso>
  <ListaMensagemRetorno>
    <MensagemRetorno>
      <Codigo>E77</Codigo>
      <Descricao>Nota já cancelada</Descricao>
    </MensagemRetorno>
  </ListaMensagemRetorno>
</CancelarNfseResposta>`)

	r, err := parseCancelamentoResponse(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if r.OK {
		t.Error("expected OK=false")
	}
	if len(r.Erros) != 1 || r.Erros[0].Codigo != "E77" {
		t.Errorf("unexpected Erros: %v", r.Erros)
	}
}
