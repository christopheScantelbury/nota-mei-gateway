package nfse

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/storage"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// XML oficial da NFS-e (issue #275).
//
// O "Download XML" entregava a DPS que nós enviamos. O documento fiscal é o
// XML da NFS-e gerado pela Receita (raiz <NFSe>, assinado pela SEFIN), que
// vem em nfseXmlGZipB64 na resposta do POST /nfse e também pode ser obtido
// depois em GET /nfse/{chaveAcesso}. Aqui ficam: a consulta, a validação, a
// gravação no object storage e o preenchimento das notas antigas.

// ErrNFSeNaoEncontrada: a SEFIN respondeu 404 (JSON) para a chave de acesso.
var ErrNFSeNaoEncontrada = errors.New("nfse não encontrada na SEFIN Nacional")

// ConsultarNFSe busca o XML oficial da NFS-e em GET {SefinNacional}/nfse/{chave}.
func (a *Adapter) ConsultarNFSe(ctx context.Context, chaveAcesso string, cert *tls.Certificate) ([]byte, error) {
	if cert == nil {
		return nil, fmt.Errorf("consulta nfse: certificado obrigatório (mTLS)")
	}
	if len(chaveAcesso) != 50 {
		return nil, fmt.Errorf("consulta nfse: chave de acesso deve ter 50 dígitos (recebi %d)", len(chaveAcesso))
	}
	url := a.baseURL + "/nfse/" + chaveAcesso
	var out []byte
	err := withRetry(ctx, backoffDelays, func() error {
		resp, err := a.doJSON(ctx, http.MethodGet, url, nil, cert)
		if err != nil {
			return err
		}
		defer func() { _ = resp.Body.Close() }()
		body, err := io.ReadAll(io.LimitReader(resp.Body, 4*1024*1024))
		if err != nil {
			return err
		}
		out, err = parseConsultaNFSeResponse(resp.StatusCode, body)
		return err
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

// parseConsultaNFSeResponse mapeia a resposta de GET /nfse/{chave} para o XML
// da NFS-e. Separado do transporte para ser testável sem mTLS.
func parseConsultaNFSeResponse(status int, body []byte) ([]byte, error) {
	switch {
	case status >= 500:
		return nil, transientErr{code: status, body: body}
	case status == http.StatusNotFound:
		if bytes.Contains(bytes.ToLower(body), []byte("<html")) {
			return nil, fmt.Errorf("consulta nfse: 404 não-JSON: %.200s", body)
		}
		return nil, ErrNFSeNaoEncontrada
	case status == http.StatusOK:
		s := &NFSeNacionalSuccess{}
		if err := json.Unmarshal(body, s); err != nil {
			return nil, fmt.Errorf("parse consulta nfse: %w (body=%.200s)", err, body)
		}
		if s.NFSeXMLGZipB64 == "" {
			return nil, fmt.Errorf("consulta nfse sem nfseXmlGZipB64 (body=%.200s)", body)
		}
		x, err := DecodeNFSeXML(s.NFSeXMLGZipB64)
		if err != nil {
			return nil, fmt.Errorf("consulta nfse: %w", err)
		}
		return x, nil
	default:
		return nil, fmt.Errorf("consulta nfse: status %d: %.300s", status, body)
	}
}

// ValidarXMLNFSe confere que o documento é o XML da NFS-e (raiz <NFSe>) e não
// a DPS ou outro XML qualquer.
func ValidarXMLNFSe(doc []byte) error {
	d := xml.NewDecoder(bytes.NewReader(doc))
	for {
		tok, err := d.Token()
		if err != nil {
			return fmt.Errorf("xml da nfse inválido: %w", err)
		}
		if se, ok := tok.(xml.StartElement); ok {
			if se.Name.Local != "NFSe" {
				return fmt.Errorf("xml não é uma NFS-e (raiz <%s>)", se.Name.Local)
			}
			return nil
		}
	}
}

// EhXMLNFSe informa se o texto é um XML de NFS-e (usado para ignorar o Id
// "NFS…" que antes era gravado em xml_retorno).
func EhXMLNFSe(s string) bool {
	return s != "" && ValidarXMLNFSe([]byte(s)) == nil
}

// ─── gravação ───────────────────────────────────────────────────────────────

type nfseXMLRepo interface {
	SetNFSeXMLKey(ctx context.Context, notaID uuid.UUID, key string) error
	SetNFSeXMLRetorno(ctx context.Context, notaID uuid.UUID, doc string) error
}

// XMLArchiver guarda o XML da NFS-e no object storage (notas/{dono}/{nota}/nfse.xml)
// e registra a chave em notas_fiscais.nfse_xml_key. Sem storage (ou se o upload
// falhar), guarda o XML em xml_retorno — nunca perde o documento.
type XMLArchiver struct {
	store storage.ObjectStore
	repo  nfseXMLRepo
}

// NewXMLArchiver cria o archiver. store pode ser nil.
func NewXMLArchiver(store storage.ObjectStore, repo nfseXMLRepo) *XMLArchiver {
	return &XMLArchiver{store: store, repo: repo}
}

// Guardar valida e grava o XML da NFS-e.
func (a *XMLArchiver) Guardar(ctx context.Context, ownerID, notaID uuid.UUID, doc []byte) error {
	if a == nil {
		return nil
	}
	if err := ValidarXMLNFSe(doc); err != nil {
		return err
	}
	if a.store != nil {
		key := storage.S3KeyForNFSe(ownerID.String(), notaID.String())
		putErr := a.store.Put(ctx, key, "application/xml", doc)
		if putErr == nil {
			return a.repo.SetNFSeXMLKey(ctx, notaID, key)
		}
		log.Ctx(ctx).Warn().Err(putErr).Str("nota_id", notaID.String()).
			Msg("xml da nfse: upload falhou — guardando no banco")
	}
	return a.repo.SetNFSeXMLRetorno(ctx, notaID, string(doc))
}

// GuardarResposta decodifica o nfseXmlGZipB64 da resposta de autorização e grava.
// Falha aqui não desfaz a autorização: o download e o backfill buscam o XML na
// Receita quando ele não estiver guardado.
func (a *XMLArchiver) GuardarResposta(ctx context.Context, ownerID, notaID uuid.UUID, success *NFSeNacionalSuccess) {
	if a == nil || success == nil {
		return
	}
	l := log.Ctx(ctx).With().Str("nota_id", notaID.String()).Logger()
	if success.NFSeXMLGZipB64 == "" {
		l.Warn().Msg("xml da nfse: resposta da Receita sem nfseXmlGZipB64 — backfill busca depois")
		return
	}
	doc, err := DecodeNFSeXML(success.NFSeXMLGZipB64)
	if err == nil {
		err = a.Guardar(ctx, ownerID, notaID, doc)
	}
	if err != nil {
		l.Warn().Err(err).Msg("xml da nfse: não guardado — backfill busca depois")
	}
}

// ─── backfill ───────────────────────────────────────────────────────────────

// NotaSemXMLNFSe é uma nota autorizada/cancelada cujo XML oficial não está guardado.
type NotaSemXMLNFSe struct {
	ID          uuid.UUID
	OwnerID     uuid.UUID
	ChaveAcesso string
	// CertRefs: referências do certificado (empresas e, para MEI, meis) — a
	// primeira que carregar é usada.
	CertRefs []string
}

type backfillRepo interface {
	nfseXMLRepo
	FindSemXMLNFSe(ctx context.Context, retryAfter time.Duration, limit int) ([]NotaSemXMLNFSe, error)
	MarcarTentativaXMLNFSe(ctx context.Context, notaID uuid.UUID) error
}

type nfseConsultor interface {
	ConsultarNFSe(ctx context.Context, chaveAcesso string, cert *tls.Certificate) ([]byte, error)
}

// XMLBackfill busca na Receita o XML das notas autorizadas que não o têm
// guardado (emitidas antes do #275, autorizadas pelo DPSReconciler ou cujo
// upload falhou). Cada nota é tentada no máximo uma vez a cada retryAfter.
type XMLBackfill struct {
	repo       backfillRepo
	consultor  nfseConsultor
	certs      CertLoader
	archiver   *XMLArchiver
	locker     StuckLocker // opcional
	interval   time.Duration
	retryAfter time.Duration
	limit      int
}

const backfillLockKey = "nfs:xml-backfill:lock"

// NewXMLBackfill cria o job.
func NewXMLBackfill(repo backfillRepo, consultor nfseConsultor, certs CertLoader, store storage.ObjectStore, interval time.Duration) *XMLBackfill {
	return &XMLBackfill{
		repo: repo, consultor: consultor, certs: certs,
		archiver: NewXMLArchiver(store, repo),
		interval: interval, retryAfter: 6 * time.Hour, limit: 20,
	}
}

func (b *XMLBackfill) WithLocker(l StuckLocker) *XMLBackfill { b.locker = l; return b }

// Run varre logo ao iniciar e depois a cada interval.
func (b *XMLBackfill) Run(ctx context.Context) {
	log.Ctx(ctx).Info().Dur("interval", b.interval).Msg("xml nfse backfill started")
	b.Sweep(ctx)
	t := time.NewTicker(b.interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			b.Sweep(ctx)
		}
	}
}

// Sweep processa um lote. Retorna quantas notas tiveram o XML guardado.
func (b *XMLBackfill) Sweep(ctx context.Context) int {
	if b.locker != nil {
		ok, err := b.locker.Acquire(ctx, backfillLockKey, b.interval-5*time.Second)
		if err != nil || !ok {
			return 0
		}
	}
	notas, err := b.repo.FindSemXMLNFSe(ctx, b.retryAfter, b.limit)
	if err != nil {
		log.Ctx(ctx).Warn().Err(err).Msg("xml nfse backfill: query falhou")
		return 0
	}
	ok := 0
	for _, n := range notas {
		if err := b.processar(ctx, n); err != nil {
			// Warn (não Error): o monitor de produção abre issue para todo Error.
			// Nota sem certificado (perdido na saída da AWS) cai aqui até o
			// cliente reenviar — tenta de novo depois de retryAfter.
			log.Ctx(ctx).Warn().Err(err).Str("nota_id", n.ID.String()).Msg("xml nfse backfill: não obtido")
			_ = b.repo.MarcarTentativaXMLNFSe(ctx, n.ID)
			continue
		}
		ok++
	}
	if ok > 0 {
		log.Ctx(ctx).Info().Int("guardados", ok).Int("lote", len(notas)).Msg("xml nfse backfill: XMLs oficiais guardados")
	}
	return ok
}

func (b *XMLBackfill) processar(ctx context.Context, n NotaSemXMLNFSe) error {
	if len(n.CertRefs) == 0 {
		return fmt.Errorf("empresa sem certificado")
	}
	var (
		cert *tls.Certificate
		err  error
	)
	for _, ref := range n.CertRefs {
		if cert, err = b.certs.GetCert(ctx, ref); err == nil {
			break
		}
	}
	if err != nil {
		return fmt.Errorf("carregar certificado: %w", err)
	}
	doc, err := b.consultor.ConsultarNFSe(ctx, n.ChaveAcesso, cert)
	if err != nil {
		return err
	}
	return b.archiver.Guardar(ctx, n.OwnerID, n.ID, doc)
}
