// Package nfse implements the HTTP mTLS adapter for the NFS-e Nacional API.
package nfse

import (
	"context"
	"crypto/tls"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/webhook"
	"github.com/rs/zerolog/log"
)

// CertLoader retrieves an A1 TLS certificate by its Secrets Manager ARN.
type CertLoader interface {
	GetCert(ctx context.Context, secretARN string) (*tls.Certificate, error)
}

// Poller periodically queries the Receita Federal API for PROCESSANDO notas
// that already have a protocolo_receita, and finalises their status.
type Poller struct {
	repo       *NotaRepository
	adapter    *Adapter
	certLoader CertLoader
	publisher  *webhook.Publisher
	interval   time.Duration
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
}

// consultaNota queries one nota and updates its status.
func (p *Poller) consultaNota(ctx context.Context, nc NotaParaConsulta) {
	l := log.Ctx(ctx).With().
		Str("nota_id", nc.ID.String()).
		Str("protocolo", derefStr(nc.ProtocoloReceita)).
		Logger()

	if nc.CertSecretARN == nil {
		l.Warn().Msg("poller: nota has no cert_secret_arn — skipping")
		return
	}

	cert, err := p.certLoader.GetCert(ctx, *nc.CertSecretARN)
	if err != nil {
		l.Error().Err(err).Msg("poller: failed to load certificate")
		return
	}

	resp, err := p.adapter.Consultar(ctx, nc.CNPJ, *nc.ProtocoloReceita, cert)
	if err != nil {
		l.Warn().Err(err).Msg("poller: consulta request failed — will retry next sweep")
		return
	}

	switch resp.Status {
	case "AUTORIZADA":
		if err := p.repo.Autorizar(ctx, nc.ID, resp.NumeroNFSe, resp.CodVerificacao, resp.XMLRetorno); err != nil {
			l.Error().Err(err).Msg("poller: failed to autorizar nota in DB")
			return
		}
		l.Info().Str("numero_nfse", resp.NumeroNFSe).Msg("poller: nota autorizada")
		p.publishEvent(ctx, nc, webhook.EventAutorizada, resp.NumeroNFSe, resp.CodVerificacao, "", "")

	case "REJEITADA":
		errCodigo := ""
		errDescricao := ""
		if len(resp.Erros) > 0 {
			errCodigo = resp.Erros[0].Codigo
			errDescricao = resp.Erros[0].Descricao
		}
		if err := p.repo.Rejeitar(ctx, nc.ID, errCodigo, errDescricao); err != nil {
			l.Error().Err(err).Msg("poller: failed to rejeitar nota in DB")
			return
		}
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

// derefStr safely dereferences a *string.
func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
