package email

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
)

// ErrEnfileirado indica que o e-mail não saiu na hora, mas está guardado na
// fila (email_outbox) e será reenviado automaticamente.
var ErrEnfileirado = errors.New("e-mail não saiu agora; ficou na fila e será reenviado automaticamente")

// OutboxDB é o subconjunto de *pgxpool.Pool usado pela fila.
type OutboxDB interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// Entregador é o que efetivamente envia (o *Client, com fallback de provedor).
type Entregador interface {
	Entregar(ctx context.Context, req SendRequest) (Resultado, error)
}

// Outbox é a fila de e-mails transacionais: todo e-mail é gravado antes do
// envio, então nenhum se perde se o provedor estiver fora do ar. Falhas são
// reenviadas com espera crescente (1, 2, 4… até 60 min) até MaxTentativas;
// depois a mensagem fica como "falhou" e pode ser reenviada pelo admin.
//
// Conteúdo cifrado: o corpo pode ter segredo (o e-mail de boas-vindas leva a
// chave de API). Destinatário, assunto e HTML vão num JSON selado com
// AES-256-GCM (chave derivada da CERT_MASTER_KEY via HKDF, AAD = id da linha).
// Na tabela ficam em claro só o tipo, o domínio do destinatário e o status.
type Outbox struct {
	db            OutboxDB
	envio         Entregador
	aead          cipher.AEAD
	log           zerolog.Logger
	MaxTentativas int
	intervalo     time.Duration
	lote          int
}

// NewOutbox cria a fila. masterKeyB64 é a CERT_MASTER_KEY (32 bytes base64).
func NewOutbox(db OutboxDB, envio Entregador, masterKeyB64 string, logger zerolog.Logger) (*Outbox, error) {
	key, err := base64.StdEncoding.DecodeString(strings.TrimSpace(masterKeyB64))
	if err != nil || len(key) != 32 {
		return nil, errors.New("outbox: CERT_MASTER_KEY inválida (precisa de 32 bytes em base64)")
	}
	sub, err := hkdf.Key(sha256.New, key, nil, "nmg/email-outbox/v1", 32)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(sub)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Outbox{
		db:            db,
		envio:         envio,
		aead:          aead,
		log:           logger.With().Str("component", "email_outbox").Logger(),
		MaxTentativas: 12,
		intervalo:     time.Minute,
		lote:          20,
	}, nil
}

// Mensagem é um e-mail a entregar.
type Mensagem struct {
	Tipo      string // nota_tomador, boas_vindas, pagamento_falhou…
	Para      string
	Assunto   string
	HTML      string
	NotaID    *uuid.UUID
	EmpresaID *uuid.UUID
}

type conteudo struct {
	Para    string `json:"para"`
	Assunto string `json:"assunto"`
	HTML    string `json:"html"`
}

func (o *Outbox) selar(id uuid.UUID, c conteudo) ([]byte, error) {
	plain, err := json.Marshal(c)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, o.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return o.aead.Seal(nonce, nonce, plain, id[:]), nil
}

func (o *Outbox) abrir(id uuid.UUID, sealed []byte) (conteudo, error) {
	var c conteudo
	n := o.aead.NonceSize()
	if len(sealed) < n {
		return c, errors.New("conteúdo cifrado inválido")
	}
	plain, err := o.aead.Open(nil, sealed[:n], sealed[n:], id[:])
	if err != nil {
		return c, err
	}
	return c, json.Unmarshal(plain, &c)
}

func dominio(email string) string {
	_, e := parseFromAddr(email)
	if i := strings.LastIndex(e, "@"); i >= 0 {
		return strings.ToLower(e[i+1:])
	}
	return ""
}

// Enviar grava a mensagem na fila e tenta entregar na hora.
//   - nil            → entregue agora
//   - ErrEnfileirado → não saiu, mas está na fila e será reenviada
//   - outro erro     → nem gravou nem entregou (banco e provedor fora)
func (o *Outbox) Enviar(ctx context.Context, m Mensagem) error {
	id := uuid.New()
	sealed, err := o.selar(id, conteudo{Para: m.Para, Assunto: m.Assunto, HTML: m.HTML})
	if err == nil {
		// Reserva de 10 min: a fila não pega esta linha enquanto tentamos agora.
		_, err = o.db.Exec(ctx, `
			INSERT INTO email_outbox (id, tipo, destino_dominio, conteudo, status, tentativas,
			                          proxima_tentativa_em, nota_id, empresa_id)
			VALUES ($1, $2, $3, $4, 'pendente', 1, now() + interval '10 minutes', $5, $6)
		`, id, m.Tipo, dominio(m.Para), sealed, m.NotaID, m.EmpresaID)
	}
	if err != nil {
		// Sem fila: ainda tenta entregar direto para não perder o e-mail.
		o.log.Error().Err(err).Str("tipo", m.Tipo).Msg("email: falha ao gravar na fila — tentando envio direto")
		if _, envErr := o.envio.Entregar(ctx, SendRequest{To: []string{m.Para}, Subject: m.Assunto, HTML: m.HTML}); envErr != nil {
			return fmt.Errorf("fila indisponível (%v) e envio falhou: %w", err, envErr)
		}
		return nil
	}
	if o.entregar(ctx, id, 1, m.Tipo, conteudo{Para: m.Para, Assunto: m.Assunto, HTML: m.HTML}) {
		return nil
	}
	return ErrEnfileirado
}

