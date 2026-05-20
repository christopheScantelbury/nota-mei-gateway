// Package nfse implements the HTTP mTLS adapter for the NFS-e Nacional API.
package nfse

import (
	"context"
	"crypto/tls"
	"fmt"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/metrics"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/webhook"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// CertLoader retrieves an A1 TLS certificate by its Secrets Manager ARN.
type CertLoader interface {
	GetCert(ctx context.Context, secretARN string) (*tls.Certificate, error)
}

// EmissaoCounter increments the monthly emission counter for a MEI in the DB.
type EmissaoCounter interface {
	IncrementEmitidas(ctx context.Context, meiID uuid.UUID) (int, error)
}

// PollerLocker acquires a distributed lock per nota so that concurrent Poller
// instances (running in multiple Worker pods) do not process the same nota twice.
// Returns (true, nil) when the lock was acquired; (false, nil) when another
// instance already holds it.
type PollerLocker interface {
	Acquire(ctx context.Context, key string, ttl time.Duration) (bool, error)
}

const (
	// pollerLockTTL matches the Worker sweep interval (30s) plus generous overhead.
	// A nota whose lock has expired is safe to re-process — the Autorizar/Rejeitar
	// calls are guarded by a WHERE status = 'PROCESSANDO' clause.
	pollerLockTTL = 2 * time.Minute
)

// Poller periodically queries the Receita Federal API for PROCESSANDO notas
// that already have a protocolo_receita, and finalises their status.
type Poller struct {
	repo           *NotaRepository
	adapter        *Adapter
	certLoader     CertLoader
	publisher      *webhook.Publisher
	interval       time.Duration
	billingCounter EmissaoCounter // optional; nil disables DB counter increment
	locker         PollerLocker   // optional; nil disables per-nota distributed lock
}

// NewPoller creates a Poller with the given interval between sweeps.
func NewPoller(
	repo *NotaRepository,
	adapter *Adapter,
	certLoader CertLoader,
	publisher *webhook.Publisher,
	interval time.Duration,
) *Poller {
	return &Poller{
		repo:       repo,
		adapter:    adapter,
		certLoader: certLoader,
		publisher:  publisher,
		interval:   interval,
	}
}

// WithBillingCounter attaches an EmissaoCounter so the poller increments
// total_emitidas in the DB whenever a nota is authorised.
func (p *Poller) WithBillingCounter(c EmissaoCounter) *Poller {
	p.billingCounter = c
	return p
}

// WithLocker attaches a distributed locker so concurrent Poller instances
// (across multiple Worker pods) never process the same nota in parallel (SCALE-01).
func (p *Poller) WithLocker(l PollerLocker) *Poller {
	p.locker = l
	return p
}

// TODO(BE-04): call emailSvc.SendNotaAutorizada / SendNotaRejeitada here
// Requires fetching the MEI's email from the meis table.

// Run starts the polling loop. It blocks until ctx is cancelled.
func (p *Poller) Run(ctx context.Context) {
	log.Ctx(ctx).Info().Dur("interval", p.interval).Msg("nfse poller started")
	ticker := time.NewTicker(p.interval)
	defer ticker.Stop()

	// Run one sweep immediately on startup.
	p.sweep(ctx)

	for {
		select {
		case <-ctx.Done():
			log.Ctx(ctx).Info().Msg("nfse poller stopping")
			return
		case <-ticker.C:
			p.sweep(ctx)
		}
	}
}

// sweep fetches up to 50 PROCESSANDO notas and queries the Receita Federal.
func (p *Poller) sweep(ctx context.Context) {
	start := time.Now()

	notas, err := p.repo.FindProcessandoComProtocolo(ctx, 50)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("poller: failed to query processando notas")
		return
	}
	if len(notas) == 0 {
		return
	}

	log.Ctx(ctx).Debug().Int("count", len(notas)).Msg("poller: consulting receita federal")

	for _, nc := range notas {
		p.consultaNota(ctx, nc)
	}

	metrics.PollerSweepDuration.Observe(time.Since(start).Seconds())
}

