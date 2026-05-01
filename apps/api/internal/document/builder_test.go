package document

import (
	"bytes"
	"encoding/xml"
	"testing"
)

var testReq = EmissaoRequest{
	Servico: ServicoRequest{
		CodigoNBS:     "01.01.01.10",
		Discriminacao: "Desenvolvimento de software",
		Valor:         3500.00,
		AliquotaISS:   2.0,
	},
	Tomador: TomadorRequest{
		Tipo:        "PJ",
		Documento:   "12345678000190",
		RazaoSocial: "Empresa Teste LTDA",
		Email:       "nfe@empresa.com",
	},
	Competencia: "2026-04",
}

func TestBuild_ValidXML(t *testing.T) {
	b := NewBuilder()
	out, err := b.Build(testReq, "12345678000109", "3550308", 1)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	if !bytes.HasPrefix(out, []byte("<?xml")) {
		t.Error("output should start with XML declaration")
	}
	// Must be parseable XML.
	if err := xml.Unmarshal(out[len(xml.Header):], &struct{ XMLName xml.Name }{}); err != nil {
		t.Errorf("output is not valid XML: %v", err)
	}
}

func TestBuild_ContainsKeyFields(t *testing.T) {
	b := NewBuilder()
	out, err := b.Build(testReq, "12345678000109", "3550308", 42)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	s := string(out)
	checks := []struct {
		name string
		want string
	}{
		{"CNPJ prestador", "12345678000109"},
		{"municipio", "3550308"},
		{"numero RPS", "<Numero>42</Numero>"},
		{"discriminacao", "Desenvolvimento de software"},
		{"valor", "3500.00"},
		{"codigo NBS", "0101011"}, // dots stripped
		{"CNPJ tomador", "12345678000190"},
	}
	for _, c := range checks {
		if !bytes.Contains([]byte(s), []byte(c.want)) {
			t.Errorf("Build output missing %s (%q)", c.name, c.want)
		}
	}
}

func TestBuild_InvalidCompetencia(t *testing.T) {
	b := NewBuilder()
	req := testReq
	req.Competencia = "not-a-date"
	_, err := b.Build(req, "12345678000109", "3550308", 1)
	if err == nil {
		t.Error("expected error for invalid competencia")
	}
}

func TestBuildCancelamento_ValidXML(t *testing.T) {
	b := NewBuilder()
	out, err := b.BuildCancelamento("000123", "12345678000109", "3550308")
	if err != nil {
		t.Fatalf("BuildCancelamento: %v", err)
	}
	s := string(out)
	if !bytes.Contains([]byte(s), []byte("000123")) {
		t.Error("cancelamento XML missing numero NFS-e")
	}
	if !bytes.Contains([]byte(s), []byte("12345678000109")) {
		t.Error("cancelamento XML missing CNPJ")
	}
}

func TestBuildTomador_PF(t *testing.T) {
	tom := buildTomador(TomadorRequest{
		Tipo:        "PF",
		Documento:   "123.456.789-09",
		RazaoSocial: "João Silva",
	})
	if tom.IdentificacaoTomador.CpfCnpj.Cpf != "12345678909" {
		t.Errorf("CPF = %q, want 12345678909", tom.IdentificacaoTomador.CpfCnpj.Cpf)
	}
	if tom.IdentificacaoTomador.CpfCnpj.Cnpj != "" {
		t.Errorf("CNPJ should be empty for PF tomador")
	}
}

func TestFmt2dec(t *testing.T) {
	cases := []struct {
		in   float64
		want string
	}{
		{3500.0, "3500.00"},
		{0.02, "0.02"},
		{1234.5, "1234.50"},
	}
	for _, c := range cases {
		if got := fmt2dec(c.in); got != c.want {
			t.Errorf("fmt2dec(%v) = %q, want %q", c.in, got, c.want)
		}
	}
}
