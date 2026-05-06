// Package document — XMLDSig (XML Digital Signature) implementation.
//
// ABRASF NFS-e Nacional v1.2 requires RSA-SHA1 signing with inclusive C14N
// (http://www.w3.org/TR/2001/REC-xml-c14n-20010315).
//
// The signed element is identified by an Id attribute injected by Sign().
// The <Signature> block is placed as an enveloped sibling of the signed
// element (inside the same parent, immediately after the closing tag).
//
// Security properties:
//   - Private key never leaves memory — Sign() receives a *tls.Certificate.
//   - The X.509 leaf certificate is embedded in <KeyInfo> so Receita Federal
//     can verify the signature without a separate out-of-band key lookup.
package document

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1" //nolint:gosec // SHA-1 is mandated by ABRASF spec
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"fmt"
	"strings"
)

// W3C XMLDSig algorithm URIs required by ABRASF.
const (
	// c14nAlgorithm is the Canonical XML 1.0 (inclusive) algorithm.
	c14nAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
	// sigAlgorithm is RSA with SHA-1 (mandatory for ABRASF NFS-e Nacional v1.2).
	sigAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1"
	// digestAlgorithm is SHA-1 digest method.
	digestAlgorithm = "http://www.w3.org/2000/09/xmldsig#sha1"
	// envelopedTransform removes the <Signature> element before hashing.
	envelopedTransform = "http://www.w3.org/2000/09/xmldsig#enveloped-signature"
	// xmlDSigNS is the XMLDSig namespace.
	xmlDSigNS = "http://www.w3.org/2000/09/xmldsig#"
)

// signableElements are the element names we know how to sign, checked
// in priority order (RPS emission first, then DPS, then cancellation).
var signableElements = []string{
	"InfDeclaracaoPrestacaoServico", // POST /nfse — MEI RPS emission (ABRASF)
	"infDPS",                        // POST /nfse — ME/EPP DPS emission (SEFIN Nacional)
	"InfPedidoCancelamento",         // DELETE /nfse/:id — cancellation
}

// XMLDSigSigner signs RPS and cancellation XML documents according to
// ABRASF NFS-e Nacional v1.2 using RSA-SHA1 with inclusive C14N.
//
// Use this in staging and production environments; use NoopSigner in
// local development where no real A1 certificate is available.
type XMLDSigSigner struct{}

