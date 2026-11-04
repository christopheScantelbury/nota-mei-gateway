package cert

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// DBProvider guarda os certificados A1 no Postgres (tabela cert_secrets),
// cifrados com AES-256-GCM. Substitui o AWS Secrets Manager (conta encerrada
// em 2026-11-03) sem custo: o banco só vê bytes cifrados e a chave-mestra fica
// apenas na variável de ambiente CERT_MASTER_KEY do Railway — quem lê o banco
// sozinho não abre o certificado.
//
// O certificado continua só em memória: o PFX é convertido para PEM, cifrado e
// gravado; nunca vai para disco nem para log.
//
// Referência (o valor salvo em meis/empresas.cert_secret_arn): "db:<nome>".
// A linha é localizada pela referência exata, então qualquer string serve de
// chave — inclusive ARNs antigos da AWS, caso um UpdateCert chegue com um.
type DBProvider struct {
	db   dbExec
	aead cipher.AEAD
}

// dbExec é o subconjunto de *pgxpool.Pool usado aqui (injetável em testes).
type dbExec interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// RefPrefixDB marca referências de certificado guardadas no banco.
const RefPrefixDB = "db:"

// ErrCertNotFound indica que não há certificado salvo para a referência —
// tipicamente um certificado que estava na AWS e precisa ser reenviado.
var ErrCertNotFound = errors.New("certificado não encontrado — reenvie o certificado A1 em Minha empresa → Certificado A1")

// NewDBProvider cria o provider. masterKeyB64 é a CERT_MASTER_KEY: 32 bytes em
// base64 (gerar com `openssl rand -base64 32`).
func NewDBProvider(db dbExec, masterKeyB64 string) (*DBProvider, error) {
	aead, err := newAEAD(masterKeyB64)
	if err != nil {
		return nil, err
	}
	return &DBProvider{db: db, aead: aead}, nil
}

func newAEAD(masterKeyB64 string) (cipher.AEAD, error) {
	key, err := base64.StdEncoding.DecodeString(strings.TrimSpace(masterKeyB64))
	if err != nil {
		return nil, fmt.Errorf("CERT_MASTER_KEY inválida (base64): %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("CERT_MASTER_KEY deve ter 32 bytes, tem %d", len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

// seal cifra plaintext amarrando-o à referência (AAD): um blob copiado para a
// linha de outro cliente não decifra.
func seal(aead cipher.AEAD, ref string, plaintext []byte) ([]byte, error) {
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return aead.Seal(nonce, nonce, plaintext, []byte(ref)), nil
}

func open(aead cipher.AEAD, ref string, sealed []byte) ([]byte, error) {
	n := aead.NonceSize()
	if len(sealed) < n {
		return nil, errors.New("blob cifrado curto demais")
	}
	return aead.Open(nil, sealed[:n], sealed[n:], []byte(ref))
}

// GetCert busca, decifra e monta o certificado TLS da referência.
func (p *DBProvider) GetCert(ctx context.Context, ref string) (*tls.Certificate, error) {
	var sealed []byte
	err := p.db.QueryRow(ctx, `SELECT sealed FROM cert_secrets WHERE ref = $1`, ref).Scan(&sealed)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCertNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("buscar certificado: %w", err)
	}
	plain, err := open(p.aead, ref, sealed)
	if err != nil {
		return nil, fmt.Errorf("decifrar certificado: %w", err)
	}
	var cs certSecret
	if err := json.Unmarshal(plain, &cs); err != nil {
		return nil, fmt.Errorf("parse certificado: %w", err)
	}
	c, err := tls.X509KeyPair([]byte(cs.CertPEM), []byte(cs.KeyPEM))
	if err != nil {
		return nil, fmt.Errorf("parse certificate: %w", err)
	}
	return &c, nil
}

// StoreCert valida o PFX, cifra e grava; devolve a referência "db:<nome>".
// Um reenvio com o mesmo nome substitui o anterior.
func (p *DBProvider) StoreCert(ctx context.Context, name string, pfxData []byte, password string) (string, error) {
	ref := RefPrefixDB + name
	if err := p.put(ctx, ref, pfxData, password); err != nil {
		return "", err
	}
	return ref, nil
}

// UpdateCert substitui o certificado guardado na referência.
func (p *DBProvider) UpdateCert(ctx context.Context, ref string, pfxData []byte, password string) error {
	return p.put(ctx, ref, pfxData, password)
}

func (p *DBProvider) put(ctx context.Context, ref string, pfxData []byte, password string) error {
	secretVal, err := pfxToSecretJSON(pfxData, password)
	if err != nil {
		return fmt.Errorf("parse PFX: %w", err)
	}
	sealed, err := seal(p.aead, ref, []byte(secretVal))
	if err != nil {
		return fmt.Errorf("cifrar certificado: %w", err)
	}
	_, err = p.db.Exec(ctx, `
		INSERT INTO cert_secrets (ref, sealed, key_version)
		VALUES ($1, $2, 1)
		ON CONFLICT (ref) DO UPDATE
		   SET sealed = EXCLUDED.sealed, key_version = EXCLUDED.key_version, updated_at = now()`,
		ref, sealed)
	if err != nil {
		return fmt.Errorf("gravar certificado: %w", err)
	}
	return nil
}