// consultaNota queries one nota and updates its status.
func (p *Poller) consultaNota(ctx context.Context, nc NotaParaConsulta) {
	l := log.Ctx(ctx).With().
		Str("nota_id", nc.ID.String()).
		Str("protocolo", derefStr(nc.ProtocoloReceita)).
		Logger()

	// ── Distributed lock (SCALE-01) ─────────────────────────────────────────
	// When multiple Worker instances are running, two pods can fetch the same
	// nota in their sweep windows.  The per-nota Redis lock (TTL = 2 min)
	// ensures only one instance processes it; the Autorizar/Rejeitar DB guard
	// (AND status = 'PROCESSANDO') is a belt-and-suspenders second defence.
	if p.locker != nil {
		lockKey := fmt.Sprintf("nfs:poll:%s", nc.ID.String())
		acquired, err := p.locker.Acquire(ctx, lockKey, pollerLockTTL)
		if err != nil {
			l.Error().Err(err).Msg("poller: failed to acquire redis lock — skipping nota")
			return
		}
		if !acquired {
			l.Debug().Msg("poller: nota already locked by another instance — skipping")
			return
		}
	}

	if nc.CertSecretARN == nil {
		l.Warn().Msg("poller: nota has no cert_secret_arn — skipping")
		return
	}

	cert, err := p.certLoader.GetCert(ctx, *nc.CertSecretARN)
	if err != nil {
		l.Error().Err(err).Msg("poller: failed to load certificate")
		return
	}

	// Route to SEFIN Nacional endpoint for ME/EPP (DPS path), ABRASF for MEI.
	var resp *ConsultaResponse
	if nc.EmpresaTipo != "" {
		resp, err = p.adapter.ConsultarDPS(ctx, nc.CNPJ, *nc.ProtocoloReceita, cert)
	} else {
		resp, err = p.adapter.Consultar(ctx, nc.CNPJ, *nc.ProtocoloReceita, cert)
	}
	if err != nil {
		l.Warn().Err(err).Msg("poller: consulta request failed — will retry next sweep")
		return
	}

	switch resp.Status {
	case "AUTORIZADA":
		updated, err := p.repo.Autorizar(ctx, nc.ID, resp.NumeroNFSe, resp.CodVerificacao, resp.XMLRetorno)
		if err != nil {
			metrics.PollerNotasProcessed.WithLabelValues("erro").Inc()
			l.Error().Err(err).Msg("poller: failed to autorizar nota in DB")
			return
		}
		if !updated {
			l.Debug().Msg("poller: nota already finalised by another instance — skipping counter/webhook")
			return
		}
		metrics.PollerNotasProcessed.WithLabelValues("autorizada").Inc()
		l.Info().Str("numero_nfse", resp.NumeroNFSe).Msg("poller: nota autorizada")
		p.incrementCounter(ctx, nc.MeiID)
		p.publishEvent(ctx, nc, webhook.EventAutorizada, resp.NumeroNFSe, resp.CodVerificacao, "", "")

	case "REJEITADA":
		errCodigo := ""
		errDescricao := ""
		if len(resp.Erros) > 0 {
			errCodigo = resp.Erros[0].Codigo
			errDescricao = resp.Erros[0].Descricao
			// ME-33: enrich with known rejection description when the API returns a bare code.
			if errDescricao == "" || errDescricao == errCodigo {
				errDescricao = DescricaoRejeicao(errCodigo)
			}
		}
		updated, err := p.repo.Rejeitar(ctx, nc.ID, errCodigo, errDescricao)
		if err != nil {
			metrics.PollerNotasProcessed.WithLabelValues("erro").Inc()
			l.Error().Err(err).Msg("poller: failed to rejeitar nota in DB")
			return
		}
		if !updated {
			l.Debug().Msg("poller: nota already finalised by another instance — skipping webhook")
			return
		}
		metrics.PollerNotasProcessed.WithLabelValues("rejeitada").Inc()
		l.Warn().Str("erro", errCodigo).Msg("poller: nota rejeitada")
		p.publishEvent(ctx, nc, webhook.EventRejeitada, "", "", errCodigo, errDescricao)

	default:
		// Still PROCESSANDO — nothing to do yet.
		l.Debug().Str("status", resp.Status).Msg("poller: nota still processando")
	}
}

// publishEvent enqueues a webhook delivery for a finalised nota.
func (p *Poller) publishEvent(
	ctx context.Context,
	nc NotaParaConsulta,
	event webhook.EventType,
	numeroNFSe, codVerificacao string,
	erroCodigo, erroDescricao string,
) {
	if nc.WebhookURL == nil || *nc.WebhookURL == "" {
		return
	}

	msg := webhook.DeliveryMessage{
		NotaID:         nc.ID.String(),
		Event:          event,
		NumeroNFSe:     numeroNFSe,
		CodVerificacao: codVerificacao,
		WebhookURL:     *nc.WebhookURL,
		ErroCodigo:     erroCodigo,
		ErroDescricao:  erroDescricao,
	}
	switch event {
	case webhook.EventAutorizada:
		msg.Status = "AUTORIZADA"
		msg.EmitidaEm = time.Now().UTC()
	case webhook.EventRejeitada:
		msg.Status = "REJEITADA"
	}

	if err := p.publisher.Publish(ctx, msg); err != nil {
		log.Ctx(ctx).Error().Err(err).Str("nota_id", nc.ID.String()).Msg("poller: failed to publish webhook event")
	}
}

// incrementCounter increments the monthly emission counter in the DB if a
// billing counter is configured. Logs and ignores errors — the nota is already
// authorised at this point.
func (p *Poller) incrementCounter(ctx context.Context, meiID uuid.UUID) {
	if p.billingCounter == nil {
		return
	}
	if _, err := p.billingCounter.IncrementEmitidas(ctx, meiID); err != nil {
		log.Ctx(ctx).Error().Err(err).Str("mei_id", meiID.String()).
			Msg("poller: failed to increment emissoes_mensais counter")
	}
}

// derefStr safely dereferences a *string.
func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