// Sign injects a well-formed <Signature> element into xmlDoc.
//
// Process:
//  1. Locate the first known signable element (e.g. InfDeclaracaoPrestacaoServico).
//  2. Inject Id="<ElementName>" attribute (required for URI reference in <Reference>).
//  3. Produce the inclusive C14N form of that element subtree (adds inherited xmlns).
//  4. SHA-1 digest → base64 DigestValue.
//  5. Build <SignedInfo> in canonical form (compact, no XML decl).
//  6. RSA-SHA1 sign the canonical <SignedInfo> bytes.
//  7. Assemble <Signature> with <SignatureValue> and X.509 <KeyInfo>.
//  8. Inject <Signature> as a sibling immediately after the signed element.
func (XMLDSigSigner) Sign(_ context.Context, xmlDoc []byte, cert *tls.Certificate) ([]byte, error) {
	if cert == nil {
		return nil, fmt.Errorf("xmldsig: certificate is required")
	}
	if cert.PrivateKey == nil {
		return nil, fmt.Errorf("xmldsig: certificate has no private key")
	}
	rsaKey, ok := cert.PrivateKey.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("xmldsig: certificate private key must be RSA (got %T)", cert.PrivateKey)
	}
	if len(cert.Certificate) == 0 {
		return nil, fmt.Errorf("xmldsig: certificate chain is empty")
	}
	leaf, err := x509.ParseCertificate(cert.Certificate[0])
	if err != nil {
		return nil, fmt.Errorf("xmldsig: parsing leaf certificate: %w", err)
	}

	// Identify which element to sign.
	elemName := ""
	for _, name := range signableElements {
		if bytes.Contains(xmlDoc, []byte("<"+name)) {
			elemName = name
			break
		}
	}
	if elemName == "" {
		return nil, fmt.Errorf("xmldsig: document contains no known signable element")
	}

	// Step 1 — Inject Id attribute (no-op when Id already present in struct).
	doc := injectIDAttr(xmlDoc, elemName)

	// Extract the actual Id value (may differ from elemName for DPS).
	// DPS uses Id="DPS000001"; RPS uses Id="InfDeclaracaoPrestacaoServico".
	idValue := extractIDValue(doc, elemName)

	// Step 2 — Extract and canonicalize the target element.
	canonical, err := c14nElement(doc, elemName, idValue)
	if err != nil {
		return nil, fmt.Errorf("xmldsig: c14n of %s: %w", elemName, err)
	}

	// Step 3 — SHA-1 digest.
	//nolint:gosec // SHA-1 mandated by ABRASF
	d := sha1.Sum(canonical)
	digestValue := base64.StdEncoding.EncodeToString(d[:])

	// Step 4 — Build <SignedInfo> (compact canonical form).
	// Use idValue so the URI reference matches the actual Id attribute.
	signedInfo := buildSignedInfo(idValue, digestValue)
	canonicalSI := []byte(signedInfo) // already canonical — no XML decl, compact

	// Step 5 — RSA-SHA1 sign.
	//nolint:gosec // SHA-1 mandated by ABRASF
	h := sha1.New()
	h.Write(canonicalSI)
	sigBytes, err := rsa.SignPKCS1v15(rand.Reader, rsaKey, crypto.SHA1, h.Sum(nil))
	if err != nil {
		return nil, fmt.Errorf("xmldsig: RSA sign: %w", err)
	}
	sigValue := base64.StdEncoding.EncodeToString(sigBytes)

	// Step 6 — Embed X.509 certificate in KeyInfo.
	certB64 := base64.StdEncoding.EncodeToString(leaf.Raw)

	// Step 7 — Assemble <Signature>.
	sigBlock := assembleSignature(signedInfo, sigValue, certB64)

	// Step 8 — Inject into document.
	return insertSignature(doc, elemName, sigBlock), nil
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// injectIDAttr adds Id="<elemName>" to the opening tag of elemName.
// If the attribute is already present the document is returned unchanged.
func injectIDAttr(xmlDoc []byte, elemName string) []byte {
	// Quick check: already has Id attribute?
	if bytes.Contains(xmlDoc, []byte(`<`+elemName+` Id="`)) {
		return xmlDoc
	}

	// Case A: <ElemName> (no attributes yet)
	simpleOpen := []byte("<" + elemName + ">")
	if bytes.Contains(xmlDoc, simpleOpen) {
		repl := []byte(`<` + elemName + ` Id="` + elemName + `">`)
		return bytes.Replace(xmlDoc, simpleOpen, repl, 1)
	}

	// Case B: <ElemName attr="…"> (already has other attributes)
	withSpace := []byte("<" + elemName + " ")
	if bytes.Contains(xmlDoc, withSpace) {
		repl := []byte(`<` + elemName + ` Id="` + elemName + `" `)
		return bytes.Replace(xmlDoc, withSpace, repl, 1)
	}

	return xmlDoc
}

// c14nElement extracts the named element (with its Id attribute present) and
// returns its inclusive C14N form:
//   - The document's default namespace is promoted from the ancestor root element
//     onto the extracted element (per C14N 1.0 §2.4 — inherited namespaces must
//     be rendered on the root of an extracted subtree).
//   - All whitespace and text content inside is preserved verbatim.
//   - No XML declaration is prepended.
//
// idValue is the actual Id attribute value (e.g. "InfDeclaracaoPrestacaoServico"
// for RPS, or "DPS000001" for DPS).
func c14nElement(xmlDoc []byte, elemName, idValue string) ([]byte, error) {
	s := string(xmlDoc)

	// Look for the opening tag with the actual Id value.
	openTag := "<" + elemName + ` Id="` + idValue + `"`

	start := strings.Index(s, openTag)
	if start < 0 {
		return nil, fmt.Errorf("element %q with Id=%q not found", elemName, idValue)
	}

	closeTag := "</" + elemName + ">"
	end := strings.Index(s, closeTag)
	if end < 0 {
		return nil, fmt.Errorf("closing tag for %q not found", elemName)
	}
	end += len(closeTag)

	elem := s[start:end]

	// C14N requires all namespace declarations that are "in scope" from ancestor
	// elements to be rendered on the root of the extracted subtree.  Our document
	// has exactly one namespace (declared on the root element), and it must appear
	// on this element.
	//
	// Detect which namespace the document uses: ABRASF (RPS) or SEFIN (DPS).
	//
	// Per C14N attribute ordering rules: namespace declarations (xmlns:*) come
	// before regular attributes; the default xmlns comes before any prefixed
	// declarations; regular attributes are sorted by expanded name.
	// Result: xmlns="<detected-ns>" Id="<idValue>"
	if !strings.Contains(elem, "xmlns=") {
		ns := detectDocNamespace(s)
		elem = strings.Replace(
			elem,
			"<"+elemName+` Id="`+idValue+`"`,
			"<"+elemName+` xmlns="`+ns+`" Id="`+idValue+`"`,
			1,
		)
	}

	return []byte(elem), nil
}

