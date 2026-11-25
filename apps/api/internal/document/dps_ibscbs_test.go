package document

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
)

// ── Fixtures ──────────────────────────────────────────────────────────────────

func empresaMEI() *auth.Empresa {
	e := empresaSN()
	e.Tipo = "MEI"
	e.RegimeTributario = "SIMPLES_MEI"
	return e
}

// reDhEmi casa o único campo da DPS que muda a cada Build (hora da emissão).
var reDhEmi = regexp.MustCompile(`<dhEmi>[^<]*</dhEmi>`)

// requestIBSCBS é o baseRequest com iss_retido=false (obrigatório para LP/LR;
// não muda SN nem MEI) e a classificação por nota informada.
func requestIBSCBS(nota *IBSCBSRequest) EmissaoRequest {
	req := baseRequest()
	naoRetido := false
	req.IssRetido = &naoRetido
	req.Servico.IBSCBS = nota
	return req
}

// normalizar troca <dhEmi> por um valor fixo, para comparar byte a byte.
func normalizar(xml []byte) string {
	return reDhEmi.ReplaceAllString(string(xml), "<dhEmi>DHEMI</dhEmi>")
}

// buildDPSNormalizada monta a DPS (nDPS 42) e normaliza <dhEmi>.
func buildDPSNormalizada(t *testing.T, req EmissaoRequest, empresa *auth.Empresa) string {
	t.Helper()
	result, err := NewDPSBuilder().Build(req, empresa, 42)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	return normalizar(result.XML)
}

// lerGolden lê testdata/<nome>. Só lê: quem regrava os arquivos é
// atualizarGolden, chamado apenas pelo teste da DPS sem IBS/CBS.
func lerGolden(t *testing.T, nome string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("testdata", nome))
	if err != nil {
		t.Fatalf("ler golden: %v", err)
	}
	// Checkout no Windows pode converter LF em CRLF.
	return strings.ReplaceAll(string(b), "\r\n", "\n")
}

// atualizarGolden regrava testdata/<nome> quando UPDATE_GOLDEN=1 — usar só
// quando a mudança na DPS sem IBS/CBS for de propósito.
func atualizarGolden(t *testing.T, nome, conteudo string) {
	t.Helper()
	if os.Getenv("UPDATE_GOLDEN") != "1" {
		return
	}
	if err := os.MkdirAll("testdata", 0o755); err != nil {
		t.Fatalf("mkdir testdata: %v", err)
	}
	if err := os.WriteFile(filepath.Join("testdata", nome), []byte(conteudo), 0o644); err != nil {
		t.Fatalf("gravar golden: %v", err)
	}
}

func boolPtr(b bool) *bool { return &b }

// ── Sem classificação: a DPS não muda ─────────────────────────────────────────

// Os arquivos golden foram gerados com o builder ANTES da inclusão do grupo
// IBSCBS (#296). Sem classificação na nota e sem padrão na empresa, o XML tem
// que continuar exatamente o mesmo — inclusive com o objeto ibs_cbs vazio.
func TestDPSBuilder_SemIBSCBS_IdenticaAoGolden(t *testing.T) {
	cases := []struct {
		nome    string
		empresa func() *auth.Empresa
		arquivo string
	}{
		{"Simples Nacional ME/EPP", empresaSN, "dps_sem_ibscbs_simples_nacional.golden.xml"},
		{"Lucro Presumido", empresaLP, "dps_sem_ibscbs_lucro_presumido.golden.xml"},
		{"MEI", empresaMEI, "dps_sem_ibscbs_mei.golden.xml"},
	}
	for _, c := range cases {
		t.Run(c.nome, func(t *testing.T) {
			got := buildDPSNormalizada(t, requestIBSCBS(nil), c.empresa())
			atualizarGolden(t, c.arquivo, got)
			if want := lerGolden(t, c.arquivo); got != want {
				t.Errorf("DPS sem classificação de IBS/CBS mudou.\n--- obtido ---\n%s\n--- esperado ---\n%s", got, want)
			}
			if strings.Contains(got, "IBSCBS") {
				t.Error("DPS sem classificação não pode conter o grupo IBSCBS")
			}

			// Objeto presente mas vazio = nada informado.
			vazio := buildDPSNormalizada(t, requestIBSCBS(&IBSCBSRequest{}), c.empresa())
			if vazio != got {
				t.Errorf("servico.ibs_cbs vazio alterou a DPS:\n%s", vazio)
			}
		})
	}
}