// entregar tenta enviar e grava o resultado. true = entregue.
func (o *Outbox) entregar(ctx context.Context, id uuid.UUID, tentativa int, tipo string, c conteudo) bool {
	res, err := o.envio.Entregar(ctx, SendRequest{To: []string{c.Para}, Subject: c.Assunto, HTML: c.HTML})
	if err == nil {
		if _, uerr := o.db.Exec(ctx, `
			UPDATE email_outbox
			   SET status = 'enviado', enviado_em = now(), provedor = $2, message_id = $3,
			       ultimo_erro = NULL, proxima_tentativa_em = NULL
			 WHERE id = $1
		`, id, res.Provedor, res.MessageID); uerr != nil {
			o.log.Warn().Err(uerr).Str("outbox_id", id.String()).Msg("email: enviado, mas falha ao marcar na fila")
		}
		o.log.Info().Str("outbox_id", id.String()).Str("tipo", tipo).Str("provedor", res.Provedor).
			Int("tentativa", tentativa).Msg("email: entregue")
		return true
	}

	erro := err.Error()
	if len(erro) > 500 {
		erro = erro[:500]
	}
	if tentativa >= o.MaxTentativas {
		_, _ = o.db.Exec(ctx, `
			UPDATE email_outbox SET status = 'falhou', ultimo_erro = $2, proxima_tentativa_em = NULL WHERE id = $1
		`, id, erro)
		o.log.Error().Err(err).Str("outbox_id", id.String()).Str("tipo", tipo).Int("tentativas", tentativa).
			Msg("email: desistiu após todas as tentativas — reenviar pelo admin (/admin/emails)")
		return false
	}
	espera := time.Minute << min(tentativa-1, 6)
	if espera > time.Hour {
		espera = time.Hour
	}
	_, _ = o.db.Exec(ctx, `
		UPDATE email_outbox SET ultimo_erro = $2, proxima_tentativa_em = now() + $3::interval WHERE id = $1
	`, id, erro, fmt.Sprintf("%d seconds", int(espera.Seconds())))
	o.log.Warn().Err(err).Str("outbox_id", id.String()).Str("tipo", tipo).Int("tentativa", tentativa).
		Dur("proxima_em", espera).Msg("email: envio falhou, vai ser reenviado")
	return false
}

// Run reenvia os pendentes periodicamente. Bloqueia até ctx ser cancelado.
func (o *Outbox) Run(ctx context.Context) {
	o.log.Info().Dur("interval", o.intervalo).Msg("fila de e-mails iniciada")
	t := time.NewTicker(o.intervalo)
	defer t.Stop()
	for {
		o.Tick(ctx)
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// Tick reserva um lote vencido (SKIP LOCKED: seguro com várias réplicas) e reenvia.
func (o *Outbox) Tick(ctx context.Context) int {
	rows, err := o.db.Query(ctx, `
		WITH alvo AS (
			SELECT id FROM email_outbox
			WHERE status = 'pendente' AND proxima_tentativa_em <= now()
			ORDER BY proxima_tentativa_em
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE email_outbox e
		   SET tentativas = e.tentativas + 1,
		       proxima_tentativa_em = now() + interval '10 minutes'
		  FROM alvo
		 WHERE e.id = alvo.id
		RETURNING e.id, e.tipo, e.tentativas, e.conteudo
	`, o.lote)
	if err != nil {
		o.log.Error().Err(err).Msg("email: falha ao ler a fila")
		return 0
	}
	type item struct {
		id         uuid.UUID
		tipo       string
		tentativas int
		sealed     []byte
	}
	var itens []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.id, &it.tipo, &it.tentativas, &it.sealed); err == nil {
			itens = append(itens, it)
		}
	}
	rows.Close()

	enviados := 0
	for _, it := range itens {
		c, err := o.abrir(it.id, it.sealed)
		if err != nil {
			_, _ = o.db.Exec(ctx, `UPDATE email_outbox SET status = 'falhou', ultimo_erro = 'conteúdo não decifra (chave-mestra trocada?)', proxima_tentativa_em = NULL WHERE id = $1`, it.id)
			o.log.Error().Err(err).Str("outbox_id", it.id.String()).Msg("email: conteúdo da fila não decifra")
			continue
		}
		if o.entregar(ctx, it.id, it.tentativas, it.tipo, c) {
			enviados++
		}
	}
	return enviados
}