// extractIDValue returns the Id attribute value of the first occurrence of
// elemName in xmlDoc.  If the element has no Id attribute, it falls back to
// elemName (matching the legacy RPS behaviour where injectIDAttr sets Id=elemName).
func extractIDValue(xmlDoc []byte, elemName string) string {
	s := string(xmlDoc)
	prefix := "<" + elemName + ` Id="`
	idx := strings.Index(s, prefix)
	if idx < 0 {
		return elemName
	}
	rest := s[idx+len(prefix):]
	endIdx := strings.Index(rest, `"`)
	if endIdx < 0 {
		return elemName
	}
	return rest[:endIdx]
}

// detectDocNamespace returns the default XML namespace declared on the root
// element of the document.  Falls back to the ABRASF namespace when not found
// so that existing RPS documents are not affected.
func detectDocNamespace(xmlDoc string) string {
	const nsPrefix = `xmlns="`
	idx := strings.Index(xmlDoc, nsPrefix)
	if idx < 0 {
		return abrasf
	}
	rest := xmlDoc[idx+len(nsPrefix):]
	endIdx := strings.Index(rest, `"`)
	if endIdx < 0 {
		return abrasf
	}
	return rest[:endIdx]
}

// buildSignedInfo returns the compact <SignedInfo> XML that will be signed.
// It is already in canonical form: no XML declaration, namespace on the root
// element, empty elements expanded, no extraneous whitespace.
func buildSignedInfo(refID, digestValue string) string {
	var b strings.Builder
	b.WriteString(`<SignedInfo xmlns="`)
	b.WriteString(xmlDSigNS)
	b.WriteString(`">`)
	b.WriteString(`<CanonicalizationMethod Algorithm="`)
	b.WriteString(c14nAlgorithm)
	b.WriteString(`"></CanonicalizationMethod>`)
	b.WriteString(`<SignatureMethod Algorithm="`)
	b.WriteString(sigAlgorithm)
	b.WriteString(`"></SignatureMethod>`)
	b.WriteString(`<Reference URI="#`)
	b.WriteString(refID)
	b.WriteString(`">`)
	b.WriteString(`<Transforms>`)
	b.WriteString(`<Transform Algorithm="`)
	b.WriteString(envelopedTransform)
	b.WriteString(`"></Transform>`)
	b.WriteString(`<Transform Algorithm="`)
	b.WriteString(c14nAlgorithm)
	b.WriteString(`"></Transform>`)
	b.WriteString(`</Transforms>`)
	b.WriteString(`<DigestMethod Algorithm="`)
	b.WriteString(digestAlgorithm)
	b.WriteString(`"></DigestMethod>`)
	b.WriteString(`<DigestValue>`)
	b.WriteString(digestValue)
	b.WriteString(`</DigestValue>`)
	b.WriteString(`</Reference>`)
	b.WriteString(`</SignedInfo>`)
	return b.String()
}

// assembleSignature builds the complete <Signature> element from its parts.
func assembleSignature(signedInfo, sigValue, certB64 string) string {
	var b strings.Builder
	b.WriteString(`<Signature xmlns="`)
	b.WriteString(xmlDSigNS)
	b.WriteString(`">`)
	b.WriteString(signedInfo)
	b.WriteString(`<SignatureValue>`)
	b.WriteString(sigValue)
	b.WriteString(`</SignatureValue>`)
	b.WriteString(`<KeyInfo>`)
	b.WriteString(`<X509Data>`)
	b.WriteString(`<X509Certificate>`)
	b.WriteString(certB64)
	b.WriteString(`</X509Certificate>`)
	b.WriteString(`</X509Data>`)
	b.WriteString(`</KeyInfo>`)
	b.WriteString(`</Signature>`)
	return b.String()
}

// insertSignature injects the <Signature> block into the document immediately
// after the closing tag of the signed element (enveloped-signature pattern).
func insertSignature(xmlDoc []byte, elemName string, sig string) []byte {
	closeTag := []byte("</" + elemName + ">")
	idx := bytes.Index(xmlDoc, closeTag)
	if idx < 0 {
		// Fallback: append at end.
		return append(xmlDoc, []byte("\n"+sig)...)
	}
	insertPos := idx + len(closeTag)

	out := make([]byte, 0, len(xmlDoc)+len(sig)+1)
	out = append(out, xmlDoc[:insertPos]...)
	out = append(out, '\n')
	out = append(out, []byte(sig)...)
	out = append(out, xmlDoc[insertPos:]...)
	return out
}
