// Package document — XML signing for RPS documents.
// XMLDSig (XML Digital Signature) is required by ABRASF NFS-e Nacional v1.2.
package document

import "crypto/tls"

// Signer signs an RPS XML document with the MEI's A1 digital certificate.
// Implementations must inject the XML Signature envelope (xmldsig) without
// modifying the canonical form of the signed element.
type Signer interface {
	// Sign receives the canonical XML bytes and returns the signed XML bytes.
	Sign(xmlDoc []byte, cert *tls.Certificate) ([]byte, error)
}

// NoopSigner is a development stub that returns the document unchanged.
// Replace with a real XMLDSig implementation before connecting to production.
type NoopSigner struct{}

// Sign returns the XML unchanged. For development and testing only.
func (NoopSigner) Sign(xmlDoc []byte, _ *tls.Certificate) ([]byte, error) {
	return xmlDoc, nil
}

