package document

import (
	"strings"
	"testing"
)

// Sem endereco: cMun/CEP soltos NÃO podem virar <end> (XSD exige xLgr/nro/xBairro).
func TestDPSBuilder_Tomador_SemEndereco_OmiteEnd(t *testing.T) {
	result, err := NewDPSBuilder().Build(baseRequest(), empresaSN(), 1)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	if strings.Contains(string(result.XML), "<end>") {
		t.Error("<end> não deve ser emitido sem endereco completo")
	}
}

func TestDPSBuilder_Tomador_ComEndereco_EmiteEndNac(t *testing.T) {
	req := baseRequest()
	req.Tomador.Endereco = &EnderecoRequest{
		Logradouro:  "Av. Paulista",
		Numero:      "1000",
		Complemento: "Conj 42",
		Bairro:      "Bela Vista",
		// CEP e município vêm do fallback tomador.cep / tomador.municipio_ibge.
	}
	result, err := NewDPSBuilder().Build(req, empresaSN(), 1)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	x := string(result.XML)
	toma := x[strings.Index(x, "<toma>"):strings.Index(x, "</toma>")]
	for _, want := range []string{
		"<end>", "<endNac>", "<cMun>3550308</cMun>", "<CEP>01310100</CEP>",
		"<xLgr>Av. Paulista</xLgr>", "<nro>1000</nro>", "<xCpl>Conj 42</xCpl>", "<xBairro>Bela Vista</xBairro>",
	} {
		if !strings.Contains(toma, want) {
			t.Errorf("<toma> deveria conter %s\n%s", want, toma)
		}
	}
	// Ordem do XSD (TCInfoPessoa): xNome → end → email.
	if !(strings.Index(toma, "<xNome>") < strings.Index(toma, "<end>") &&
		strings.Index(toma, "<end>") < strings.Index(toma, "<email>")) {
		t.Errorf("ordem xNome/end/email fora do XSD:\n%s", toma)
	}
}

func TestResolvedEndereco_PrefereCamposDoEnderecoENormaliza(t *testing.T) {
	tm := TomadorRequest{
		CEP:           "99999999",
		MunicipioIBGE: "1111111",
		Endereco: &EnderecoRequest{
			Logradouro: "  Rua A ", Numero: " 10 ", Bairro: " Centro ",
			CEP: "01310-100", MunicipioIBGE: "3550308",
		},
	}
	e := tm.ResolvedEndereco()
	if e.CEP != "01310100" || e.MunicipioIBGE != "3550308" {
		t.Errorf("CEP/município do endereco devem prevalecer e sem máscara: %+v", e)
	}
	if e.Logradouro != "Rua A" || e.Numero != "10" || e.Bairro != "Centro" {
		t.Errorf("campos devem vir trimados: %+v", e)
	}
	if (TomadorRequest{}).ResolvedEndereco() != nil {
		t.Error("sem endereco deve retornar nil")
	}
}
