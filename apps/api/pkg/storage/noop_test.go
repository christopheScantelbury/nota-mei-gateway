package storage_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/storage"
)

func TestNoopStore_PutAndGet(t *testing.T) {
	ctx := context.Background()
	s := storage.NewNoopStore()

	data := []byte("<xml>test</xml>")
	if err := s.Put(ctx, "notas/mei-1/nota-1/rps.xml", "application/xml", data); err != nil {
		t.Fatalf("Put: %v", err)
	}

	got, err := s.Get(ctx, "notas/mei-1/nota-1/rps.xml")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if string(got) != string(data) {
		t.Errorf("Get = %q, want %q", got, data)
	}
}

func TestNoopStore_GetNotFound(t *testing.T) {
	ctx := context.Background()
	s := storage.NewNoopStore()

	_, err := s.Get(ctx, "notas/nonexistent.xml")
	if err == nil {
		t.Error("expected error for missing key, got nil")
	}
}

func TestNoopStore_Has(t *testing.T) {
	ctx := context.Background()
	s := storage.NewNoopStore()

	if s.Has("somekey") {
		t.Error("Has should return false for missing key")
	}
	_ = s.Put(ctx, "somekey", "application/xml", []byte("data"))
	if !s.Has("somekey") {
		t.Error("Has should return true after Put")
	}
}

func TestNoopStore_PresignedURL(t *testing.T) {
	ctx := context.Background()
	s := storage.NewNoopStore()

	url, err := s.PresignedURL(ctx, "notas/mei-1/nota-1/rps.xml", 15*time.Minute)
	if err != nil {
		t.Fatalf("PresignedURL: %v", err)
	}
	if !strings.Contains(url, "notas/mei-1/nota-1/rps.xml") {
		t.Errorf("URL should contain key, got: %s", url)
	}
	if !strings.Contains(url, "ttl=900") {
		t.Errorf("URL should contain ttl=900 (15 min), got: %s", url)
	}
}

func TestS3KeyHelpers(t *testing.T) {
	meiID := "mei-abc"
	notaID := "nota-xyz"

	if got := storage.S3KeyForRPS(meiID, notaID); got != "notas/mei-abc/nota-xyz/rps.xml" {
		t.Errorf("S3KeyForRPS = %q", got)
	}
	if got := storage.S3KeyForNFSe(meiID, notaID); got != "notas/mei-abc/nota-xyz/nfse.xml" {
		t.Errorf("S3KeyForNFSe = %q", got)
	}
	if got := storage.S3KeyForPDF(meiID, notaID); got != "notas/mei-abc/nota-xyz/nfse.pdf" {
		t.Errorf("S3KeyForPDF = %q", got)
	}
}
