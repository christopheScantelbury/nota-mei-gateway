package document

import (
	"bytes"
	"encoding/xml"
	"strings"
	"testing"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/google/uuid"
)

// ── Test fixtures ─────────────────────────────────────────────────────────────

func empresaSN() *auth.Empresa {
	im := "1234567"
	return &auth.Empresa{
		ID:                 uuid.MustParse("11111111-1111-1111-1111-111111111111"),
		Tipo:               "ME",
		RegimeTributario:   "SIMPLES_NACIONAL",
		CNPJ:               "12345678000190",
		RazaoSocial:        "Empresa Teste ME LTDA",
		Email:              "contato@empresa.com.br",
		MunicipioIBGE:      "1302603",
		CNAE:               "6201500",
		CEP:                "69000000",
		InscricaoMunicipal: &im,
	}
}

func empresaLP() *auth.Empresa {
	return &auth.Empresa{
		ID:               uuid.MustParse("22222222-2222-2222-2222-222222222222"),
		Tipo:             "ME",
		RegimeTributario: "LUCRO_PRESUMIDO",
		CNPJ:             "12345678000190",
		RazaoSocial:      "Empresa LP LTDA",
		Email:            "contato@lp.com.br",
		MunicipioIBGE:    "1302603",
		CNAE:             "6201500",
		CEP:              "69001000",
	}
}

func baseRequest() EmissaoRequest {
	return EmissaoRequest{
		Servico: ServicoRequest{
			CodigoNBS:     "01.01.01.10",
			Discriminacao: "Desenvolvimento de software conforme contrato",
			Valor:         3500.00,
			AliquotaISS:   2.0,
		},
		Tomador: TomadorRequest{
			Tipo:          "PJ",
			Documento:     "98765432000100",
			RazaoSocial:   "Tomador LTDA",
			Email:         "fin@tomador.com.br",
			MunicipioIBGE: "3550308",
			CEP:           "01310100",
			TipoOrgao:     "PRIVADO",
		},
		Competencia: "2026-06",
	}
}

// ── TC-01: Simples Nacional ────────────────────────────────────────────────────

func TestDPSBuilder_SN_ValidXML(t *testing.T) {
	b := NewDPSBuilder()
	result, err := b.Build(baseRequest(), empresaSN(), 1)
	if err != nil {
		t.Fatalf("Build SN: %v", err)
	}
	if !bytes.HasPrefix(result.XML, []byte("<?xml")) {
		t.Error("output should start with XML declaration")
	}
	// Must be parseable XML.
	if err := xml.Unmarshal(result.XML[len(xml.Header):], &struct{ XMLName xml.Name }{}); err != nil {
		t.Errorf("output is not valid XML: %v", err)
	}
}

func TestDPSBuilder_SN_KeyFields(t *testing.T) {
	b := NewDPSBuilder()
	result, err := b.Build(baseRequest(), empresaSN(), 42)
	if err != nil {
		t.Fatalf("Build SN: %v", err)
	}
	s := string(result.XML)

	checks := []struct {
		name string
		want string
	}{
		{"DPS namespace", DPSSefinNS},
		{"infDPS Id", `Id="DPS1000042"`},
		{"CNPJ emitente", "12345678000190"},
		{"opSimpNac=1 (SN)", "<opSimpNac>1</opSimpNac>"},
		{"cRegTrib=1 (SN)", "<cRegTrib>1</cRegTrib>"},
		{"IM inscricao", "<IM>1234567</IM>"},
		{"municipio IBGE emit", "<cMun>1302603</cMun>"},
		{"CNPJ tomador", "98765432000100"},
		{"codigo NBS", "01.01.01.10"},
		{"discriminacao", "Desenvolvimento de software conforme contrato"},
		{"valor recebido", "<vReceb>3500"},
		{"aliquota ISS", "<pAliq>2"},
		{"indISSRet=2 (não ret)", "<indISSRet>2</indISSRet>"},
		{"cNatOp=1", "<cNatOp>1</cNatOp>"},
		{"indIncFisc=1", "<indIncFisc>1</indIncFisc>"},
		{"dCompet 2026-06", "2026-06-01"},
		{"dhEmi offset", "-04:00"},
	}
	for _, c := range checks {
		if !strings.Contains(s, c.want) {
			t.Errorf("SN XML missing %s (%q)", c.name, c.want)
		}
	}
}

