package cert

import (
	"fmt"
	"time"

	// Same reasoning as provider.go: the standard x/crypto/pkcs12 only accepts
	// exactly two safe bags, which rejects ICP-Brasil A1 certificates that bundle
	// the intermediate + root CA chain. Using the sslmate fork keeps PFX
	// expiry parsing consistent with the upload path.
	pkcs12 "software.sslmate.com/src/go-pkcs12"
)

// PFXNotAfter parses a PFX/P12 file in-memory and returns the NotAfter date
// of the leaf (end-entity) certificate.
//
// Used by CertificateHandler to persist cert_valid_until so the dashboard can
// display an expiry alert 30 days before the cert expires. The private key is
// never retained beyond this call.
func PFXNotAfter(pfxData []byte, password string) (time.Time, error) {
	// DecodeChain handles chained ICP-Brasil PFX bundles (3+ safe bags).
	_, leaf, _, err := pkcs12.DecodeChain(pfxData, password)
	if err != nil {
		return time.Time{}, fmt.Errorf("cert.PFXNotAfter: decode PKCS12: %w", err)
	}
	if leaf == nil {
		return time.Time{}, fmt.Errorf("cert.PFXNotAfter: leaf certificate is nil")
	}
	return leaf.NotAfter, nil
}
