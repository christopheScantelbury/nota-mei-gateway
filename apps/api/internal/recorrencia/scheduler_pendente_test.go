package recorrencia

import (
	"context"
	"fmt"
	"testing"

	"github.com/rs/zerolog"
)

type emissorSemCert struct{ chamadas int }

func (e *emissorSemCert) EmitirNota(context.Context, string, map[string]interface{}) (string, error) {
	e.chamadas++
	return "", fmt.Errorf("%w: secret not found", ErrSemCertificado)
}

type fakePendencia struct {
	marcado bool
	limpou  int
}

func (f *fakePendencia) MarcarPendenteCertificado(context.Context, string) (bool, error) {
	if f.marcado {
		return false, nil
	}
	f.marcado = true
	return true, nil
}
func (f *fakePendencia) LimparPendenteCertificado(context.Context, string) error {
	f.limpou++
	return nil
}
func (f *fakePendencia) ContatoDono(context.Context, string) (string, string, error) {
	return "dono@example.com", "Empresa Teste", nil
}

type fakeAviso struct{ enviados []string }

func (f *fakeAviso) SendRecorrenciaSemCertificado(_ context.Context, to, _, nome string) error {
	f.enviados = append(f.enviados, to+"|"+nome)
	return nil
}

// #268/#270: sem certificado → pendente, aviso UMA vez, sem avançar o agendamento.
func TestScheduler_SemCertificadoAvisaUmaVez(t *testing.T) {
	em, pend, aviso := &emissorSemCert{}, &fakePendencia{}, &fakeAviso{}
	s := &Scheduler{emissor: em, pendente: pend, aviso: aviso, log: zerolog.Nop()}
	rec := Recorrencia{
		ID: "rec-1", MeiID: "00000000-0000-0000-0000-000000000001", Nome: "Mensalidade",
		Servico: []byte(`{"valor":10}`), Tomador: []byte(`{"documento":"00000000000"}`),
		ProximaEmissao: "2026-10-01",
	}
	for i := 0; i < 3; i++ { // 3 ticks
		s.process(context.Background(), rec) // s.repo nil: se tentasse MarkEmitted, entraria em pânico
	}
	if em.chamadas != 3 {
		t.Fatalf("emissor chamado %d vezes, esperado 3", em.chamadas)
	}
	if len(aviso.enviados) != 1 || aviso.enviados[0] != "dono@example.com|Mensalidade" {
		t.Fatalf("avisos = %v, esperado exatamente 1", aviso.enviados)
	}
	if pend.limpou != 0 {
		t.Fatal("não deveria limpar a pendência sem emitir")
	}
}
