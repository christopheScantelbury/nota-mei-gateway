// Package cert provides access to A1 digital certificates stored in AWS Secrets Manager.
// Certificates are never written to disk — always kept in memory.
package cert

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/kms"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

// Provider retrieves A1 certificates from AWS Secrets Manager and wraps KMS for decryption.
type Provider struct {
	secrets *secretsmanager.Client
	kms     *kms.Client
}

// New loads AWS default configuration for the given region and returns a Provider.
func New(ctx context.Context, region string) (*Provider, error) {
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
	if err != nil {
		return nil, err
	}
	return &Provider{
		secrets: secretsmanager.NewFromConfig(cfg),
		kms:     kms.NewFromConfig(cfg),
	}, nil
}
