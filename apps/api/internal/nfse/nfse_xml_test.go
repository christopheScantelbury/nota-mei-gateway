package nfse

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

const xmlNFSeTeste = `<?xml version="1.0" encoding="utf-8"?>
<NFSe versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS13026032234488964000142000000000000126056414682885"><nNFSe>1</nNFSe></infNFSe></NFSe>`

const xmlDPSTeste = `<?xml version="1.0" encoding="utf-8"?>
<DPS versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse"><infDPS Id="DPS130260322344889640001420000000000000001"/></DPS>`

func gzB64(t *testing.T, s string) string {
	t.Helper()
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)
	_, _ = w.Write([]byte(s))
	_ = w.Close()
	return base64.StdEncoding.EncodeToString(buf.Bytes())
}

func TestValidarXMLNFSe(t *testing.T) {
	if err := ValidarXMLNFSe([]byte(xmlNFSeTeste)); err != nil {
		t.Fatalf("NFS-e válida recusada: %v", err)
	}
	if err := ValidarXMLNFSe([]byte(xmlDPSTeste)); err == nil {
		t.Fatal("DPS aceita como NFS-e")
	}
	// O que ia para xml_retorno antes do #275: o Id, não um XML.
	if EhXMLNFSe("NFS13026032234488964000142000000000000126056414682885") {
		t.Fatal("Id da NFS-e aceito como XML")
	}
	if EhXMLNFSe("") {
		t.Fatal("string vazia aceita")
	}
}

func TestParseConsultaNFSeResponse(t *testing.T) {
	body, _ := json.Marshal(map[string]any{
		"chaveAcesso":    "13026032234488964000142000000000000126056414682885",
		"nfseXmlGZipB64": gzB64(t, xmlNFSeTeste),
	})
	doc, err := parseConsultaNFSeResponse(200, body)
	if err != nil {
		t.Fatalf("200: %v", err)
	}
	if !strings.Contains(string(doc), "<NFSe") {
		t.Fatalf("XML decodificado inesperado: %s", doc)
	}

	if _, err := parseConsultaNFSeResponse(404, []byte(`{"erro":[{"codigo":"E404"}]}`)); !errors.Is(err, ErrNFSeNaoEncontrada) {
		t.Fatalf("404 JSON: esperado ErrNFSeNaoEncontrada, veio %v", err)
	}
	if _, err := parseConsultaNFSeResponse(404, []byte(`<html>not found</html>`)); err == nil || errors.Is(err, ErrNFSeNaoEncontrada) {
		t.Fatalf("404 HTML deve ser erro genérico, veio %v", err)
	}
	var te transientErr
	if _, err := parseConsultaNFSeResponse(502, nil); !errors.As(err, &te) {
		t.Fatalf("5xx deve ser transient, veio %v", err)
	}
	if _, err := parseConsultaNFSeResponse(200, []byte(`{"chaveAcesso":"x"}`)); err == nil {
		t.Fatal("200 sem nfseXmlGZipB64 deve falhar")
	}
}

// ─── fakes ──────────────────────────────────────────────────────────────────

type fakeStore struct {
	objs   map[string][]byte
	putErr error
}

func (s *fakeStore) Put(_ context.Context, key, _ string, data []byte) error {
	if s.putErr != nil {
		return s.putErr
	}
	if s.objs == nil {
		s.objs = map[string][]byte{}
	}
	s.objs[key] = data
	return nil
}
func (s *fakeStore) Get(_ context.Context, key string) ([]byte, error) { return s.objs[key], nil }
func (s *fakeStore) PresignedURL(context.Context, string, time.Duration) (string, error) {
	return "", nil
}

type fakeXMLRepo struct {
	keys      map[uuid.UUID]string
	retornos  map[uuid.UUID]string
	pendentes []NotaSemXMLNFSe
	tentadas  []uuid.UUID
}

func (r *fakeXMLRepo) SetNFSeXMLKey(_ context.Context, id uuid.UUID, key string) error {
	if r.keys == nil {
		r.keys = map[uuid.UUID]string{}
	}
	r.keys[id] = key
	return nil
}
func (r *fakeXMLRepo) SetNFSeXMLRetorno(_ context.Context, id uuid.UUID, doc string) error {
	if r.retornos == nil {
		r.retornos = map[uuid.UUID]string{}
	}
	r.retornos[id] = doc
	return nil
}
func (r *fakeXMLRepo) FindSemXMLNFSe(context.Context, time.Duration, int) ([]NotaSemXMLNFSe, error) {
	return r.pendentes, nil
}
func (r *fakeXMLRepo) MarcarTentativaXMLNFSe(_ context.Context, id uuid.UUID) error {
	r.tentadas = append(r.tentadas, id)
	return nil
}

