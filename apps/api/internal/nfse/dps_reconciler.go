package nfse

import (
	"context"
	"crypto/tls"
	"errors"
	"regexp"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/webhook"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// Reconciliação de DPS sem resposta (issue #273).
//
// Quando o POST /nfse da SEFIN Nacional cai em timeout/5xx, o handler devolve
// 202 e deixa a nota em PROCESSANDO sem chave de acesso. A Receita pode ter
// autorizado mesmo assim — reemitir geraria NFS-e em duplicidade. O
// DPSReconciler consulta GET /dps/{idDps} para essas notas:
//   - existe  → AUTORIZADA (conta na cota + webhook), como se o POST tivesse respondido;
//   - 404     → ERRO_TEMPORARIO "NAO_RECEBIDA": seguro emitir de novo;
//   - erro    → ERRO_TEMPORARIO "AGUARDANDO_RECEITA" (não reemitir ainda); tenta de novo no próximo ciclo.

const (
	ErroCodigoAguardandoReceita = "AGUARDANDO_RECEITA"
	ErroCodigoNaoRecebida       = "NAO_RECEBIDA"

	ErroDescricaoAguardandoReceita = "Aguardando confirmação da Receita. Não emita esta nota novamente por enquanto — o status é atualizado automaticamente."
	ErroDescricaoNaoRecebida       = "A Receita não recebeu esta nota. Pode emitir novamente."

	// DefaultReconcileAge precisa ser maior que a duração máxima do envio
	// (4 tentativas de 30s + backoff 1/4/16s ≈ 2min21s), senão a consulta
	// pode responder 404 para uma DPS que ainda está sendo enviada.
	DefaultReconcileAge      = 5 * time.Minute
	DefaultReconcileInterval = time.Minute

	reconcileLockKey = "nfs:reconcile:lock"
	reconcileLockTTL = 50 * time.Second
)

var idDPSRe = regexp.MustCompile(`Id="(DPS[0-9]{42})"`)

// extractIDDPS lê o Id da infDPS do XML assinado que foi enviado.
func extractIDDPS(xmlEnviado string) string {
	m := idDPSRe.FindStringSubmatch(xmlEnviado)
	if m == nil {
		return ""
	}
	return m[1]
}

// ─── dependências (interfaces para teste) ───────────────────────────────────

type reconcileRepo interface {
	FindParaReconciliar(ctx context.Context, olderThan time.Duration, limit int) ([]NotaParaReconciliar, error)
	Autorizar(ctx context.Context, notaID uuid.UUID, numeroNFSe, codVerificacao, xmlRetorno string) (bool, error)
	MarcarErroTemporarioReconciliacao(ctx context.Context, notaID uuid.UUID, erroCodigo, erroDescricao string) (bool, error)
}

type dpsConsultor interface {
	ConsultarDPSPorID(ctx context.Context, idDPS string, cert *tls.Certificate) (*NFSeNacionalSuccess, error)
}

// EmpresaEmissaoCounter incrementa o contador mensal de uma empresa ME/EPP.
type EmpresaEmissaoCounter interface {
	IncrementEmitidasEmpresa(ctx context.Context, empresaID uuid.UUID) (int, error)
}

// WebhookPublisher publica o evento de nota finalizada.
type WebhookPublisher interface {
	Publish(ctx context.Context, msg webhook.DeliveryMessage) error
}

// DPSReconciler substitui o StuckPoller no caminho DPS.
type DPSReconciler struct {
	repo      reconcileRepo
	consultor dpsConsultor
	certs     CertLoader
	counter   EmpresaEmissaoCounter // opcional
	publisher WebhookPublisher      // opcional
	locker    StuckLocker           // opcional
	age       time.Duration
	interval  time.Duration
	limit     int
}

// NewDPSReconciler cria o reconciliador.
func NewDPSReconciler(repo reconcileRepo, consultor dpsConsultor, certs CertLoader, age, interval time.Duration, limit int) *DPSReconciler {
	return &DPSReconciler{repo: repo, consultor: consultor, certs: certs, age: age, interval: interval, limit: limit}
}

func (r *DPSReconciler) WithCounter(c EmpresaEmissaoCounter) *DPSReconciler { r.counter = c; return r }
func (r *DPSReconciler) WithPublisher(p WebhookPublisher) *DPSReconciler    { r.publisher = p; return r }
func (r *DPSReconciler) WithLocker(l StuckLocker) *DPSReconciler            { r.locker = l; return r }

// Run varre imediatamente e depois a cada interval, até ctx ser cancelado.
func (r *DPSReconciler) Run(ctx context.Context) {
	log.Ctx(ctx).Info().Dur("age", r.age).Dur("interval", r.interval).Msg("dps reconciler started")
	r.sweep(ctx)
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.sweep(ctx)
		}
	}
}

