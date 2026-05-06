// Package document — XML signing for RPS documents.
// XMLDSig (XML Digital Signature) is required by ABRASF NFS-e Nacional v1.2.
package document

import (
	"context"
	"crypto/tls"
)

// Signer signs an RPS XML document with the MEI's A1 digital certificate.
// Implementations must inject the XML Signature envelope (xmldsig) without
// modifying the canonical form of the signed element.
//
// ctx is forwarded so callers can cancel or time-out the signing operation —
// particularly important when Sign is guarded by a worker pool (PooledSigner).
type Signer interface {
	// Sign receives the canonical XML bytes and returns the signed XML bytes.
	Sign(ctx context.Context, xmlDoc []byte, cert *tls.Certificate) ([]byte, error)
}

// NoopSigner is a development stub that returns the document unchanged.
// Replace with a real XMLDSig implementation before connecting to production.
type NoopSigner struct{}

// Sign returns the XML unchanged. For development and testing only.
func (NoopSigner) Sign(_ context.Context, xmlDoc []byte, _ *tls.Certificate) ([]byte, error) {
	return xmlDoc, nil
}