// ── Com classificação: grupo IBSCBS na posição do XSD ─────────────────────────

// Classificação de exemplo, só para os testes — os códigos reais vêm das
// tabelas oficiais de CST / cClassTrib / indicador de operação.
const (
	testCST        = "000"
	testCClassTrib = "000001"
	testCIndOp     = "100301"
)

func comIBSCBS(e *auth.Empresa) *auth.Empresa {
	e.IBSCBSCST = testCST
	e.IBSCBSCClassTrib = testCClassTrib
	e.IBSCBSCIndOp = testCIndOp
	return e
}

// notaIBSCBS é a mesma classificação de exemplo, informada na nota.
func notaIBSCBS() *IBSCBSRequest {
	return &IBSCBSRequest{
		CST:                           testCST,
		CodigoClassificacaoTributaria: testCClassTrib,
		CodigoIndicadorOperacao:       testCIndOp,
	}
}

// blocoIBSCBS devolve o grupo esperado, na ordem do xs:sequence de
// TCRTCInfoIBSCBS (opcionais omitidos) e com a indentação que o builder usa
// dentro de infDPS. indFinal "" = tag ausente.
func blocoIBSCBS(indFinal, cst, cClassTrib, cIndOp string) string {
	var b strings.Builder
	b.WriteString("    <IBSCBS>\n      <finNFSe>0</finNFSe>\n")
	if indFinal != "" {
		b.WriteString("      <indFinal>" + indFinal + "</indFinal>\n")
	}
	b.WriteString("      <cIndOp>" + cIndOp + "</cIndOp>\n")
	b.WriteString("      <indDest>0</indDest>\n")
	b.WriteString("      <valores>\n        <trib>\n          <gIBSCBS>\n")
	b.WriteString("            <CST>" + cst + "</CST>\n")
	b.WriteString("            <cClassTrib>" + cClassTrib + "</cClassTrib>\n")
	b.WriteString("          </gIBSCBS>\n        </trib>\n      </valores>\n    </IBSCBS>\n")
	return b.String()
}

var ibscbsEsperado = blocoIBSCBS("", testCST, testCClassTrib, testCIndOp)

// conferirGrupo verifica que a DPS tem exatamente um <IBSCBS>, igual a
// `bloco`, como último filho de <infDPS> logo após <valores>, e que fora o
// bloco o XML é o golden da DPS sem IBS/CBS.
func conferirGrupo(t *testing.T, got, bloco, arquivoGolden string) {
	t.Helper()
	if n := strings.Count(got, "<IBSCBS>"); n != 1 {
		t.Fatalf("esperado exatamente 1 grupo <IBSCBS>, veio %d:\n%s", n, got)
	}
	// Fim de </valores> de infDPS (4 espaços) seguido do grupo e de </infDPS>.
	if !strings.HasSuffix(got, "    </valores>\n"+bloco+"  </infDPS>\n</DPS>") {
		t.Errorf("<IBSCBS> deve ser o último filho de <infDPS>, logo após <valores>, com este conteúdo:\n%s\n--- DPS ---\n%s", bloco, got)
	}
	semGrupo := strings.Replace(got, bloco, "", 1)
	if want := lerGolden(t, arquivoGolden); semGrupo != want {
		t.Errorf("o grupo IBSCBS alterou o restante da DPS.\n--- obtido (sem o grupo) ---\n%s\n--- esperado ---\n%s", semGrupo, want)
	}
	// O emissor não calcula IBS nem CBS: nenhum valor/alíquota no grupo.
	for _, tag := range []string{"<vBC>", "<pIBSUF>", "<pIBSMun>", "<pCBS>", "<vIBSUF>", "<vIBSMun>", "<vCBS>"} {
		if strings.Contains(got, tag) {
			t.Errorf("DPS não pode conter %s — quem calcula é a Sefin", tag)
		}
	}
	// Campos do leiaute V1.04.01 (NT 009) não existem no XSD v1.01.
	for _, tag := range []string{"regApIBSCBSSN", "cAtvSN", "gPgtoVinc"} {
		if strings.Contains(got, tag) {
			t.Errorf("DPS v1.01 não pode conter %s (leiaute V1.04.01)", tag)
		}
	}
}

