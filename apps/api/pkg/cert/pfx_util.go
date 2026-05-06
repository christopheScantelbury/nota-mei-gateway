package cert

import (
	"fmt"
	"time"

	"golang.org/x/crypto/pkcs12"
)

// PFXNotAfter parses a PFX/P12 file in-memory and returns the NotAfter date
// of the leaf (end-entity) certificate.
//
// Used by CertificateHandler to persist cert_valid_until on the empresa row so
// the dashboard can display an expiry alert 30 days before the cert expires.
// The private key is never retained beyond this call.
func PFXNotAfter(pfxData []byte, password string) (time.Time, error) {
	// pkcs12.Decode returns the private key, leaf cert and CA chain.
	// We only need the leaf cert — discard the rest immediately.
	_, cert, err := pkcs12.Decode(pfxData, password)
	if err != nil {
		return time.Time{}, fmt.Errorf("cert.PFXNotAfter: decode PKCS12: %w", err)
	}
	if cert == nil {
		return time.Time{}, fmt.Errorf("cert.PFXNotAfter: leaf certificate is nil")
	}
	return cert.NotAfter, nil
}
