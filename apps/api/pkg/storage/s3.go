package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// S3Store implements ObjectStore backed by AWS S3.
// All objects are stored with server-side encryption (AES-256).
type S3Store struct {
	client  *s3.Client
	presign *s3.PresignClient
	bucket  string
}

// NewS3Store creates an S3Store for the given bucket.
// It loads credentials from the default AWS credential chain (env vars,
// IAM role, ~/.aws/credentials) using the provided region.
func NewS3Store(ctx context.Context, region, bucket string) (*S3Store, error) {
	if bucket == "" {
		return nil, fmt.Errorf("storage: S3_BUCKET_NOTAS não configurado")
	}
	cfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("storage: falha ao carregar configuração AWS: %w", err)
	}
	client := s3.NewFromConfig(cfg)
	presign := s3.NewPresignClient(client)
	return &S3Store{client: client, presign: presign, bucket: bucket}, nil
}

// Put uploads data to S3 with server-side encryption (AES256).
func (s *S3Store) Put(ctx context.Context, key, contentType string, data []byte) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:               aws.String(s.bucket),
		Key:                  aws.String(key),
		Body:                 bytes.NewReader(data),
		ContentType:          aws.String(contentType),
		ContentLength:        aws.Int64(int64(len(data))),
		ServerSideEncryption: types.ServerSideEncryptionAes256,
	})
	if err != nil {
		return fmt.Errorf("storage: PutObject %s: %w", key, err)
	}
	return nil
}

// Get downloads and returns the raw bytes for the given key.
func (s *S3Store) Get(ctx context.Context, key string) ([]byte, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("storage: GetObject %s: %w", key, err)
	}
	defer func() { _ = out.Body.Close() }()
	data, err := io.ReadAll(out.Body)
	if err != nil {
		return nil, fmt.Errorf("storage: read body %s: %w", key, err)
	}
	return data, nil
}

// PresignedURL generates a pre-signed GET URL valid for ttl.
func (s *S3Store) PresignedURL(ctx context.Context, key string, ttl time.Duration) (string, error) {
	req, err := s.presign.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", fmt.Errorf("storage: presign %s: %w", key, err)
	}
	return req.URL, nil
}