var regimes = []struct {
	nome    string
	empresa func() *auth.Empresa
	arquivo string
}{
	{"Lucro Presumido (regime normal)", empresaLP, "dps_sem_ibscbs_lucro_presumido.golden.xml"},
	{"Simples Nacional ME/EPP", empresaSN, "dps_sem_ibscbs_simples_nacional.golden.xml"},
	{"MEI", empresaMEI, "dps_sem_ibscbs_mei.golden.xml"},
}

// Padrão da empresa, nada na nota: o grupo sai para regime normal, Simples
// Nacional e MEI (o envio depende da classificação, não do regime).
func TestDPSBuilder_ComIBSCBS_GrupoNaPosicaoDoXSD(t *testing.T) {
	for _, c := range regimes {
		t.Run(c.nome, func(t *testing.T) {
			got := buildDPSNormalizada(t, requestIBSCBS(nil), comIBSCBS(c.empresa()))
			conferirGrupo(t, got, ibscbsEsperado, c.arquivo)
		})
	}
}

// Classificação só na nota, empresa sem padrão: mesmo grupo, mesma posição.
func TestDPSBuilder_IBSCBS_SoNaNota(t *testing.T) {
	for _, c := range regimes {
		t.Run(c.nome, func(t *testing.T) {
			got := buildDPSNormalizada(t, requestIBSCBS(notaIBSCBS()), c.empresa())
			conferirGrupo(t, got, ibscbsEsperado, c.arquivo)
		})
	}
}

// Precedência campo a campo: o que a nota informa vale; o resto vem do padrão
// da empresa.
func TestDPSBuilder_IBSCBS_NotaSobrescreveEmpresa(t *testing.T) {
	const arquivo = "dps_sem_ibscbs_lucro_presumido.golden.xml"
	cases := []struct {
		nome  string
		nota  IBSCBSRequest
		bloco string
	}{
		{"só CST", IBSCBSRequest{CST: "200"}, blocoIBSCBS("", "200", testCClassTrib, testCIndOp)},
		{"só cClassTrib", IBSCBSRequest{CodigoClassificacaoTributaria: "200001"}, blocoIBSCBS("", testCST, "200001", testCIndOp)},
		{"só cIndOp", IBSCBSRequest{CodigoIndicadorOperacao: "100501"}, blocoIBSCBS("", testCST, testCClassTrib, "100501")},
		{
			"os três",
			IBSCBSRequest{CST: "200", CodigoClassificacaoTributaria: "200001", CodigoIndicadorOperacao: "100501"},
			blocoIBSCBS("", "200", "200001", "100501"),
		},
		{"espaços em volta", IBSCBSRequest{CST: " 200 "}, blocoIBSCBS("", "200", testCClassTrib, testCIndOp)},
		{"só consumo pessoal = sim", IBSCBSRequest{ConsumoPessoal: boolPtr(true)}, blocoIBSCBS("1", testCST, testCClassTrib, testCIndOp)},
		{"só consumo pessoal = não", IBSCBSRequest{ConsumoPessoal: boolPtr(false)}, blocoIBSCBS("0", testCST, testCClassTrib, testCIndOp)},
	}
	for _, c := range cases {
		t.Run(c.nome, func(t *testing.T) {
			nota := c.nota
			got := buildDPSNormalizada(t, requestIBSCBS(&nota), comIBSCBS(empresaLP()))
			conferirGrupo(t, got, c.bloco, arquivo)
		})
	}
}