type fakeNFSeConsultor struct{ docs map[string]string }

func (f *fakeNFSeConsultor) ConsultarNFSe(_ context.Context, chave string, _ *tls.Certificate) ([]byte, error) {
	d, ok := f.docs[chave]
	if !ok {
		return nil, ErrNFSeNaoEncontrada
	}
	return []byte(d), nil
}

type fakeCertLoader struct{ ok map[string]bool }

func (f *fakeCertLoader) GetCert(_ context.Context, ref string) (*tls.Certificate, error) {
	if f.ok[ref] {
		return &tls.Certificate{}, nil
	}
	return nil, errors.New("certificado não encontrado")
}

// ─── archiver ───────────────────────────────────────────────────────────────

func TestXMLArchiver_GuardaNFSeNoStorage(t *testing.T) {
	store, repo := &fakeStore{}, &fakeXMLRepo{}
	owner, nota := uuid.New(), uuid.New()
	a := NewXMLArchiver(store, repo)

	a.GuardarResposta(context.Background(), owner, nota, &NFSeNacionalSuccess{NFSeXMLGZipB64: gzB64(t, xmlNFSeTeste)})

	key := "notas/" + owner.String() + "/" + nota.String() + "/nfse.xml"
	if repo.keys[nota] != key {
		t.Fatalf("nfse_xml_key = %q, esperado %q", repo.keys[nota], key)
	}
	if !strings.Contains(string(store.objs[key]), "<NFSe") || strings.Contains(string(store.objs[key]), "<DPS") {
		t.Fatalf("objeto guardado não é a NFS-e: %s", store.objs[key])
	}
}

func TestXMLArchiver_RecusaDPS(t *testing.T) {
	store, repo := &fakeStore{}, &fakeXMLRepo{}
	err := NewXMLArchiver(store, repo).Guardar(context.Background(), uuid.New(), uuid.New(), []byte(xmlDPSTeste))
	if err == nil {
		t.Fatal("DPS foi guardada como XML da NFS-e")
	}
	if len(store.objs) != 0 || len(repo.keys) != 0 || len(repo.retornos) != 0 {
		t.Fatal("nada deveria ter sido gravado")
	}
}

func TestXMLArchiver_SemStorageGuardaNoBanco(t *testing.T) {
	for name, store := range map[string]*fakeStore{"nil": nil, "upload falha": {putErr: errors.New("503")}} {
		t.Run(name, func(t *testing.T) {
			repo := &fakeXMLRepo{}
			nota := uuid.New()
			var a *XMLArchiver
			if store == nil {
				a = NewXMLArchiver(nil, repo)
			} else {
				a = NewXMLArchiver(store, repo)
			}
			if err := a.Guardar(context.Background(), uuid.New(), nota, []byte(xmlNFSeTeste)); err != nil {
				t.Fatal(err)
			}
			if !EhXMLNFSe(repo.retornos[nota]) {
				t.Fatalf("xml_retorno = %q", repo.retornos[nota])
			}
		})
	}
}

// ─── backfill ───────────────────────────────────────────────────────────────

func TestXMLBackfill_Sweep(t *testing.T) {
	ok, semCert, naoAchou := uuid.New(), uuid.New(), uuid.New()
	repo := &fakeXMLRepo{pendentes: []NotaSemXMLNFSe{
		// cert da empresa perdido (AWS), o do MEI carrega — usa o segundo
		{ID: ok, OwnerID: uuid.New(), ChaveAcesso: "C1", CertRefs: []string{"aws:perdido", "db:ok"}},
		{ID: semCert, OwnerID: uuid.New(), ChaveAcesso: "C2"},
		{ID: naoAchou, OwnerID: uuid.New(), ChaveAcesso: "C3", CertRefs: []string{"db:ok"}},
	}}
	store := &fakeStore{}
	b := NewXMLBackfill(repo, &fakeNFSeConsultor{docs: map[string]string{"C1": xmlNFSeTeste}},
		&fakeCertLoader{ok: map[string]bool{"db:ok": true}}, store, time.Minute)

	if n := b.Sweep(context.Background()); n != 1 {
		t.Fatalf("guardados = %d, esperado 1", n)
	}
	if repo.keys[ok] == "" {
		t.Fatal("nota com XML disponível não foi guardada")
	}
	if len(repo.tentadas) != 2 {
		t.Fatalf("tentativas marcadas = %v, esperado as 2 que falharam", repo.tentadas)
	}
}
