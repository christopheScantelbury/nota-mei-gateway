package email

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
)

// ── fakes ────────────────────────────────────────────────────────────────────

type linhaOutbox struct {
	tipo, status, erro, provedor string
	tentativas                   int
	conteudo                     []byte
	vencida                      bool
}

type fakeOutboxDB struct {
	linhas      map[uuid.UUID]*linhaOutbox
	falhaInsert bool
}

func (f *fakeOutboxDB) QueryRow(context.Context, string, ...any) pgx.Row { return nil }

func (f *fakeOutboxDB) Exec(_ context.Context, sql string, a ...any) (pgconn.CommandTag, error) {
	switch {
	case strings.Contains(sql, "INSERT INTO email_outbox"):
		if f.falhaInsert {
			return pgconn.CommandTag{}, errors.New("db fora")
		}
		f.linhas[a[0].(uuid.UUID)] = &linhaOutbox{tipo: a[1].(string), status: "pendente", tentativas: 1, conteudo: a[3].([]byte)}
	case strings.Contains(sql, "status = 'enviado'"):
		l := f.linhas[a[0].(uuid.UUID)]
		l.status, l.provedor = "enviado", a[1].(string)
	case strings.Contains(sql, "status = 'falhou'"):
		l := f.linhas[a[0].(uuid.UUID)]
		l.status = "falhou"
		if len(a) > 1 {
			l.erro = a[1].(string)
		}
	case strings.Contains(sql, "ultimo_erro = $2, proxima_tentativa_em"):
		l := f.linhas[a[0].(uuid.UUID)]
		l.erro, l.vencida = a[1].(string), false
	}
	return pgconn.CommandTag{}, nil
}

type fakeOutboxRows struct {
	pgx.Rows
	ids []uuid.UUID
	db  *fakeOutboxDB
	i   int
}

func (r *fakeOutboxRows) Next() bool { r.i++; return r.i <= len(r.ids) }
func (r *fakeOutboxRows) Close()     {}
func (r *fakeOutboxRows) Scan(d ...any) error {
	id := r.ids[r.i-1]
	l := r.db.linhas[id]
	*(d[0].(*uuid.UUID)), *(d[1].(*string)), *(d[2].(*int)), *(d[3].(*[]byte)) = id, l.tipo, l.tentativas, l.conteudo
	return nil
}

func (f *fakeOutboxDB) Query(context.Context, string, ...any) (pgx.Rows, error) {
	var ids []uuid.UUID
	for id, l := range f.linhas {
		if l.status == "pendente" && l.vencida {
			l.tentativas++
			l.vencida = false
			ids = append(ids, id)
		}
	}
	return &fakeOutboxRows{ids: ids, db: f}, nil
}

func (f *fakeOutboxDB) vencerTodas() {
	for _, l := range f.linhas {
		l.vencida = true
	}
}

type fakeEntregador struct {
	falhas    int // quantas chamadas seguidas falham
	entregues []SendRequest
}

func (e *fakeEntregador) Entregar(_ context.Context, r SendRequest) (Resultado, error) {
	if e.falhas > 0 {
		e.falhas--
		return Resultado{}, errors.New("brevo_api: HTTP 401")
	}
	e.entregues = append(e.entregues, r)
	return Resultado{Provedor: "brevo_api", MessageID: "m1"}, nil
}

func chave() string {
	k := make([]byte, 32)
	_, _ = rand.Read(k)
	return base64.StdEncoding.EncodeToString(k)
}

func novaFila(t *testing.T, e Entregador) (*Outbox, *fakeOutboxDB) {
	t.Helper()
	db := &fakeOutboxDB{linhas: map[uuid.UUID]*linhaOutbox{}}
	o, err := NewOutbox(db, e, chave(), zerolog.Nop())
	if err != nil {
		t.Fatal(err)
	}
	return o, db
}

var msg = Mensagem{Tipo: "boas_vindas", Para: "dono@empresa.com", Assunto: "Bem-vindo", HTML: "<p>sua chave sk_live_SEGREDO</p>"}

// ── testes ───────────────────────────────────────────────────────────────────

