package recorrencia

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/document"
)

// mapaDaRecorrencia refaz o que Scheduler.process monta: os JSONB `servico` e
// `tomador` gravados na recorrência + a competência do tick.
func mapaDaRecorrencia(t *testing.T, servico, tomador string) map[string]interface{} {
	t.Helper()
	var s, tm map[string]interface{}
	if err := json.Unmarshal([]byte(servico), &s); err != nil {
		t.Fatalf("servico: %v", err)
	}
	if err := json.Unmarshal([]byte(tomador), &tm); err != nil {
		t.Fatalf("tomador: %v", err)
	}
	return map[string]interface{}{"servico": s, "tomador": tm, "competencia": "2026-11"}
}

const tomadorRec = `{"tipo":"PJ","documento":"98765432000100","razao_social":"Tomador LTDA"}`

// A classificação por nota (#296) fica em servico.ibs_cbs justamente porque a
// recorrência só grava `servico` e `tomador`: o mapa gravado tem que levá-la
// até o EmissaoRequest que o RealEmissor valida e entrega ao builder.
func TestMapToEmissaoRequest_CarregaIBSCBSDoServico(t *testing.T) {
	req, err := mapToEmissaoRequest(mapaDaRecorrencia(t, `{
		"codigo_nbs": "01.01.01.10", "discriminacao": "Mensalidade", "valor": 500,
		"ibs_cbs": {
			"cst": "000",
			"codigo_classificacao_tributaria": "000001",
			"codigo_indicador_operacao": "100301",
			"consumo_pessoal": false
		}
	}`, tomadorRec))
	if err != nil {
		t.Fatalf("mapToEmissaoRequest: %v", err)
	}
	got := req.Servico.IBSCBS
	if got == nil {
		t.Fatal("servico.ibs_cbs gravado na recorrência não chegou ao EmissaoRequest")
	}
	if got.CST != "000" || got.CodigoClassificacaoTributaria != "000001" || got.CodigoIndicadorOperacao != "100301" {
		t.Errorf("classificação lida errada: %+v", got)
	}
	if got.ConsumoPessoal == nil || *got.ConsumoPessoal {
		t.Errorf("consumo_pessoal=false deveria chegar como false explícito: %v", got.ConsumoPessoal)
	}
	// Empresa sem padrão: a classificação da recorrência basta.
	if err := document.ValidateIBSCBS(req, &auth.Empresa{}); err != nil {
		t.Errorf("ValidateIBSCBS: %v", err)
	}
}

// Recorrência antiga, gravada sem ibs_cbs: nada muda.
func TestMapToEmissaoRequest_SemIBSCBS(t *testing.T) {
	req, err := mapToEmissaoRequest(mapaDaRecorrencia(t,
		`{"codigo_nbs":"01.01.01.10","discriminacao":"Mensalidade","valor":500}`, tomadorRec))
	if err != nil {
		t.Fatalf("mapToEmissaoRequest: %v", err)
	}
	if req.Servico.IBSCBS != nil {
		t.Errorf("recorrência sem ibs_cbs não deveria ganhar classificação: %+v", req.Servico.IBSCBS)
	}
	if err := document.ValidateIBSCBS(req, &auth.Empresa{}); err != nil {
		t.Errorf("ValidateIBSCBS: %v", err)
	}
}

// Classificação inválida gravada na recorrência é barrada pela validação que o
// RealEmissor roda antes de alocar o número da DPS.
func TestMapToEmissaoRequest_IBSCBSInvalidoBarraAntesDoNumero(t *testing.T) {
	req, err := mapToEmissaoRequest(mapaDaRecorrencia(t,
		`{"codigo_nbs":"01.01.01.10","discriminacao":"Mensalidade","valor":500,"ibs_cbs":{"cst":"0"}}`, tomadorRec))
	if err != nil {
		t.Fatalf("mapToEmissaoRequest: %v", err)
	}
	var ve *document.ErrValidation
	if err := document.ValidateIBSCBS(req, &auth.Empresa{}); !errors.As(err, &ve) {
		t.Fatalf("esperado *document.ErrValidation, veio %T: %v", err, err)
	}
	if ve.Field != "servico.ibs_cbs.cst" {
		t.Errorf("campo = %q", ve.Field)
	}
}
