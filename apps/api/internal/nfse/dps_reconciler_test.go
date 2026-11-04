package nfse

import (
	"context"
	"crypto/tls"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/webhook"
	"github.com/google/uuid"
)

const idDPSTeste = "DPS130260321896337000019000001000000000000008"

// ─── fakes ──────────────────────────────────────────────────────────────────

type fakeReconcileRepo struct {
	notas      []NotaParaReconciliar
	autorizada map[uuid.UUID]string // id → chave
	marcada    map[uuid.UUID]string // id → erro_codigo
}

func newFakeReconcileRepo(n ...NotaParaReconciliar) *fakeReconcileRepo {
	return &fakeReconcileRepo{notas: n, autorizada: map[uuid.UUID]string{}, marcada: map[uuid.UUID]string{}}
}

func (r *fakeReconcileRepo) FindParaReconciliar(context.Context, time.Duration, int) ([]NotaParaReconciliar, error) {
	return r.notas, nil
}
func (r *fakeReconcileRepo) Autorizar(_ context.Context, id uuid.UUID, chave, _, _ string) (bool, error) {
	r.autorizada[id] = chave
	return true, nil
}
func (r *fakeReconcileRepo) MarcarErroTemporarioReconciliacao(_ context.Context, id uuid.UUID, codigo, _ string) (bool, error) {
	r.marcada[id] = codigo
	return true, nil
}

type fakeConsultor struct {
	res    *NFSeNacionalSuccess
	err    error
	gotID  string
	called int
}

func (f *fakeConsultor) ConsultarDPSPorID(_ context.Context, id string, _ *tls.Certificate) (*NFSeNacionalSuccess, error) {
	f.called++
	f.gotID = id
	return f.res, f.err
}

type fakeCerts struct{ err error }

func (f fakeCerts) GetCert(context.Context, string) (*tls.Certificate, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &tls.Certificate{}, nil
}

type fakeCounter struct{ n int }

func (f *fakeCounter) IncrementEmitidasEmpresa(context.Context, uuid.UUID) (int, error) {
	f.n++
	return f.n, nil
}

type fakePublisher struct{ msgs []webhook.DeliveryMessage }

func (f *fakePublisher) Publish(_ context.Context, m webhook.DeliveryMessage) error {
	f.msgs = append(f.msgs, m)
	return nil
}

func strp(s string) *string { return &s }

func notaTravada(status string) NotaParaReconciliar {
	return NotaParaReconciliar{
		ID:            uuid.New(),
		EmpresaID:     uuid.New(),
		Status:        status,
		XMLEnviado:    strp(`<DPS><infDPS Id="` + idDPSTeste + `"><tpAmb>1</tpAmb></infDPS></DPS>`),
		WebhookURL:    strp("https://erp.exemplo/webhook"),
		CertSecretARN: strp("cert-key"),
	}
}

// ─── testes ─────────────────────────────────────────────────────────────────

func TestExtractIDDPS(t *testing.T) {
	if got := extractIDDPS(`<infDPS xmlns="x" Id="` + idDPSTeste + `">`); got != idDPSTeste {
		t.Errorf("extractIDDPS = %q, want %q", got, idDPSTeste)
	}
	if got := extractIDDPS(`<infDPS Id="DPS123">`); got != "" {
		t.Errorf("id fora do padrão deveria ser ignorado, got %q", got)
	}
}

func TestParseConsultaDPSResponse(t *testing.T) {
	ok, err := parseConsultaDPSResponse(http.StatusOK, []byte(`{"idDps":"`+idDPSTeste+`","chaveAcesso":"CHAVE50"}`))
	if err != nil || ok.ChaveAcesso != "CHAVE50" {
		t.Fatalf("200: got %+v, %v", ok, err)
	}
	if _, err := parseConsultaDPSResponse(http.StatusNotFound, nil); !errors.Is(err, ErrDPSNaoEncontrada) {
		t.Errorf("404 deveria ser ErrDPSNaoEncontrada, got %v", err)
	}
	if _, err := parseConsultaDPSResponse(http.StatusNotFound, []byte(`<HTML><body>Not Found</body></HTML>`)); err == nil || errors.Is(err, ErrDPSNaoEncontrada) {
		t.Errorf("404 HTML (proxy) não pode virar ErrDPSNaoEncontrada, got %v", err)
	}
	if _, err := parseConsultaDPSResponse(http.StatusServiceUnavailable, nil); !isTransient(err) {
		t.Errorf("503 deveria ser transitório, got %v", err)
	}
	if _, err := parseConsultaDPSResponse(http.StatusOK, []byte(`{}`)); err == nil {
		t.Error("200 sem chaveAcesso deveria dar erro (não autorizar às cegas)")
	}
	if _, err := parseConsultaDPSResponse(http.StatusForbidden, []byte(`x`)); err == nil || errors.Is(err, ErrDPSNaoEncontrada) {
		t.Errorf("403 deveria ser erro genérico, got %v", err)
	}
}