func TestOutbox_EntregaNaHora(t *testing.T) {
	e := &fakeEntregador{}
	o, db := novaFila(t, e)
	if err := o.Enviar(context.Background(), msg); err != nil {
		t.Fatalf("esperava entrega, veio %v", err)
	}
	for _, l := range db.linhas {
		if l.status != "enviado" || l.provedor != "brevo_api" {
			t.Fatalf("linha não marcada como enviada: %+v", l)
		}
		if bytes.Contains(l.conteudo, []byte("sk_live_SEGREDO")) || bytes.Contains(l.conteudo, []byte("dono@empresa.com")) {
			t.Fatal("conteúdo gravado em claro — chave de API/e-mail vazaria no banco")
		}
	}
}

func TestOutbox_FalhaFicaNaFilaEReenvia(t *testing.T) {
	e := &fakeEntregador{falhas: 2}
	o, db := novaFila(t, e)
	if err := o.Enviar(context.Background(), msg); !errors.Is(err, ErrEnfileirado) {
		t.Fatalf("esperava ErrEnfileirado, veio %v", err)
	}
	db.vencerTodas()
	if n := o.Tick(context.Background()); n != 0 {
		t.Fatalf("2ª tentativa ainda falha, saíram %d", n)
	}
	db.vencerTodas()
	if n := o.Tick(context.Background()); n != 1 {
		t.Fatalf("3ª tentativa deveria entregar, saíram %d", n)
	}
	if len(e.entregues) != 1 || e.entregues[0].To[0] != "dono@empresa.com" || !strings.Contains(e.entregues[0].HTML, "sk_live_SEGREDO") {
		t.Fatalf("reenvio com conteúdo errado: %+v", e.entregues)
	}
}

func TestOutbox_DesisteDepoisDoMaximo(t *testing.T) {
	e := &fakeEntregador{falhas: 100}
	o, db := novaFila(t, e)
	o.MaxTentativas = 3
	_ = o.Enviar(context.Background(), msg)
	for i := 0; i < 5; i++ {
		db.vencerTodas()
		o.Tick(context.Background())
	}
	for _, l := range db.linhas {
		if l.status != "falhou" || l.erro == "" {
			t.Fatalf("depois de 3 tentativas devia ficar 'falhou' com o erro: %+v", l)
		}
	}
}

func TestOutbox_SemBancoEnviaDireto(t *testing.T) {
	e := &fakeEntregador{}
	o, db := novaFila(t, e)
	db.falhaInsert = true
	if err := o.Enviar(context.Background(), msg); err != nil {
		t.Fatalf("sem banco devia entregar direto, veio %v", err)
	}
	if len(e.entregues) != 1 {
		t.Fatal("não entregou")
	}
}

func TestOutbox_ChaveMestraInvalida(t *testing.T) {
	if _, err := NewOutbox(&fakeOutboxDB{}, &fakeEntregador{}, "curta", zerolog.Nop()); err == nil {
		t.Fatal("chave inválida deveria ser recusada")
	}
}

// ── fallback de provedor ─────────────────────────────────────────────────────

func TestClient_APIFalhaCaiNoSMTP(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"message":"unrecognised IP address"}`))
	}))
	defer api.Close()

	c := New("smtp.invalido.test", "587", "user", "xsmtpsib-x", "NotaFácil <noreply@emitirnotafacil.com.br>").WithAPIKey("xkeysib-y")
	c.apiURL = api.URL
	var portas []string
	c.dial = func(_ context.Context, addr string) (net.Conn, error) {
		portas = append(portas, addr)
		return nil, errors.New("conexão recusada")
	}
	_, err := c.Entregar(context.Background(), SendRequest{To: []string{"a@b.com"}, Subject: "s", HTML: "h"})
	if err == nil {
		t.Fatal("os dois provedores falharam — devia dar erro")
	}
	if !strings.Contains(err.Error(), "brevo_api") || !strings.Contains(err.Error(), "brevo_smtp") {
		t.Fatalf("erro devia citar os dois provedores: %v", err)
	}
	if len(portas) != 2 || !strings.HasSuffix(portas[0], ":587") || !strings.HasSuffix(portas[1], ":2525") {
		t.Fatalf("SMTP devia tentar 587 e depois 2525, tentou %v", portas)
	}
}

func TestClient_CompatSMTPPassComChaveDeAPI(t *testing.T) {
	c := New("smtp-relay.brevo.com", "587", "user", "xkeysib-antiga", "x <x@y.com>")
	if !c.apiEnabled() || c.smtpEnabled() {
		t.Fatal("SMTP_PASS xkeysib- deve virar chave da API (compat) e não ser usada no SMTP")
	}
}
