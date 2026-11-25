package handler

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/document"
	"github.com/gofiber/fiber/v2"
)

// ibscbsPreflight roda antes da cota e do número da DPS (#296). O teste monta
// uma rota que só chama o preflight: 204 = passou, qualquer outra coisa é a
// resposta que o handler devolveria.
func rodarIBSCBSPreflight(t *testing.T, req document.EmissaoRequest, empresa *auth.Empresa) (int, map[string]any, string) {
	t.Helper()
	app := fiber.New()
	app.Post("/", func(c *fiber.Ctx) error {
		if barrado, resp := ibscbsPreflight(c, req, empresa); barrado {
			return resp
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
	resp, err := app.Test(httptest.NewRequest("POST", "/", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	raw, _ := io.ReadAll(resp.Body)
	var body map[string]any
	_ = json.Unmarshal(raw, &body)
	return resp.StatusCode, body, string(raw)
}

func primeiroCampo(t *testing.T, body map[string]any) string {
	t.Helper()
	fields, _ := body["fields"].([]any)
	if len(fields) != 1 {
		t.Fatalf("esperado 1 item em fields, veio %v", body["fields"])
	}
	f, _ := fields[0].(map[string]any)
	campo, _ := f["field"].(string)
	return campo
}

func TestIBSCBSPreflight_SemClassificacaoPassa(t *testing.T) {
	if status, _, raw := rodarIBSCBSPreflight(t, validEmissao(), &auth.Empresa{}); status != fiber.StatusNoContent {
		t.Fatalf("emissão sem IBS/CBS não pode ser barrada: %d %s", status, raw)
	}
}

func TestIBSCBSPreflight_ClassificacaoValidaPassa(t *testing.T) {
	req := validEmissao()
	req.Servico.IBSCBS = &document.IBSCBSRequest{
		CST: "000", CodigoClassificacaoTributaria: "000001", CodigoIndicadorOperacao: "100301",
	}
	if status, _, raw := rodarIBSCBSPreflight(t, req, &auth.Empresa{}); status != fiber.StatusNoContent {
		t.Fatalf("classificação válida na nota foi barrada: %d %s", status, raw)
	}
}

// Erro no corpo → 422 VALIDATION_ERROR apontando o campo do request.
func TestIBSCBSPreflight_ErroDoRequest(t *testing.T) {
	req := validEmissao()
	req.Servico.IBSCBS = &document.IBSCBSRequest{CST: "0"}
	status, body, raw := rodarIBSCBSPreflight(t, req, &auth.Empresa{})
	if status != fiber.StatusUnprocessableEntity || body["error"] != "VALIDATION_ERROR" {
		t.Fatalf("esperado 422 VALIDATION_ERROR, veio %d %s", status, raw)
	}
	if campo := primeiroCampo(t, body); campo != "servico.ibs_cbs.cst" {
		t.Errorf("campo = %q, esperado servico.ibs_cbs.cst", campo)
	}
}

// Padrão da empresa incompleto → 422 com código próprio, mensagem de cadastro
// e nenhum nome de coluna do banco na resposta.
func TestIBSCBSPreflight_ErroDoCadastroDaEmpresa(t *testing.T) {
	empresa := &auth.Empresa{IBSCBSCST: "000"} // sem cClassTrib e cIndOp
	status, body, raw := rodarIBSCBSPreflight(t, validEmissao(), empresa)
	if status != fiber.StatusUnprocessableEntity || body["error"] != "IBS_CBS_CONFIGURACAO_INVALIDA" {
		t.Fatalf("esperado 422 IBS_CBS_CONFIGURACAO_INVALIDA, veio %d %s", status, raw)
	}
	if campo := primeiroCampo(t, body); campo != "empresa.ibs_cbs" {
		t.Errorf("campo = %q, esperado empresa.ibs_cbs", campo)
	}
	msg, _ := body["message"].(string)
	if !strings.Contains(msg, "cadastrada na empresa") {
		t.Errorf("mensagem deveria apontar o cadastro da empresa: %q", msg)
	}
	for _, vazamento := range []string{"ibscbs_", "_padrao"} {
		if strings.Contains(raw, vazamento) {
			t.Errorf("resposta expõe nome de coluna do banco (%q): %s", vazamento, raw)
		}
	}
}