func TestDPSBuilder_SN_ISSNotRetained(t *testing.T) {
	b := NewDPSBuilder()
	result, err := b.Build(baseRequest(), empresaSN(), 1)
	if err != nil {
		t.Fatalf("Build SN: %v", err)
	}
	if result.ISSRetido {
		t.Error("SN should never retain ISS at source")
	}
	// vISSRet must NOT appear for SN
	if strings.Contains(string(result.XML), "<vISSRet>") {
		t.Error("SN XML must not contain <vISSRet> tag")
	}
}

func TestDPSBuilder_SN_ValorISS(t *testing.T) {
	b := NewDPSBuilder()
	req := baseRequest()
	req.Servico.Valor = 3500.00
	req.Servico.AliquotaISS = 2.0
	result, err := b.Build(req, empresaSN(), 1)
	if err != nil {
		t.Fatalf("Build SN: %v", err)
	}
	want := 70.00
	if result.ValorISS != want {
		t.Errorf("ValorISS = %.2f, want %.2f", result.ValorISS, want)
	}
	// SN: ValorLiquido == ValorServico (no retention)
	if result.ValorLiquido != req.Servico.Valor {
		t.Errorf("ValorLiquido = %.2f, want %.2f (SN: no retention)", result.ValorLiquido, req.Servico.Valor)
	}
}

func TestDPSBuilder_SN_IMOmitedWhenEmpty(t *testing.T) {
	empresa := empresaSN()
	empresa.InscricaoMunicipal = nil // no IM
	b := NewDPSBuilder()
	result, err := b.Build(baseRequest(), empresa, 1)
	if err != nil {
		t.Fatalf("Build SN: %v", err)
	}
	if strings.Contains(string(result.XML), "<IM>") {
		t.Error("IM tag must be omitted when inscricao_municipal is nil")
	}
}

// ── TC-02/03: Lucro Presumido ─────────────────────────────────────────────────

func TestDPSBuilder_LP_NaoRetido(t *testing.T) {
	b := NewDPSBuilder()
	req := baseRequest()
	issRetido := false
	req.IssRetido = &issRetido

	result, err := b.Build(req, empresaLP(), 5)
	if err != nil {
		t.Fatalf("Build LP não retido: %v", err)
	}
	s := string(result.XML)

	if !strings.Contains(s, "<opSimpNac>2</opSimpNac>") {
		t.Error("LP must have opSimpNac=2")
	}
	if !strings.Contains(s, "<cRegTrib>3</cRegTrib>") {
		t.Error("LP must have cRegTrib=3")
	}
	if !strings.Contains(s, "<indISSRet>2</indISSRet>") {
		t.Error("LP não retido must have indISSRet=2")
	}
	if strings.Contains(s, "<vISSRet>") {
		t.Error("LP não retido must not have <vISSRet>")
	}
	if result.ISSRetido {
		t.Error("ISSRetido should be false")
	}
	// ValorLiquido == ValorServico when not retained
	if result.ValorLiquido != req.Servico.Valor {
		t.Errorf("ValorLiquido = %.2f, want %.2f", result.ValorLiquido, req.Servico.Valor)
	}
}

func TestDPSBuilder_LP_Retido(t *testing.T) {
	b := NewDPSBuilder()
	req := baseRequest()
	issRetido := true
	req.IssRetido = &issRetido

	result, err := b.Build(req, empresaLP(), 7)
	if err != nil {
		t.Fatalf("Build LP retido: %v", err)
	}
	s := string(result.XML)

	if !strings.Contains(s, "<indISSRet>1</indISSRet>") {
		t.Error("LP retido must have indISSRet=1")
	}
	if !strings.Contains(s, "<vISSRet>") {
		t.Error("LP retido must have <vISSRet> tag")
	}
	if !result.ISSRetido {
		t.Error("ISSRetido should be true")
	}

	wantISS := 70.00 // 3500 * 2% = 70
	if result.ValorISS != wantISS {
		t.Errorf("ValorISS = %.2f, want %.2f", result.ValorISS, wantISS)
	}
	wantLiquido := 3430.00 // 3500 - 70
	if result.ValorLiquido != wantLiquido {
		t.Errorf("ValorLiquido = %.2f, want %.2f", result.ValorLiquido, wantLiquido)
	}
}