// indFinal fica entre finNFSe e cIndOp (xs:sequence) também quando a
// classificação vem toda da nota.
func TestDPSBuilder_IBSCBS_ConsumoPessoalNaNota(t *testing.T) {
	nota := notaIBSCBS()
	nota.ConsumoPessoal = boolPtr(true)
	got := buildDPSNormalizada(t, requestIBSCBS(nota), empresaSN())
	conferirGrupo(t, got, blocoIBSCBS("1", testCST, testCClassTrib, testCIndOp), "dps_sem_ibscbs_simples_nacional.golden.xml")
}

// O grupo entra dentro de <infDPS>, que é o elemento assinado: o Id e o
// fechamento de infDPS continuam íntegros para o XMLDSig.
func TestDPSBuilder_ComIBSCBS_DentroDoInfDPSAssinado(t *testing.T) {
	result, err := NewDPSBuilder().Build(baseRequest(), comIBSCBS(empresaSN()), 1)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	s := string(result.XML)
	iGrupo, iFim := strings.Index(s, "<IBSCBS>"), strings.Index(s, "</infDPS>")
	if iGrupo < 0 || iFim < 0 || iGrupo > iFim {
		t.Fatalf("<IBSCBS> deve estar dentro de <infDPS>:\n%s", s)
	}
	if id := extractIDValue(result.XML, "infDPS"); !strings.HasPrefix(id, "DPS") {
		t.Errorf("Id de infDPS = %q, esperado prefixo DPS", id)
	}
}

// Espaços em volta do padrão da empresa não invalidam nem vazam para o XML.
func TestDPSBuilder_IBSCBS_IgnoraEspacos(t *testing.T) {
	emp := empresaLP()
	emp.IBSCBSCST, emp.IBSCBSCClassTrib, emp.IBSCBSCIndOp = " 000 ", "000001 ", " 100301"
	got := buildDPSNormalizada(t, requestIBSCBS(nil), emp)
	if !strings.Contains(got, ibscbsEsperado) {
		t.Errorf("grupo IBSCBS esperado não encontrado:\n%s", got)
	}
}

// ── Validação: antes do número da DPS e na última barreira (Build) ────────────

