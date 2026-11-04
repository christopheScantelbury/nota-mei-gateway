package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// SupabaseStore implementa ObjectStore no Supabase Storage (bucket privado),
// via API REST com a service role. Substitui o S3 da AWS (conta encerrada em
// 2026-11-03). Downloads usam URL assinada com validade, como o presign do S3.
type SupabaseStore struct {
	baseURL    string // https://<ref>.supabase.co
	serviceKey string
	bucket     string
	http       *http.Client
}

// NewSupabaseStore cria o store. bucket precisa existir e ser privado.
func NewSupabaseStore(projectURL, serviceKey, bucket string) (*SupabaseStore, error) {
	if projectURL == "" || serviceKey == "" || bucket == "" {
		return nil, fmt.Errorf("storage: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e bucket são obrigatórios")
	}
	return &SupabaseStore{
		baseURL:    strings.TrimRight(projectURL, "/"),
		serviceKey: serviceKey,
		bucket:     bucket,
		http:       &http.Client{Timeout: 20 * time.Second},
	}, nil
}

func (s *SupabaseStore) objectURL(kind, key string) string {
	return fmt.Sprintf("%s/storage/v1/object/%s%s/%s", s.baseURL, kind, s.bucket, strings.TrimLeft(key, "/"))
}

func (s *SupabaseStore) do(req *http.Request) ([]byte, error) {
	req.Header.Set("Authorization", "Bearer "+s.serviceKey)
	req.Header.Set("apikey", s.serviceKey)
	res, err := s.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(res.Body, 50<<20))
	if res.StatusCode >= 300 {
		msg := string(body)
		if len(msg) > 200 {
			msg = msg[:200]
		}
		return nil, fmt.Errorf("supabase storage %s %d: %s", req.Method, res.StatusCode, msg)
	}
	return body, nil
}

// Put grava (ou substitui) o objeto.
func (s *SupabaseStore) Put(ctx context.Context, key, contentType string, data []byte) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.objectURL("", key), bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("x-upsert", "true")
	_, err = s.do(req)
	return err
}

// Get baixa o objeto.
func (s *SupabaseStore) Get(ctx context.Context, key string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.objectURL("authenticated/", key), nil)
	if err != nil {
		return nil, err
	}
	return s.do(req)
}

// PresignedURL devolve uma URL assinada válida por ttl.
func (s *SupabaseStore) PresignedURL(ctx context.Context, key string, ttl time.Duration) (string, error) {
	body, _ := json.Marshal(map[string]int{"expiresIn": int(ttl.Seconds())})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.objectURL("sign/", key), bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	out, err := s.do(req)
	if err != nil {
		return "", err
	}
	var r struct {
		SignedURL string `json:"signedURL"`
	}
	if err := json.Unmarshal(out, &r); err != nil || r.SignedURL == "" {
		return "", fmt.Errorf("supabase storage: resposta de assinatura inválida")
	}
	return s.baseURL + "/storage/v1" + r.SignedURL, nil
}