// TC-05: LP sem iss_retido → validação obrigatória
func TestDPSBuilder_LP_IssRetidoNil_ReturnsValidationError(t *testing.T) {
	b := NewDPSBuilder()
	req := baseRequest()
	req.IssRetido = nil // not set

	_, err := b.Build(req, empresaLP(), 1)
	if err == nil {
		t.Fatal("expected error for nil iss_retido with LP regime")
	}
	var validErr *ErrValidation
	if !isValidationError(err, &validErr) {
		t.Fatalf("expected *ErrValidation, got %T: %v", err, err)
	}
	if validErr.Field != "iss_retido" {
		t.Errorf("error field = %q, want \"iss_retido\"", validErr.Field)
	}
}

// TC-04: orgao_publico forces iss_retido=true even when client sent false
func TestDPSBuilder_LP_OrgaoPublico_ForcesRetencao(t *testing.T) {
	b := NewDPSBuilder()
	req := baseRequest()
	req.Tomador.TipoOrgao = "ORGAO_PUBLICO"
	issRetido := false
	req.IssRetido = &issRetido // client says false — should be overridden

	result, err := b.Build(req, empresaLP(), 3)
	if err != nil {
		t.Fatalf("Build LP orgao_publico: %v", err)
	}
	if !result.ISSRetido {
		t.Error("orgao_publico must force ISS retention (Art. 6 LC 116/2003)")
	}
	if !strings.Contains(string(result.XML), "<indISSRet>1</indISSRet>") {
		t.Error("orgao_publico must have indISSRet=1")
	}
}

// ── TC-06: Backward compat — RPS builder still works ─────────────────────────

func TestRPSBuilder_StillWorks_AfterDPSChanges(t *testing.T) {
	b := NewBuilder()
	req := EmissaoRequest{
		Servico: ServicoRequest{
			CodigoNBS:     "01.01.01.10",
			Discriminacao: "Desenvolvimento de software",
			Valor:         3500.00,
			AliquotaISS:   2.0,
		},
		Tomador: TomadorRequest{
			Tipo:        "PJ",
			Documento:   "12345678000190",
			RazaoSocial: "Empresa Cliente LTDA",
			Email:       "nfe@empresa.com",
		},
		Competencia: "2026-06",
	}
	out, err := b.Build(req, "12345678000109", "3550308", 99)
	if err != nil {
		t.Fatalf("RPS Build: %v", err)
	}
	if !bytes.HasPrefix(out, []byte("<?xml")) {
		t.Error("RPS output should start with XML declaration")
	}
	if !bytes.Contains(out, []byte("GerarNfseEnvio")) {
		t.Error("RPS output should contain GerarNfseEnvio root element")
	}
}

// ── rounding ──────────────────────────────────────────────────────────────────

func TestRoundHalfUp(t *testing.T) {
	cases := []struct {
		in   float64
		want float64
	}{
		{70.005, 70.01},
		{70.004, 70.00},
		{70.00, 70.00},
		{0.125, 0.13},
		{0.124, 0.12},
	}
	for _, c := range cases {
		if got := roundHalfUp(c.in); got != c.want {
			t.Errorf("roundHalfUp(%.4f) = %.2f, want %.2f", c.in, got, c.want)
		}
	}
}

// ── DPS Id format ─────────────────────────────────────────────────────────────

func TestDPSBuilder_InfDPS_IdFormat(t *testing.T) {
	b := NewDPSBuilder()
	result, err := b.Build(baseRequest(), empresaSN(), 1)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	// Id must be "DPS1000001" (serie=1, nDPS=000001)
	if !strings.Contains(string(result.XML), `Id="DPS1000001"`) {
		t.Errorf("infDPS Id should be DPS1000001, got: %s",
			string(result.XML)[:200])
	}
}

// ── dhEmi timezone ────────────────────────────────────────────────────────────

