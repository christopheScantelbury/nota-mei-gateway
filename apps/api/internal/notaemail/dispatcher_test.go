package notaemail

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/email"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
)

// fakeRows devolve as linhas reservadas pelo UPDATE ... RETURNING.
type fakeRows struct {
	pgx.Rows
	data [][]any
	i    int
}

func (r *fakeRows) Next() bool { r.i++; return r.i <= len(r.data) }
func (r *fakeRows) Close()     {}
func (r *fakeRows) Err() error { return nil }
func (r *fakeRows) Scan(dest ...any) error {
	row := r.data[r.i-1]
	*(dest[0].(*uuid.UUID)) = row[0].(uuid.UUID)
	*(dest[1].(*string)) = row[1].(string)
	*(dest[2].(*string)) = row[2].(string)
	*(dest[3].(**float64)) = row[3].(*float64)
	*(dest[4].(*string)) = row[4].(string)
	*(dest[5].(*string)) = row[5].(string)
	return nil
}

type fakeDB struct {
	pendentes [][]any
	queries   int
	liberadas []uuid.UUID
}

func (f *fakeDB) Query(_ context.Context, sql string, _ ...any) (pgx.Rows, error) {
	f.queries++
	if !strings.Contains(sql, "FOR UPDATE SKIP LOCKED") {
		return nil, errors.New("reserva sem SKIP LOCKED")
	}
	rows := &fakeRows{data: f.pendentes}
	f.pendentes = nil // reservadas: não voltam na próxima consulta
	return rows, nil
}

func (f *fakeDB) Exec(_ context.Context, _ string, args ...any) (pgconn.CommandTag, error) {
	f.liberadas = append(f.liberadas, args[0].([]uuid.UUID)...)
	return pgconn.CommandTag{}, nil
}

type fakeSender struct {
	falhar  bool
	enviado []email.NotaTomadorParams
	destino []string
}

func (s *fakeSender) Enabled() bool { return true }
func (s *fakeSender) SendNotaParaTomador(_ context.Context, to string, p email.NotaTomadorParams) error {
	if s.falhar {
		return errors.New("brevo 401")
	}
	s.destino = append(s.destino, to)
	s.enviado = append(s.enviado, p)
	return nil
}

func linha(id uuid.UUID, destino string) []any {
	v := 3500.0
	return []any{id, destino, strings.Repeat("1", 50), &v, "Cliente LTDA", "Prestador ME"}
}

func TestTick_EnviaComLinkOficial(t *testing.T) {
	id := uuid.New()
	db := &fakeDB{pendentes: [][]any{linha(id, "financeiro@cliente.com")}}
	s := &fakeSender{}
	d := New(db, s, zerolog.Nop())

	if n := d.Tick(context.Background()); n != 1 {
		t.Fatalf("esperava 1 envio, veio %d", n)
	}
	p := s.enviado[0]
	if s.destino[0] != "financeiro@cliente.com" || p.PrestadorNome != "Prestador ME" || p.TomadorNome != "Cliente LTDA" {
		t.Fatalf("parâmetros errados: %+v", p)
	}
	if p.ValorServico != "3.500,00" {
		t.Fatalf("valor formatado errado: %q", p.ValorServico)
	}
	if !strings.HasPrefix(p.ConsultaURL, "https://www.nfse.gov.br/consultapublica?chaveAcesso=") {
		t.Fatalf("link de consulta errado: %q", p.ConsultaURL)
	}
	if d.Tick(context.Background()) != 0 {
		t.Fatal("nota já enviada não pode sair de novo")
	}
}

func TestTick_FalhaDevolveParaFilaEPausa(t *testing.T) {
	a, b := uuid.New(), uuid.New()
	db := &fakeDB{pendentes: [][]any{linha(a, "a@x.com"), linha(b, "b@x.com")}}
	s := &fakeSender{falhar: true}
	d := New(db, s, zerolog.Nop())
	agora := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	d.agora = func() time.Time { return agora }

	if n := d.Tick(context.Background()); n != 0 {
		t.Fatalf("nada deveria sair, veio %d", n)
	}
	if len(db.liberadas) != 2 {
		t.Fatalf("as 2 notas do lote deviam voltar para a fila, voltaram %d", len(db.liberadas))
	}
	// Em pausa: não consulta o banco.
	q := db.queries
	agora = agora.Add(30 * time.Second)
	d.Tick(context.Background())
	if db.queries != q {
		t.Fatal("durante a pausa não deveria consultar o banco")
	}
	// Pausa cresce a cada falha seguida, com teto de 30 min.
	for i := 0; i < 10; i++ {
		agora = d.pausaAte
		db.pendentes = [][]any{linha(a, "a@x.com")}
		d.Tick(context.Background())
	}
	if p := d.pausaAte.Sub(agora); p != 30*time.Minute {
		t.Fatalf("pausa máxima deveria ser 30 min, é %s", p)
	}
}

func TestRun_SemEmailConfiguradoNaoFazNada(t *testing.T) {
	db := &fakeDB{}
	d := New(db, disabledSender{}, zerolog.Nop())
	d.Run(context.Background()) // retorna na hora
	if db.queries != 0 {
		t.Fatal("sem e-mail configurado não deveria reservar notas")
	}
}

type disabledSender struct{}

func (disabledSender) Enabled() bool { return false }
func (disabledSender) SendNotaParaTomador(context.Context, string, email.NotaTomadorParams) error {
	return nil
}
