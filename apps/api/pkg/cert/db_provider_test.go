package cert

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"errors"
	"math/big"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	pkcs12 "software.sslmate.com/src/go-pkcs12"
)

// fakeDB guarda as linhas de cert_secrets em memória.
type fakeDB struct{ rows map[string][]byte }

type fakeRow struct {
	val []byte
	ok  bool
}

func (r fakeRow) Scan(dest ...any) error {
	if !r.ok {
		return pgx.ErrNoRows
	}
	*(dest[0].(*[]byte)) = r.val
	return nil
}

func (f *fakeDB) QueryRow(_ context.Context, _ string, args ...any) pgx.Row {
	v, ok := f.rows[args[0].(string)]
	return fakeRow{val: v, ok: ok}
}

func (f *fakeDB) Exec(_ context.Context, _ string, args ...any) (pgconn.CommandTag, error) {
	f.rows[args[0].(string)] = args[1].([]byte)
	return pgconn.CommandTag{}, nil
}

func testKey(t *testing.T) string {
	t.Helper()
	k := make([]byte, 32)
	_, _ = rand.Read(k)
	return base64.StdEncoding.EncodeToString(k)
}

func testPFX(t *testing.T, password string) []byte {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	tpl := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "TESTE LTDA:00000000000191"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour),
	}
	der, err := x509.CreateCertificate(rand.Reader, tpl, tpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	crt, _ := x509.ParseCertificate(der)
	pfx, err := pkcs12.Modern.Encode(key, crt, nil, password)
	if err != nil {
		t.Fatal(err)
	}
	return pfx
}

func TestDBProvider_StoreGetUpdate(t *testing.T) {
	db := &fakeDB{rows: map[string][]byte{}}
	p, err := NewDBProvider(db, testKey(t))
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	ref, err := p.StoreCert(ctx, "nota-mei-gateway/me/abc", testPFX(t, "s3nha"), "s3nha")
	if err != nil {
		t.Fatalf("StoreCert: %v", err)
	}
	if ref != "db:nota-mei-gateway/me/abc" {
		t.Fatalf("ref inesperada: %q", ref)
	}
	if bytes.Contains(db.rows[ref], []byte("PRIVATE KEY")) {
		t.Fatal("chave privada gravada em claro")
	}
	c, err := p.GetCert(ctx, ref)
	if err != nil || len(c.Certificate) == 0 || c.PrivateKey == nil {
		t.Fatalf("GetCert: %v", err)
	}
	if err := p.UpdateCert(ctx, ref, testPFX(t, "outra"), "outra"); err != nil {
		t.Fatalf("UpdateCert: %v", err)
	}
	if _, err := p.GetCert(ctx, ref); err != nil {
		t.Fatalf("GetCert após update: %v", err)
	}
}

func TestDBProvider_Erros(t *testing.T) {
	db := &fakeDB{rows: map[string][]byte{}}
	p, _ := NewDBProvider(db, testKey(t))
	ctx := context.Background()

	if _, err := p.GetCert(ctx, "arn:aws:secretsmanager:antigo"); !errors.Is(err, ErrCertNotFound) {
		t.Fatalf("esperava ErrCertNotFound, veio %v", err)
	}
	if _, err := p.StoreCert(ctx, "x", testPFX(t, "certa"), "errada"); err == nil {
		t.Fatal("senha errada deveria falhar")
	}

	// Blob de um cliente copiado para a linha de outro não decifra (AAD = ref).
	refA, _ := p.StoreCert(ctx, "a", testPFX(t, "p"), "p")
	db.rows["db:b"] = db.rows[refA]
	if _, err := p.GetCert(ctx, "db:b"); err == nil {
		t.Fatal("blob trocado de linha não deveria decifrar")
	}

	// Chave-mestra diferente não decifra.
	p2, _ := NewDBProvider(db, testKey(t))
	if _, err := p2.GetCert(ctx, refA); err == nil {
		t.Fatal("chave-mestra errada não deveria decifrar")
	}

	if _, err := NewDBProvider(db, base64.StdEncoding.EncodeToString([]byte("curta"))); err == nil {
		t.Fatal("chave de 5 bytes deveria ser recusada")
	}
}