func (r *DPSReconciler) sweep(ctx context.Context) {
	if r.locker != nil {
		ok, err := r.locker.Acquire(ctx, reconcileLockKey, reconcileLockTTL)
		if err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("dps reconciler: falha ao obter lock")
			return
		}
		if !ok {
			return
		}
	}
	notas, err := r.repo.FindParaReconciliar(ctx, r.age, r.limit)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("dps reconciler: query falhou")
		return
	}
	for _, n := range notas {
		r.reconciliar(ctx, n)
	}
}

func (r *DPSReconciler) reconciliar(ctx context.Context, n NotaParaReconciliar) {
	l := log.Ctx(ctx).With().Str("nota_id", n.ID.String()).Str("status", n.Status).Logger()

	aguardar := func(motivo string, err error) {
		l.Warn().Err(err).Str("motivo", motivo).Msg("dps reconciler: sem resposta conclusiva da Receita — tenta de novo no próximo ciclo")
		if _, mErr := r.repo.MarcarErroTemporarioReconciliacao(ctx, n.ID, ErroCodigoAguardandoReceita, ErroDescricaoAguardandoReceita); mErr != nil {
			l.Error().Err(mErr).Msg("dps reconciler: falha ao marcar AGUARDANDO_RECEITA")
		}
	}

	if n.XMLEnviado == nil {
		aguardar("sem xml_enviado", nil)
		return
	}
	idDPS := extractIDDPS(*n.XMLEnviado)
	if idDPS == "" {
		aguardar("id da DPS não encontrado no xml_enviado", nil)
		return
	}
	if n.CertSecretARN == nil || *n.CertSecretARN == "" {
		aguardar("empresa sem certificado", nil)
		return
	}
	cert, err := r.certs.GetCert(ctx, *n.CertSecretARN)
	if err != nil {
		aguardar("falha ao carregar certificado", err)
		return
	}

	res, err := r.consultor.ConsultarDPSPorID(ctx, idDPS, cert)
	switch {
	case errors.Is(err, ErrDPSNaoEncontrada):
		if _, mErr := r.repo.MarcarErroTemporarioReconciliacao(ctx, n.ID, ErroCodigoNaoRecebida, ErroDescricaoNaoRecebida); mErr != nil {
			l.Error().Err(mErr).Msg("dps reconciler: falha ao marcar NAO_RECEBIDA")
			return
		}
		l.Info().Str("id_dps", idDPS).Msg("dps reconciler: DPS não existe na Receita — liberada para reemissão")
	case err != nil:
		aguardar("consulta GET /dps falhou", err)
	default:
		updated, aErr := r.repo.Autorizar(ctx, n.ID, res.ChaveAcesso, "", res.IDDps)
		if aErr != nil {
			l.Error().Err(aErr).Msg("dps reconciler: falha ao autorizar nota")
			return
		}
		if !updated {
			return // finalizada por outro caminho
		}
		l.Info().Str("chave_acesso", res.ChaveAcesso).Msg("dps reconciler: nota AUTORIZADA pela Receita (resposta do envio tinha se perdido)")
		if r.counter != nil {
			if _, cErr := r.counter.IncrementEmitidasEmpresa(ctx, n.EmpresaID); cErr != nil {
				l.Error().Err(cErr).Msg("dps reconciler: falha ao incrementar contador")
			}
		}
		if r.publisher != nil && n.WebhookURL != nil && *n.WebhookURL != "" {
			msg := webhook.DeliveryMessage{
				NotaID:     n.ID.String(),
				Event:      webhook.EventAutorizada,
				Status:     "AUTORIZADA",
				NumeroNFSe: res.ChaveAcesso,
				WebhookURL: *n.WebhookURL,
				EmitidaEm:  time.Now().UTC(),
			}
			if pErr := r.publisher.Publish(ctx, msg); pErr != nil {
				l.Error().Err(pErr).Msg("dps reconciler: falha ao publicar webhook")
			}
		}
	}
}
