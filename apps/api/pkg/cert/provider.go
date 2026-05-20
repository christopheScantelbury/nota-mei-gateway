// Package cert provides access to A1 digital certificates stored in AWS Secrets Manager.
// Certificates are never written to disk — always kept in memory.
package cert

import (
	"context"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/kms"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
	// Use software.sslmate.com/src/go-pkcs12 instead of golang.org/x/crypto/pkcs12:
	// the official x/crypto package only accepts PFX files with exactly two
	// "safe bags" (cert + key), which rejects most Brazilian ICP-Brasil A1
	// certificates (Certisign, Serasa, SOLUTI, etc.) because they bundle the
	// intermediate + root CA chain = 3+ bags. The sslmate fork is the de-facto
	// permissive parser used in production for real-world certificates.
	pkcs12 "software.sslmate.com/src/go-pkcs12"
)

// CertProvider is the interface for retrieving and storing A1 certificates.
// Use Provider for AWS Secrets Manager; inject a mock in tests.
//
//nolint:revive // stutter is intentional — the full qualifier cert.CertProvider is unambiguous
type CertProvider interface {
	// GetCert retrieves the TLS certificate stored at the given ARN.
	// The certificate is returned in memory and never written to disk.
	GetCert(ctx context.Context, secretARN string) (*tls.Certificate, error)

	// StoreCert converts a PFX/P12 file to PEM, creates a new secret in AWS
	// Secrets Manager and returns the ARN of the created secret.
	// The name must be unique within the account+region.
	StoreCert(ctx context.Context, name string, pfxData []byte, password string) (arn string, err error)

	// UpdateCert replaces the certificate stored at secretARN with the new
	// PFX/P12 file. The existing secret value is overwritten in-place.
	UpdateCert(ctx context.Context, secretARN string, pfxData []byte, password string) error
}

// Provider retrieves and stores A1 certificates via AWS Secrets Manager,
// using AWS KMS for envelope encryption at rest.
type Provider struct {
	secrets   *secretsmanager.Client
	kms       *kms.Client
	kmsKeyARN string // optional CMK ARN; if empty, AWS-managed key is used
}

// certSecret is the JSON structure stored in AWS Secrets Manager.
// The certificate and private key are stored as PEM-encoded strings.
type certSecret struct {
	CertPEM string `json:"cert_pem"`
	KeyPEM  string `json:"key_pem"`
}

// New loads AWS default configuration for the given region and returns a Provider.
// kmsKeyARN may be empty; if set, it is used as the KMS CMK for new secrets.
func New(ctx context.Context, region string, kmsKeyARN ...string) (*Provider, error) {
	cfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(region))
	if err != nil {
		return nil, err
	}
	p := &Provider{
		secrets: secretsmanager.NewFromConfig(cfg),
		kms:     kms.NewFromConfig(cfg),
	}
	if len(kmsKeyARN) > 0 {
		p.kmsKeyARN = kmsKeyARN[0]
	}
	return p, nil
}

// GetCert retrieves and parses the TLS certificate stored at the given ARN.
// The secret must contain a JSON object with "cert_pem" and "key_pem" fields.
// The certificate is returned in memory and never written to disk.
func (p *Provider) GetCert(ctx context.Context, secretARN string) (*tls.Certificate, error) {
	out, err := p.secrets.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{
		SecretId: aws.String(secretARN),
	})
	if err != nil {
		return nil, fmt.Errorf("get secret %s: %w", secretARN, err)
	}

	if out.SecretString == nil {
		return nil, fmt.Errorf("secret %s has no string value", secretARN)
	}

	var cs certSecret
	if err := json.Unmarshal([]byte(*out.SecretString), &cs); err != nil {
		return nil, fmt.Errorf("parse secret JSON: %w", err)
	}

	cert, err := tls.X509KeyPair([]byte(cs.CertPEM), []byte(cs.KeyPEM))
	if err != nil {
		return nil, fmt.Errorf("parse certificate: %w", err)
	}
	return &cert, nil
}