// Classificação parcial ou fora do padrão do XSD não gera DPS: enviar renderia
// E1235 na Sefin, e omitir o grupo em silêncio esconderia o problema.
//
// Erro de quem chama a API → *ErrValidation com o campo do request.
// Erro do padrão cadastrado → *ErrConfigEmpresa, sem nome de coluna do banco.
func TestIBSCBS_ClassificacaoInvalida(t *testing.T) {
	type emp struct{ cst, cClassTrib, cIndOp string }
	completa := emp{testCST, testCClassTrib, testCIndOp}

	cases := []struct {
		nome      string
		empresa   emp
		nota      *IBSCBSRequest
		doRequest bool   // true → *ErrValidation; false → *ErrConfigEmpresa
		wantCampo string // Field esperado
	}{
		// Padrão da empresa com problema, nota sem classificação.
		{"empresa: só CST", emp{cst: testCST}, nil, false, "empresa.ibs_cbs"},
		{"empresa: sem cIndOp", emp{testCST, testCClassTrib, ""}, nil, false, "empresa.ibs_cbs"},
		{"empresa: sem CST", emp{"", testCClassTrib, testCIndOp}, nil, false, "empresa.ibs_cbs"},
		{"empresa: CST com 2 dígitos", emp{"00", testCClassTrib, testCIndOp}, nil, false, "empresa.ibs_cbs"},
		{"empresa: cClassTrib com letra", emp{testCST, "00000A", testCIndOp}, nil, false, "empresa.ibs_cbs"},
		{"empresa: cIndOp com 7 dígitos", emp{testCST, testCClassTrib, "1003010"}, nil, false, "empresa.ibs_cbs"},
		// Padrão inválido num campo que a nota NÃO sobrescreve continua barrando.
		{"empresa: cIndOp inválido, nota só com CST", emp{testCST, testCClassTrib, "1"}, &IBSCBSRequest{CST: "200"}, false, "empresa.ibs_cbs"},

		// Nota com problema.
		{"nota: CST com 2 dígitos", completa, &IBSCBSRequest{CST: "20"}, true, "servico.ibs_cbs.cst"},
		{"nota: CST com letra", emp{}, &IBSCBSRequest{CST: "2A0", CodigoClassificacaoTributaria: testCClassTrib, CodigoIndicadorOperacao: testCIndOp}, true, "servico.ibs_cbs.cst"},
		{"nota: cClassTrib com 5 dígitos", completa, &IBSCBSRequest{CodigoClassificacaoTributaria: "00001"}, true, "servico.ibs_cbs.codigo_classificacao_tributaria"},
		{"nota: cIndOp com 7 dígitos", completa, &IBSCBSRequest{CodigoIndicadorOperacao: "1003010"}, true, "servico.ibs_cbs.codigo_indicador_operacao"},
		// Nota parcial e empresa sem padrão para completar.
		{"nota: só CST, empresa sem padrão", emp{}, &IBSCBSRequest{CST: testCST}, true, "servico.ibs_cbs.codigo_classificacao_tributaria"},
		{"nota: sem cIndOp, empresa sem padrão", emp{}, &IBSCBSRequest{CST: testCST, CodigoClassificacaoTributaria: testCClassTrib}, true, "servico.ibs_cbs.codigo_indicador_operacao"},
		{"nota: sem CST, empresa sem padrão", emp{}, &IBSCBSRequest{CodigoClassificacaoTributaria: testCClassTrib, CodigoIndicadorOperacao: testCIndOp}, true, "servico.ibs_cbs.cst"},
		// Consumo pessoal sem classificação nenhuma: não há grupo onde declarar.
		{"nota: consumo pessoal sem classificação", emp{}, &IBSCBSRequest{ConsumoPessoal: boolPtr(true)}, true, "servico.ibs_cbs.consumo_pessoal"},
		{"nota: consumo pessoal = não, sem classificação", emp{}, &IBSCBSRequest{ConsumoPessoal: boolPtr(false)}, true, "servico.ibs_cbs.consumo_pessoal"},
	}
	for _, c := range cases {
		t.Run(c.nome, func(t *testing.T) {
			empresa := empresaSN()
			empresa.IBSCBSCST, empresa.IBSCBSCClassTrib, empresa.IBSCBSCIndOp = c.empresa.cst, c.empresa.cClassTrib, c.empresa.cIndOp
			req := requestIBSCBS(c.nota)

			conferir := func(origem string, err error) {
				t.Helper()
				var campo, msg string
				var ve *ErrValidation
				var ce *ErrConfigEmpresa
				switch {
				case errors.As(err, &ve):
					if !c.doRequest {
						t.Fatalf("%s: esperado *ErrConfigEmpresa, veio *ErrValidation: %v", origem, err)
					}
					campo, msg = ve.Field, ve.Message
				case errors.As(err, &ce):
					if c.doRequest {
						t.Fatalf("%s: esperado *ErrValidation, veio *ErrConfigEmpresa: %v", origem, err)
					}
					campo, msg = ce.Field, ce.Message
				default:
					t.Fatalf("%s: esperado erro de classificação, veio %T: %v", origem, err, err)
				}
				if campo != c.wantCampo {
					t.Errorf("%s: campo do erro = %q, esperado %q", origem, campo, c.wantCampo)
				}
				// Nome de coluna do banco não pode vazar para quem chama a API.
				for _, vazamento := range []string{"ibscbs_", "_padrao"} {
					if strings.Contains(campo+" "+msg, vazamento) {
						t.Errorf("%s: erro expõe nome de coluna (%q): %s — %s", origem, vazamento, campo, msg)
					}
				}
			}

			// Validação que os chamadores rodam antes de alocar o número…
			conferir("ValidateIBSCBS", ValidateIBSCBS(req, empresa))
			// …e a última barreira, dentro do Build.
			_, err := NewDPSBuilder().Build(req, empresa, 1)
			conferir("Build", err)
		})
	}
}

