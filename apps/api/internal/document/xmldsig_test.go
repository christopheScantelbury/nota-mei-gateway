package document_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/document"
)

// selfSignedRSACert generates a minimal RSA-2048 self-signed certificate for
// testing purposes. The certificate and private key are returned as an
// in-memory *tls.Certificate — no disk access occurs.
func selfSignedRSACert(t *testing.T) *tls.Certificate {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("rsa.GenerateKey: %v", err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "Test MEI", Organization: []string{"ScantelburyDevs"}},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("x509.CreateCertificate: %v", err)
	}
	return &tls.Certificate{
		Certificate: [][]byte{der},
		PrivateKey:  key,
	}
}

// minimalRPS is a stripped-down GerarNfseEnvio document as produced by Builder.
const minimalRPS = `<?xml version="1.0" encoding="UTF-8"?>
<GerarNfseEnvio xmlns="http://www.abrasf.org.br/ABRASF/arquivos/nfse.xsd">
  <Rps>
    <InfDeclaracaoPrestacaoServico>
      <Rps>
        <IdentificacaoRps>
          <Numero>1</Numero>
          <Serie>1</Serie>
          <Tipo>1</Tipo>
        </IdentificacaoRps>
        <DataEmissao>2026-05-01T00:00:00</DataEmissao>
        <Status>1</Status>
      </Rps>
      <Competencia>2026-05-01</Competencia>
      <Servico>
        <Valores>
          <ValorServicos>3500.00</ValorServicos>
          <AliquotaISS>0.02</AliquotaISS>
        </Valores>
        <CodigoNbs>0101</CodigoNbs>
        <Discriminacao>Desenvolvimento de software</Discriminacao>
        <CodigoMunicipio>3550308</CodigoMunicipio>
        <ExigibilidadeISS>1</ExigibilidadeISS>
      </Servico>
      <Prestador><CpfCnpj><Cnpj>12345678000190</Cnpj></CpfCnpj></Prestador>
      <Tomador>
        <IdentificacaoTomador><CpfCnpj><Cnpj>09876543000100</Cnpj></CpfCnpj></IdentificacaoTomador>
        <RazaoSocial>Empresa Cliente LTDA</RazaoSocial>
      </Tomador>
      <OptanteSimplesNacional>1</OptanteSimplesNacional>
      <IncentivoFiscal>2</IncentivoFiscal>
    </InfDeclaracaoPrestacaoServico>
  </Rps>
</GerarNfseEnvio>`

const minimalCancelamento = `<?xml version="1.0" encoding="UTF-8"?>
<CancelarNfseEnvio xmlns="http://www.abrasf.org.br/ABRASF/arquivos/nfse.xsd">
  <Pedido>
    <InfPedidoCancelamento>
      <IdentificacaoNfse>
        <Numero>123</Numero>
        <CpfCnpjPrestador><Cnpj>12345678000190</Cnpj></CpfCnpjPrestador>
        <CodigoMunicipio>3550308</CodigoMunicipio>
      </IdentificacaoNfse>
      <CodigoCancelamento>1</CodigoCancelamento>
    </InfPedidoCancelamento>
  </Pedido>
</CancelarNfseEnvio>`

// ─── XMLDSigSigner tests ───────────────────────────────────────────────────

func TestXMLDSigSigner_EmissionContainsSignature(t *testing.T) {
	signed, err := document.XMLDSigSigner{}.Sign(context.Background(), []byte(minimalRPS), selfSignedRSACert(t))
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	s := string(signed)

	checks := []struct {
		desc    string
		snippet string
	}{
		{"Signature element", `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">`},
		{"SignedInfo element", "<SignedInfo"},
		{"SignatureValue element", "<SignatureValue>"},
		{"X509Certificate element", "<X509Certificate>"},
		{"DigestValue element", "<DigestValue>"},
		{"Id attribute on signed element", `Id="InfDeclaracaoPrestacaoServico"`},
		{"Reference URI", `URI="#InfDeclaracaoPrestacaoServico"`},
		{"RSA-SHA256 algorithm", "rsa-sha256"},
	}
	for _, c := range checks {
		if !strings.Contains(s, c.snippet) {
			t.Errorf("%s: snippet %q not found in signed document", c.desc, c.snippet)
		}
	}
}

func TestXMLDSigSigner_DigestValueIsValidBase64(t *testing.T) {
	signed, err := document.XMLDSigSigner{}.Sign(context.Background(), []byte(minimalRPS), selfSignedRSACert(t))
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	s := string(signed)
	start := strings.Index(s, "<DigestValue>") + len("<DigestValue>")
	end := strings.Index(s, "</DigestValue>")
	if start <= len("<DigestValue>") || end < 0 {
		t.Fatal("DigestValue not found")
	}
	dv := s[start:end]
	if _, err := base64.StdEncoding.DecodeString(dv); err != nil {
		t.Errorf("DigestValue %q is not valid base64: %v", dv, err)
	}
}

func TestXMLDSigSigner_SignatureValueIsValidBase64(t *testing.T) {
	signed, err := document.XMLDSigSigner{}.Sign(context.Background(), []byte(minimalRPS), selfSignedRSACert(t))
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	s := string(signed)
	start := strings.Index(s, "<SignatureValue>") + len("<SignatureValue>")
	end := strings.Index(s, "</SignatureValue>")
	if start <= len("<SignatureValue>") || end < 0 {
		t.Fatal("SignatureValue not found")
	}
	sv := s[start:end]
	if _, err := base64.StdEncoding.DecodeString(sv); err != nil {
		t.Errorf("SignatureValue %q is not valid base64: %v", sv, err)
	}
}