// StoreCert converts pfxData (PFX/P12 format) to PEM, creates a new secret
// in AWS Secrets Manager, and returns the ARN of the created secret.
// The certificate private key is never written to disk or logged.
func (p *Provider) StoreCert(ctx context.Context, name string, pfxData []byte, password string) (string, error) {
	secretVal, err := pfxToSecretJSON(pfxData, password)
	if err != nil {
		return "", fmt.Errorf("parse PFX: %w", err)
	}

	in := &secretsmanager.CreateSecretInput{
		Name:         aws.String(name),
		SecretString: aws.String(secretVal),
	}
	if p.kmsKeyARN != "" {
		in.KmsKeyId = aws.String(p.kmsKeyARN)
	}

	out, err := p.secrets.CreateSecret(ctx, in)
	if err != nil {
		return "", fmt.Errorf("create secret %s: %w", name, err)
	}
	return aws.ToString(out.ARN), nil
}

// UpdateCert replaces the certificate stored at secretARN.
// The existing secret value is overwritten in-place; the ARN remains unchanged.
func (p *Provider) UpdateCert(ctx context.Context, secretARN string, pfxData []byte, password string) error {
	secretVal, err := pfxToSecretJSON(pfxData, password)
	if err != nil {
		return fmt.Errorf("parse PFX: %w", err)
	}

	_, err = p.secrets.PutSecretValue(ctx, &secretsmanager.PutSecretValueInput{
		SecretId:     aws.String(secretARN),
		SecretString: aws.String(secretVal),
	})
	if err != nil {
		return fmt.Errorf("put secret %s: %w", secretARN, err)
	}
	return nil
}

// ── helpers ──────────────────────────────────────────────────────────────────

// PfxToSecretJSON decodes a PFX/P12 file, validates it contains an RSA key,
// and returns the JSON string suitable for storing in Secrets Manager.
// The raw PFX bytes and password are NOT included in the returned value.
// Exported so integration/unit tests can exercise PFX validation without AWS.
func PfxToSecretJSON(pfxData []byte, password string) (string, error) {
	return pfxToSecretJSON(pfxData, password)
}

func pfxToSecretJSON(pfxData []byte, password string) (string, error) {
	// DecodeChain returns the leaf cert + any intermediate certs bundled in the
	// PFX. We need the chain for XMLDSig signatures: the Receita Federal NFS-e
	// validator requires the leaf and (optionally) the intermediate ICP-Brasil
	// cert in <X509Certificate> elements.
	privateKey, certificate, caCerts, err := pkcs12.DecodeChain(pfxData, password)
	if err != nil {
		return "", fmt.Errorf("decode PKCS12: %w", err)
	}

	// Validate the private key is RSA (required by ABRASF NFS-e Nacional).
	if _, ok := privateKey.(*rsa.PrivateKey); !ok {
		return "", fmt.Errorf("certificate private key must be RSA (got %T)", privateKey)
	}

	// Encode leaf certificate to PEM, then append intermediate certs (chain order
	// matters for ABRASF validators — leaf first, then issuing CA).
	certPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: certificate.Raw,
	})
	for _, ca := range caCerts {
		certPEM = append(certPEM, pem.EncodeToMemory(&pem.Block{
			Type:  "CERTIFICATE",
			Bytes: ca.Raw,
		})...)
	}

	// Encode private key to PKCS#8 PEM.
	keyDER, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		return "", fmt.Errorf("marshal private key: %w", err)
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: keyDER,
	})

	cs := certSecret{
		CertPEM: string(certPEM),
		KeyPEM:  string(keyPEM),
	}
	b, err := json.Marshal(cs)
	if err != nil {
		return "", fmt.Errorf("marshal secret JSON: %w", err)
	}
	return string(b), nil
}