// ValidateIBSCBS aprova exatamente o que o Build aceita.
func TestValidateIBSCBS_Aprova(t *testing.T) {
	cases := []struct {
		nome    string
		empresa *auth.Empresa
		nota    *IBSCBSRequest
	}{
		{"nada configurado, nada na nota", empresaSN(), nil},
		{"objeto vazio na nota", empresaSN(), &IBSCBSRequest{}},
		{"padrão da empresa", comIBSCBS(empresaLP()), nil},
		{"só a nota", empresaMEI(), notaIBSCBS()},
		{"nota completa sobre padrão da empresa", comIBSCBS(empresaSN()), notaIBSCBS()},
		{"nota parcial completada pela empresa", comIBSCBS(empresaSN()), &IBSCBSRequest{CST: "200", ConsumoPessoal: boolPtr(true)}},
	}
	for _, c := range cases {
		t.Run(c.nome, func(t *testing.T) {
			if err := ValidateIBSCBS(requestIBSCBS(c.nota), c.empresa); err != nil {
				t.Errorf("ValidateIBSCBS: %v", err)
			}
		})
	}
	if err := ValidateIBSCBS(baseRequest(), nil); err == nil {
		t.Error("empresa nil deveria dar erro, não panic")
	}
}

// ── Contrato JSON de servico.ibs_cbs ──────────────────────────────────────────

func TestIBSCBSRequest_JSON(t *testing.T) {
	const corpo = `{
		"servico": {
			"codigo_nbs": "01.01.01.10", "discriminacao": "Dev", "valor": 100,
			"ibs_cbs": {
				"cst": "000",
				"codigo_classificacao_tributaria": "000001",
				"codigo_indicador_operacao": "100301",
				"consumo_pessoal": true
			}
		},
		"tomador": {"documento": "98765432000100", "razao_social": "Tomador LTDA"},
		"competencia": "2026-11"
	}`
	var req EmissaoRequest
	if err := json.Unmarshal([]byte(corpo), &req); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	got := req.Servico.IBSCBS
	if got == nil {
		t.Fatal("servico.ibs_cbs não foi lido")
	}
	if got.CST != "000" || got.CodigoClassificacaoTributaria != "000001" || got.CodigoIndicadorOperacao != "100301" ||
		got.ConsumoPessoal == nil || !*got.ConsumoPessoal {
		t.Errorf("servico.ibs_cbs lido errado: %+v", got)
	}

	// dados_emissao ("Corrigir e emitir novamente") guarda o serviço inteiro,
	// então a classificação da nota vai junto.
	var dados struct {
		Servico struct {
			IBSCBS *IBSCBSRequest `json:"ibs_cbs"`
		} `json:"servico"`
	}
	if err := json.Unmarshal(req.DadosEmissaoJSON(), &dados); err != nil {
		t.Fatalf("DadosEmissaoJSON: %v", err)
	}
	if dados.Servico.IBSCBS == nil || dados.Servico.IBSCBS.CST != "000" {
		t.Errorf("dados_emissao perdeu servico.ibs_cbs: %s", req.DadosEmissaoJSON())
	}

	// Sem o objeto, o JSON gravado não ganha chave nova.
	if b := baseRequest().DadosEmissaoJSON(); strings.Contains(string(b), "ibs_cbs") {
		t.Errorf("dados_emissao sem classificação não deveria ter ibs_cbs: %s", b)
	}
}
