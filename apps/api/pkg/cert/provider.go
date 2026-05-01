// Package cert provides access to A1 digital certificates stored in AWS Secrets Manager.
// Certificates are never written to disk — always kept in memory.
package cert

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/kms"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

// Provider retrieves A1 certificates from AWS Secrets Manager and wraps KMS for decryption.
type Provider struct {
	secrets *secretsmanager.Client
	kms     *kms.Client
}

// certSecret is the JSON structure stored in AWS Secrets Manager.
// The certificate and private key are stored as PEM-encoded strings.
type certSecret struct {
	CertPEM string `json:"cert_pem"`
	KeyPEM  string `json:"key_pem"`
}

// New loads AWS default configuration for the given region and returns a Provider.
func New(ctx context.Context, region string) (*Provider, error) {
	cfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(region))
	if err != nil {
		return nil, err
	}
	return &Provider{
		secrets: secretsmanager.NewFromConfig(cfg),
		kms:     kms.NewFromConfig(cfg),
	}, nil
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