func TestDPSBuilder_DhEmi_HasManausOffset(t *testing.T) {
	b := NewDPSBuilder()
	result, err := b.Build(baseRequest(), empresaSN(), 1)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	s := string(result.XML)
	if !strings.Contains(s, "-04:00") {
		t.Error("dhEmi must contain -04:00 offset (Manaus timezone)")
	}
}

// ── xmldsig supports infDPS element ──────────────────────────────────────────

func TestXMLDSig_SupportsInfDPS(t *testing.T) {
	b := NewDPSBuilder()
	result, err := b.Build(baseRequest(), empresaSN(), 1)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	// The signer must recognise infDPS as a signable element.
	idVal := extractIDValue(result.XML, "infDPS")
	if idVal == "infDPS" {
		// extractIDValue returned fallback — Id attr not found or wrong
		t.Logf("WARN: extractIDValue returned fallback; checking raw XML")
		if !strings.Contains(string(result.XML), `Id="DPS1`) {
			t.Error("infDPS element must have Id attribute starting with DPS1")
		}
	}
	if !strings.HasPrefix(idVal, "DPS") {
		t.Errorf("infDPS Id should start with DPS, got %q", idVal)
	}
}

func TestDetectDocNamespace_DPS(t *testing.T) {
	xml := `<DPS xmlns="` + DPSSefinNS + `"><infDPS Id="DPS1000001"></infDPS></DPS>`
	ns := detectDocNamespace(xml)
	if ns != DPSSefinNS {
		t.Errorf("detectDocNamespace = %q, want %q", ns, DPSSefinNS)
	}
}

func TestDetectDocNamespace_RPS(t *testing.T) {
	xml := `<GerarNfseEnvio xmlns="` + abrasf + `"><Rps></Rps></GerarNfseEnvio>`
	ns := detectDocNamespace(xml)
	if ns != abrasf {
		t.Errorf("detectDocNamespace (RPS) = %q, want %q", ns, abrasf)
	}
}

func TestExtractIDValue_DPS(t *testing.T) {
	doc := []byte(`<DPS xmlns="` + DPSSefinNS + `"><infDPS Id="DPS1000042"></infDPS></DPS>`)
	id := extractIDValue(doc, "infDPS")
	if id != "DPS1000042" {
		t.Errorf("extractIDValue = %q, want DPS1000042", id)
	}
}

func TestExtractIDValue_RPS_Fallback(t *testing.T) {
	// RPS elements don't have Id before injectIDAttr is called; fallback returns elemName
	doc := []byte(`<GerarNfseEnvio><InfDeclaracaoPrestacaoServico></InfDeclaracaoPrestacaoServico></GerarNfseEnvio>`)
	id := extractIDValue(doc, "InfDeclaracaoPrestacaoServico")
	if id != "InfDeclaracaoPrestacaoServico" {
		t.Errorf("extractIDValue fallback = %q, want InfDeclaracaoPrestacaoServico", id)
	}
}

// ── DPS namespace ─────────────────────────────────────────────────────────────

func TestDPSBuilder_CorrectNamespace(t *testing.T) {
	b := NewDPSBuilder()
	result, err := b.Build(baseRequest(), empresaSN(), 1)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	if !strings.Contains(string(result.XML), DPSSefinNS) {
		t.Errorf("DPS XML must contain namespace %q", DPSSefinNS)
	}
	// Must NOT contain the ABRASF namespace
	if strings.Contains(string(result.XML), abrasf) {
		t.Errorf("DPS XML must NOT contain ABRASF namespace %q", abrasf)
	}
}

// ── fusoManaus ────────────────────────────────────────────────────────────────

func TestFusoManaus_IsUTCMinus4(t *testing.T) {
	loc := fusoManaus()
	// Test that Manaus is UTC-4 (no DST)
	t1 := time.Date(2026, 6, 1, 12, 0, 0, 0, loc)
	_, offset := t1.Zone()
	if offset != -4*3600 {
		t.Errorf("Manaus offset = %d, want %d (-4h)", offset, -4*3600)
	}
}

// ── helpers ───────────────────────────────────────────────────────────────────

func isValidationError(err error, target **ErrValidation) bool {
	if err == nil {
		return false
	}
	if ve, ok := err.(*ErrValidation); ok {
		*target = ve
		return true
	}
	return false
}