func TestDPSReconciler_DPSExiste_Autoriza(t *testing.T) {
	n := notaTravada("ERRO_TEMPORARIO")
	repo := newFakeReconcileRepo(n)
	cons := &fakeConsultor{res: &NFSeNacionalSuccess{IDDps: idDPSTeste, ChaveAcesso: "CHAVE50"}}
	cnt, pub := &fakeCounter{}, &fakePublisher{}
	r := NewDPSReconciler(repo, cons, fakeCerts{}, DefaultReconcileAge, time.Minute, 50).WithCounter(cnt).WithPublisher(pub)

	r.sweep(context.Background())

	if cons.gotID != idDPSTeste {
		t.Errorf("consultou id %q, want %q", cons.gotID, idDPSTeste)
	}
	if repo.autorizada[n.ID] != "CHAVE50" {
		t.Errorf("nota deveria ser autorizada com a chave, got %q", repo.autorizada[n.ID])
	}
	if cnt.n != 1 {
		t.Errorf("contador = %d, want 1", cnt.n)
	}
	if len(pub.msgs) != 1 || pub.msgs[0].Event != webhook.EventAutorizada {
		t.Errorf("webhook autorizada esperado, got %+v", pub.msgs)
	}
	if _, ok := repo.marcada[n.ID]; ok {
		t.Error("nota autorizada não deve ser marcada como erro")
	}
}

func TestDPSReconciler_DPSNaoExiste_LiberaReemissao(t *testing.T) {
	n := notaTravada("PROCESSANDO")
	repo := newFakeReconcileRepo(n)
	cnt := &fakeCounter{}
	r := NewDPSReconciler(repo, &fakeConsultor{err: ErrDPSNaoEncontrada}, fakeCerts{}, DefaultReconcileAge, time.Minute, 50).WithCounter(cnt)

	r.sweep(context.Background())

	if repo.marcada[n.ID] != ErroCodigoNaoRecebida {
		t.Errorf("erro_codigo = %q, want %q", repo.marcada[n.ID], ErroCodigoNaoRecebida)
	}
	if len(repo.autorizada) != 0 || cnt.n != 0 {
		t.Error("DPS inexistente não pode autorizar nem contar na cota")
	}
}

func TestDPSReconciler_SemRespostaConclusiva_Aguarda(t *testing.T) {
	cases := map[string]struct {
		nota  NotaParaReconciliar
		cons  *fakeConsultor
		certs fakeCerts
	}{
		"consulta falhou":                {notaTravada("PROCESSANDO"), &fakeConsultor{err: errors.New("timeout")}, fakeCerts{}},
		"sem certificado":                {func() NotaParaReconciliar { n := notaTravada("PROCESSANDO"); n.CertSecretARN = nil; return n }(), &fakeConsultor{}, fakeCerts{}},
		"cert não carrega":               {notaTravada("PROCESSANDO"), &fakeConsultor{}, fakeCerts{err: errors.New("kms")}},
		"sem xml e sem dados da empresa": {func() NotaParaReconciliar { n := notaTravada("PROCESSANDO"); n.XMLEnviado = nil; return n }(), &fakeConsultor{}, fakeCerts{}},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			repo := newFakeReconcileRepo(c.nota)
			NewDPSReconciler(repo, c.cons, c.certs, DefaultReconcileAge, time.Minute, 50).sweep(context.Background())
			if repo.marcada[c.nota.ID] != ErroCodigoAguardandoReceita {
				t.Errorf("erro_codigo = %q, want %q", repo.marcada[c.nota.ID], ErroCodigoAguardandoReceita)
			}
			if len(repo.autorizada) != 0 {
				t.Error("não pode autorizar sem confirmação da Receita")
			}
		})
	}
}

func TestDPSReconciler_LockOcupado_NaoFazNada(t *testing.T) {
	repo := newFakeReconcileRepo(notaTravada("PROCESSANDO"))
	cons := &fakeConsultor{err: ErrDPSNaoEncontrada}
	NewDPSReconciler(repo, cons, fakeCerts{}, DefaultReconcileAge, time.Minute, 50).
		WithLocker(&stubStuckLocker{acquired: false}).
		sweep(context.Background())
	if cons.called != 0 || len(repo.marcada) != 0 {
		t.Error("sem lock não deve consultar nem marcar")
	}
}

func TestDefaultReconcileAge_MaiorQueEnvioMaximo(t *testing.T) {
	// 4 tentativas × 30s de timeout + backoff (1+4+16s) com +10% de jitter.
	envioMax := 4*30*time.Second + time.Duration(float64(21*time.Second)*1.1)
	if DefaultReconcileAge <= envioMax {
		t.Errorf("DefaultReconcileAge (%s) precisa ser > duração máxima do envio (%s)", DefaultReconcileAge, envioMax)
	}
}

func TestIDDPSDaNota_SemXML_RecalculaComoBuilder(t *testing.T) {
	n := NotaParaReconciliar{NumeroDPS: 8, CNPJ: "18.963.370/0001-90", MunicipioIBGE: "3550308"}
	want := "DPS" + "3550308" + "2" + "18963370000190" + "00001" + "000000000000008"
	if got := idDPSDaNota(n); got != want {
		t.Errorf("idDPSDaNota = %q, want %q", got, want)
	}
	n.XMLEnviado = strp(`<infDPS Id="` + idDPSTeste + `">`)
	if got := idDPSDaNota(n); got != idDPSTeste {
		t.Errorf("com XML deve usar o Id do XML, got %q", got)
	}
}
