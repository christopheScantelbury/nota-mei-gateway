package handler

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/document"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/nfse"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func validEmissao() document.EmissaoRequest {
	return document.EmissaoRequest{
		Servico: document.ServicoRequest{
			CodigoNBS: "01.01.01.10", Discriminacao: "Dev", Valor: 100, AliquotaISS: 2,
		},
		Tomador:     document.TomadorRequest{Documento: "12345678000190", RazaoSocial: "Cliente"},
		Competencia: "2026-09",
	}
}

func fieldSet(errs []fiber.Map) map[string]bool {
	m := map[string]bool{}
	for _, e := range errs {
		m[e["field"].(string)] = true
	}
	return m
}

func TestValidateEmissao_EnderecoIncompleto(t *testing.T) {
	r := validEmissao()
	r.Tomador.Endereco = &document.EnderecoRequest{Logradouro: "Rua A"}
	got := fieldSet(validateEmissaoRequest(r))
	for _, f := range []string{
		"tomador.endereco.numero", "tomador.endereco.bairro",
		"tomador.endereco.cep", "tomador.endereco.municipio_ibge",
	} {
		if !got[f] {
			t.Errorf("esperava erro em %s, got %v", f, got)
		}
	}
	if got["tomador.endereco.logradouro"] {
		t.Error("logradouro foi informado — não deveria acusar erro")
	}
}

func TestValidateEmissao_EnderecoCompletoComFallback(t *testing.T) {
	r := validEmissao()
	r.Tomador.CEP = "01310-100"
	r.Tomador.MunicipioIBGE = "3550308"
	r.Tomador.Endereco = &document.EnderecoRequest{Logradouro: "Rua A", Numero: "S/N", Bairro: "Centro"}
	if errs := validateEmissaoRequest(r); len(errs) > 0 {
		t.Errorf("endereço completo via fallback não deveria falhar: %v", errs)
	}
}

func TestValidateEmissao_SemEnderecoContinuaValido(t *testing.T) {
	r := validEmissao()
	r.Tomador.MunicipioIBGE = "3550308" // campos soltos seguem aceitos
	if errs := validateEmissaoRequest(r); len(errs) > 0 {
		t.Errorf("sem endereco não deveria falhar: %v", errs)
	}
}

func replayResponse(t *testing.T, n nfse.Nota) (int, map[string]any, string) {
	t.Helper()
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error { return replayNota(c, n) })
	resp, err := app.Test(httptest.NewRequest("GET", "/", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	raw, _ := io.ReadAll(resp.Body)
	var body map[string]any
	_ = json.Unmarshal(raw, &body)
	return resp.StatusCode, body, resp.Header.Get("Idempotent-Replayed")
}

func TestReplayNota_Autorizada200(t *testing.T) {
	chave := "13026032234488964000142000000000000126056414682885"
	status, body, hdr := replayResponse(t, nfse.Nota{ID: uuid.New(), Status: "AUTORIZADA", NumeroNFSe: &chave})
	if status != 200 || hdr != "true" {
		t.Fatalf("status=%d header=%q", status, hdr)
	}
	if body["chave_acesso"] != chave || body["idempotent_replay"] != true || body["nota_id"] == nil {
		t.Errorf("body inesperado: %v", body)
	}
}

func TestReplayNota_Rejeitada422(t *testing.T) {
	cod, desc := "E0310", "CNPJ do tomador inválido"
	status, body, _ := replayResponse(t, nfse.Nota{ID: uuid.New(), Status: "REJEITADA", ErroCodigo: &cod, ErroDescricao: &desc})
	if status != 422 || body["error"] != "RECEITA_REJECTION" || body["erro_codigo"] != cod {
		t.Errorf("status=%d body=%v", status, body)
	}
}
