// Package storage defines the ObjectStore interface used to persist and retrieve
// fiscal documents (XML, PDF) from object storage.
//
// In production, the S3Store implementation uploads to AWS S3 with server-side
// encryption and returns pre-signed URLs for downloads.  In development and tests,
// NoopStore holds everything in memory and always returns a stub URL.
package storage

import (
	"context"
	"time"
)

// ObjectStore is the interface that all storage back-ends must satisfy.
type ObjectStore interface {
	// Put uploads data to the given key.  content-type should be either
	// "application/xml" or "application/pdf".
	Put(ctx context.Context, key, contentType string, data []byte) error

	// Get downloads and returns the raw bytes for the given key.
	Get(ctx context.Context, key string) ([]byte, error)

	// PresignedURL returns a time-limited download URL for the given key.
	// The URL is valid for at most ttl from the moment of the call.
	PresignedURL(ctx context.Context, key string, ttl time.Duration) (string, error)
}

// S3KeyForRPS returns the S3 object key for the signed RPS XML (sent to Receita).
//
//	notas/{meiID}/{notaID}/rps.xml
func S3KeyForRPS(meiID, notaID string) string {
	return "notas/" + meiID + "/" + notaID + "/rps.xml"
}

// S3KeyForNFSe returns the S3 object key for the NFS-e XML (returned by Receita).
//
//	notas/{meiID}/{notaID}/nfse.xml
func S3KeyForNFSe(meiID, notaID string) string {
	return "notas/" + meiID + "/" + notaID + "/nfse.xml"
}

// S3KeyForPDF returns the S3 object key for the generated NFS-e PDF.
//
//	notas/{meiID}/{notaID}/nfse.pdf
func S3KeyForPDF(meiID, notaID string) string {
	return "notas/" + meiID + "/" + notaID + "/nfse.pdf"
}