func TestXMLDSigSigner_DocumentStructurePreserved(t *testing.T) {
	signed, err := document.XMLDSigSigner{}.Sign(context.Background(), []byte(minimalRPS), selfSignedRSACert(t))
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	s := strings.TrimSpace(string(signed))

	if !strings.HasPrefix(s, "<?xml") {
		t.Error("signed document should start with XML declaration")
	}
	if !strings.HasSuffix(s, "</GerarNfseEnvio>") {
		tail := s
		if len(tail) > 60 {
			tail = "..." + tail[len(tail)-60:]
		}
		t.Errorf("signed document should end with </GerarNfseEnvio>, got: %s", tail)
	}
}

func TestXMLDSigSigner_SignaturePositionedAfterSignedElement(t *testing.T) {
	signed, err := document.XMLDSigSigner{}.Sign(context.Background(), []byte(minimalRPS), selfSignedRSACert(t))
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	s := string(signed)

	closeInf := strings.Index(s, "</InfDeclaracaoPrestacaoServico>")
	openSig := strings.Index(s, "<Signature")
	if closeInf < 0 || openSig < 0 {
		t.Fatal("required elements not found")
	}
	if openSig < closeInf {
		t.Error("<Signature> must appear after </InfDeclaracaoPrestacaoServico>")
	}
}

func TestXMLDSigSigner_CancellationDocument(t *testing.T) {
	signed, err := document.XMLDSigSigner{}.Sign(context.Background(), []byte(minimalCancelamento), selfSignedRSACert(t))
	if err != nil {
		t.Fatalf("Sign cancellation: %v", err)
	}
	s := string(signed)

	if !strings.Contains(s, `Id="InfPedidoCancelamento"`) {
		t.Error("cancellation document must have Id on InfPedidoCancelamento")
	}
	if !strings.Contains(s, `URI="#InfPedidoCancelamento"`) {
		t.Error("Reference URI must point to InfPedidoCancelamento")
	}
	if !strings.Contains(s, "<Signature") {
		t.Error("cancellation document must contain <Signature>")
	}
}

// ─── Error handling ────────────────────────────────────────────────────────

func TestXMLDSigSigner_NilCertError(t *testing.T) {
	_, err := document.XMLDSigSigner{}.Sign(context.Background(), []byte(minimalRPS), nil)
	if err == nil {
		t.Error("expected error for nil certificate, got nil")
	}
}

func TestXMLDSigSigner_NilPrivateKeyError(t *testing.T) {
	cert := &tls.Certificate{
		Certificate: [][]byte{{0x30, 0x02, 0x05, 0x00}},
		PrivateKey:  nil,
	}
	_, err := document.XMLDSigSigner{}.Sign(context.Background(), []byte(minimalRPS), cert)
	if err == nil {
		t.Error("expected error for nil private key, got nil")
	}
}

func TestXMLDSigSigner_NoKnownElementError(t *testing.T) {
	xml := `<?xml version="1.0"?><Root><Unknown>x</Unknown></Root>`
	_, err := document.XMLDSigSigner{}.Sign(context.Background(), []byte(xml), selfSignedRSACert(t))
	if err == nil {
		t.Error("expected error when no known signable element found")
	}
}

// ─── Idempotency check (same cert → deterministic canonical form) ──────────

func TestXMLDSigSigner_DigestIsDeterministic(t *testing.T) {
	// DigestValue depends only on the canonical element, not on randomness.
	// Two Sign calls on the same doc+cert must produce the same DigestValue.
	cert := selfSignedRSACert(t)

	extractDigest := func(signed []byte) string {
		s := string(signed)
		start := strings.Index(s, "<DigestValue>") + len("<DigestValue>")
		end := strings.Index(s, "</DigestValue>")
		if start <= len("<DigestValue>") || end < 0 {
			return ""
		}
		return s[start:end]
	}

	s1, err := document.XMLDSigSigner{}.Sign(context.Background(), []byte(minimalRPS), cert)
	if err != nil {
		t.Fatalf("Sign #1: %v", err)
	}
	s2, err := document.XMLDSigSigner{}.Sign(context.Background(), []byte(minimalRPS), cert)
	if err != nil {
		t.Fatalf("Sign #2: %v", err)
	}

	d1 := extractDigest(s1)
	d2 := extractDigest(s2)
	if d1 == "" {
		t.Fatal("DigestValue not found in first signed document")
	}
	if d1 != d2 {
		t.Errorf("DigestValue is not deterministic: %q != %q", d1, d2)
	}
}

// ─── NoopSigner still works ────────────────────────────────────────────────

func TestNoopSigner_ReturnsUnchangedDocument(t *testing.T) {
	original := []byte(minimalRPS)
	result, err := document.NoopSigner{}.Sign(context.Background(), original, nil)
	if err != nil {
		t.Fatalf("NoopSigner.Sign: %v", err)
	}
	if string(result) != string(original) {
		t.Error("NoopSigner should return the document unchanged")
	}
}
