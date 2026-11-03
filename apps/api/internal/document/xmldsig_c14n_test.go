package document_test

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/xml"
	"regexp"
	"strings"
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/document"
)

// Regressão do E0714 (2026-11-03): discriminação com quebra de linha e aspas.
// O encoding/xml serializa "\n" como &#xA; e aspas como &#34;/&#39;; o C14N
// que a Receita recalcula usa os caracteres literais. O digest tem de ser o do
// C14N real, senão a nota é rejeitada com "erro na assinatura".
func TestXMLDSigSigner_DigestUsesCanonicalTextEscapes(t *testing.T) {
	desc := "Serviços de informática\n\nDados para depósito:\nBanco \"X\" d'Oeste\tAg 0001\nA & B <ME>"

	var esc strings.Builder
	if err := xml.EscapeText(&esc, []byte(desc)); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(esc.String(), "&#xA;") || !strings.Contains(esc.String(), "&#34;") {
		t.Fatalf("premissa do teste: encoding/xml deveria escapar \\n e aspas, veio %q", esc.String())
	}

	const ns = "http://www.sped.fazenda.gov.br/nfse"
	inner := "\n    <tpAmb>1</tpAmb>\n    <xDescServ>%s</xDescServ>\n  "
	doc := `<?xml version="1.0" encoding="UTF-8"?>` + "\n" +
		`<DPS xmlns="` + ns + `" versao="1.01">` + "\n" +
		`  <infDPS Id="DPS1">` + strings.Replace(inner, "%s", esc.String(), 1) + `</infDPS>` + "\n" +
		`</DPS>`

	signed, err := document.XMLDSigSigner{}.Sign(context.Background(), []byte(doc), selfSignedRSACert(t))
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}

	// Forma canônica esperada (C14N 1.0 inclusivo): xmlns herdado antes do Id;
	// no texto só &, <, > (e CR) ficam escapados — LF, TAB e aspas são literais.
	canonicalText := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(desc)
	want := `<infDPS xmlns="` + ns + `" Id="DPS1">` + strings.Replace(inner, "%s", canonicalText, 1) + `</infDPS>`
	sum := sha256.Sum256([]byte(want))
	wantDigest := base64.StdEncoding.EncodeToString(sum[:])

	m := regexp.MustCompile(`<DigestValue>([^<]+)</DigestValue>`).FindSubmatch(signed)
	if m == nil {
		t.Fatal("DigestValue ausente")
	}
	if got := string(m[1]); got != wantDigest {
		t.Errorf("digest não é o do C14N real\n got: %s\nwant: %s", got, wantDigest)
	}

	// O documento enviado continua com o texto escapado (XML válido inalterado).
	if !strings.Contains(string(signed), esc.String()) {
		t.Error("o texto do documento enviado não deve ser alterado pela assinatura")
	}
}

// Sem caracteres especiais o digest não muda em relação ao comportamento
// anterior (notas que já eram autorizadas continuam iguais).
func TestXMLDSigSigner_DigestUnchangedForPlainText(t *testing.T) {
	const ns = "http://www.sped.fazenda.gov.br/nfse"
	elem := `<infDPS Id="DPS2"><xDescServ>Desenvolvimento e produção de softwares</xDescServ></infDPS>`
	doc := `<?xml version="1.0" encoding="UTF-8"?><DPS xmlns="` + ns + `" versao="1.01">` + elem + `</DPS>`

	signed, err := document.XMLDSigSigner{}.Sign(context.Background(), []byte(doc), selfSignedRSACert(t))
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	sum := sha256.Sum256([]byte(strings.Replace(elem, `<infDPS Id=`, `<infDPS xmlns="`+ns+`" Id=`, 1)))
	want := base64.StdEncoding.EncodeToString(sum[:])
	if !strings.Contains(string(signed), "<DigestValue>"+want+"</DigestValue>") {
		t.Errorf("digest mudou para texto sem escapes (esperado %s)", want)
	}
}
