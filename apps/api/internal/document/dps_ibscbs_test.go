package document

import (
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

// buildDPSNormalizada monta a DPS e troca <dhEmi> por um valor fixo, para
// permitir comparação byte a byte.
func buildDPSNormalizada(t *testing.T, empresa *auth.Empresa) string {
	t.Helper()
	req := baseRequest()
	naoRetido := false
	req.IssRetido = &naoRetido // obrigatório para LP/LR; não muda SN nem MEI
	result, err := NewDPSBuilder().Build(req, empresa, 42)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	return reDhEmi.ReplaceAllString(string(result.XML), "<dhEmi>DHEMI</dhEmi>")
}

// golden lê testdata/<nome>. Com UPDATE_GOLDEN=1 regrava o arquivo com `got`
// — usar só quando a mudança na DPS for de propósito.
func golden(t *testing.T, nome, got string) string {
	t.Helper()
	path := filepath.Join("testdata", nome)
	if os.Getenv("UPDATE_GOLDEN") == "1" {
		if err := os.MkdirAll("testdata", 0o755); err != nil {
			t.Fatalf("mkdir testdata: %v", err)
		}
		if err := os.WriteFile(path, []byte(got), 0o644); err != nil {
			t.Fatalf("gravar golden: %v", err)
		}
	}
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ler golden: %v", err)
	}
	// Checkout no Windows pode converter LF em CRLF.
	return strings.ReplaceAll(string(b), "\r\n", "\n")
}

// ── Sem configuração: a DPS não muda ──────────────────────────────────────────

// Os arquivos golden foram gerados com o builder ANTES da inclusão do grupo
// IBSCBS (#296). Empresa sem classificação configurada tem que continuar
// produzindo exatamente o mesmo XML.
func TestDPSBuilder_SemIBSCBS_IdenticaAoGolden(t *testing.T) {
	cases := []struct {
		nome    string
		empresa *auth.Empresa
		arquivo string
	}{
		{"Simples Nacional ME/EPP", empresaSN(), "dps_sem_ibscbs_simples_nacional.golden.xml"},
		{"Lucro Presumido", empresaLP(), "dps_sem_ibscbs_lucro_presumido.golden.xml"},
		{"MEI", empresaMEI(), "dps_sem_ibscbs_mei.golden.xml"},
	}
	for _, c := range cases {
		t.Run(c.nome, func(t *testing.T) {
			got := buildDPSNormalizada(t, c.empresa)
			if want := golden(t, c.arquivo, got); got != want {
				t.Errorf("DPS sem configuração de IBS/CBS mudou.\n--- obtido ---\n%s\n--- esperado ---\n%s", got, want)
			}
			if strings.Contains(got, "IBSCBS") {
				t.Error("DPS sem configuração não pode conter o grupo IBSCBS")
			}
		})
	}
}

// ── Com configuração: grupo IBSCBS na posição do XSD ──────────────────────────

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

// Bloco esperado, na ordem do xs:sequence de TCRTCInfoIBSCBS (elementos
// opcionais omitidos) e com a indentação que o builder usa dentro de infDPS.
const ibscbsEsperado = `    <IBSCBS>
      <finNFSe>0</finNFSe>
      <cIndOp>100301</cIndOp>
      <indDest>0</indDest>
      <valores>
        <trib>
          <gIBSCBS>
            <CST>000</CST>
            <cClassTrib>000001</cClassTrib>
          </gIBSCBS>
        </trib>
      </valores>
    </IBSCBS>
`

