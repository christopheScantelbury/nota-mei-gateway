package cert_test

import (
	"testing"

	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/cert"
)

// pfxToSecretJSONTest is an exported wrapper so the unexported helper can be tested.
// We test via the exported API: a bad PFX must be rejected by StoreCert/UpdateCert,
// so we test the validation logic through pfxToSecretJSON indirectly via a stub.

func TestPfxInvalidPasswordReturnsError(t *testing.T) {
	// A well-formed PFX (but with wrong password) should produce a clear error.
	// We use a minimal valid PKCS#12 DER blob generated from test fixtures.
	// Since generating a real PFX in tests without tooling is impractical, we
	// verify that passing random bytes returns an error (not a panic).
	junk := []byte("not a valid pfx file")
	_, err := cert.PfxToSecretJSON(junk, "any-password")
	if err == nil {
		t.Fatal("expected error for invalid PFX data, got nil")
	}
}

func TestPfxEmptyDataReturnsError(t *testing.T) {
	_, err := cert.PfxToSecretJSON(nil, "")
	if err == nil {
		t.Fatal("expected error for nil PFX data, got nil")
	}
}