// TCInfDPS: <IBSCBS> é o último elemento, logo depois de <valores>. Fora o
// bloco novo, a DPS tem que ser a mesma de quem não tem configuração — para
// regime normal, Simples Nacional e MEI (o envio depende da configuração da
// empresa, não do regime).
func TestDPSBuilder_ComIBSCBS_GrupoNaPosicaoDoXSD(t *testing.T) {
	cases := []struct {
		nome    string
		empresa *auth.Empresa
		arquivo string
	}{
		{"Lucro Presumido (regime normal)", comIBSCBS(empresaLP()), "dps_sem_ibscbs_lucro_presumido.golden.xml"},
		{"Simples Nacional ME/EPP", comIBSCBS(empresaSN()), "dps_sem_ibscbs_simples_nacional.golden.xml"},
		{"MEI", comIBSCBS(empresaMEI()), "dps_sem_ibscbs_mei.golden.xml"},
	}
	// Fim de </valores> de infDPS (4 espaços) seguido do grupo e de </infDPS>.
	posicao := "    </valores>\n" + ibscbsEsperado + "  </infDPS>\n</DPS>"

	for _, c := range cases {
		t.Run(c.nome, func(t *testing.T) {
			got := buildDPSNormalizada(t, c.empresa)

			if n := strings.Count(got, "<IBSCBS>"); n != 1 {
				t.Fatalf("esperado exatamente 1 grupo <IBSCBS>, veio %d:\n%s", n, got)
			}
			if !strings.HasSuffix(got, posicao) {
				t.Errorf("<IBSCBS> deve ser o último filho de <infDPS>, logo após <valores>:\n%s", got)
			}

			// Sem o bloco novo, o XML é o mesmo golden de antes da mudança.
			semGrupo := strings.Replace(got, ibscbsEsperado, "", 1)
			if want := golden(t, c.arquivo, semGrupo); semGrupo != want {
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
		})
	}
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

// Configuração parcial ou fora do padrão do XSD não gera DPS: enviar renderia
// E1235 na Sefin, e omitir o grupo em silêncio esconderia o problema.
func TestDPSBuilder_IBSCBS_ConfiguracaoInvalida(t *testing.T) {
	cases := []struct {
		nome                   string
		cst, cClassTrib, indOp string
		wantCampo              string
	}{
		{"só CST", testCST, "", "", "empresa.ibscbs_cclasstrib_padrao"},
		{"sem cIndOp", testCST, testCClassTrib, "", "empresa.ibscbs_cindop_padrao"},
		{"sem CST", "", testCClassTrib, testCIndOp, "empresa.ibscbs_cst_padrao"},
		{"CST com 2 dígitos", "00", testCClassTrib, testCIndOp, "empresa.ibscbs_cst_padrao"},
		{"cClassTrib com letra", testCST, "00000A", testCIndOp, "empresa.ibscbs_cclasstrib_padrao"},
		{"cIndOp com 7 dígitos", testCST, testCClassTrib, "1003010", "empresa.ibscbs_cindop_padrao"},
	}
	for _, c := range cases {
		t.Run(c.nome, func(t *testing.T) {
			emp := empresaSN()
			emp.IBSCBSCST, emp.IBSCBSCClassTrib, emp.IBSCBSCIndOp = c.cst, c.cClassTrib, c.indOp
			_, err := NewDPSBuilder().Build(baseRequest(), emp, 1)
			var ve *ErrValidation
			if !isValidationError(err, &ve) {
				t.Fatalf("esperado *ErrValidation, veio %T: %v", err, err)
			}
			if ve.Field != c.wantCampo {
				t.Errorf("campo do erro = %q, esperado %q", ve.Field, c.wantCampo)
			}
		})
	}
}

// Espaços em volta (digitação no cadastro) não invalidam nem vazam para o XML.
func TestDPSBuilder_IBSCBS_IgnoraEspacos(t *testing.T) {
	emp := empresaLP()
	emp.IBSCBSCST, emp.IBSCBSCClassTrib, emp.IBSCBSCIndOp = " 000 ", "000001 ", " 100301"
	naoRetido := false
	req := baseRequest()
	req.IssRetido = &naoRetido
	result, err := NewDPSBuilder().Build(req, emp, 1)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	if !strings.Contains(string(result.XML), ibscbsEsperado) {
		t.Errorf("grupo IBSCBS esperado não encontrado:\n%s", result.XML)
	}
}
