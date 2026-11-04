package email

import (
	"context"
	"errors"

	"github.com/rs/zerolog"
)

// Service wraps Client with domain-specific send methods.
type Service struct {
	client *Client
	outbox *Outbox
	log    zerolog.Logger
}

// WithOutbox liga a fila de entrega garantida (email_outbox).
func (s *Service) WithOutbox(o *Outbox) *Service {
	s.outbox = o
	return s
}

// enviar entrega pela fila (quando configurada) ou direto pelo client.
// Com fila, ErrEnfileirado significa "não saiu agora, mas vai sair".
func (s *Service) enviar(ctx context.Context, m Mensagem) error {
	l := s.log.With().Str("type", m.Tipo).Logger()
	var err error
	if s.outbox != nil && s.client.Enabled() {
		err = s.outbox.Enviar(ctx, m)
	} else {
		_, err = s.client.Send(ctx, SendRequest{To: []string{m.Para}, Subject: m.Assunto, HTML: m.HTML})
	}
	switch {
	case err == nil:
		l.Info().Msg("email: sent")
	case errors.Is(err, ErrEnfileirado):
		l.Warn().Msg("email: não saiu agora — na fila para reenvio")
	default:
		l.Error().Err(err).Msg("email: send failed")
	}
	return err
}

// NewService creates a Service backed by the given Client and logger.
func NewService(client *Client, logger zerolog.Logger) *Service {
	return &Service{
		client: client,
		log:    logger,
	}
}

// Enabled reports whether emails are actually delivered (SMTP configured).
// When false, the service runs in dev-noop mode.
func (s *Service) Enabled() bool { return s.client != nil && s.client.Enabled() }

// SendNotaAutorizada sends the nota-autorizada notification to the MEI.
func (s *Service) SendNotaAutorizada(
	ctx context.Context,
	toEmail, razaoSocial, numeroNFSe, codigoVerific, valorServico, pdfURL, xmlURL string,
) error {
	html := NotaAutorizadaHTML(NotaAutorizadaParams{
		RazaoSocial:   razaoSocial,
		NumeroNFSe:    numeroNFSe,
		CodigoVerific: codigoVerific,
		ValorServico:  valorServico,
		PdfURL:        pdfURL,
		XMLURL:        xmlURL,
	})
	return s.enviar(ctx, Mensagem{Tipo: "nota_autorizada", Para: toEmail, Assunto: "Nota Fiscal Autorizada — NFS-e " + numeroNFSe, HTML: html})
}

// SendNotaParaTomador entrega a NFS-e autorizada ao tomador (#274).
func (s *Service) SendNotaParaTomador(ctx context.Context, toEmail string, p NotaTomadorParams) error {
	assunto := "Nota fiscal de " + p.PrestadorNome
	if p.ValorServico != "" {
		assunto += " — R$ " + p.ValorServico
	}
	return s.enviar(ctx, Mensagem{Tipo: "nota_tomador", Para: toEmail, Assunto: assunto, HTML: NotaTomadorHTML(p), NotaID: p.NotaID, EmpresaID: p.EmpresaID})
}

// SendNotaRejeitada sends the nota-rejeitada notification to the MEI.
func (s *Service) SendNotaRejeitada(
	ctx context.Context,
	toEmail, razaoSocial, erroCodigo, erroDescricao string,
) error {
	html := NotaRejeitadaHTML(NotaRejeitadaParams{
		RazaoSocial:   razaoSocial,
		ErroCodigo:    erroCodigo,
		ErroDescricao: erroDescricao,
	})
	return s.enviar(ctx, Mensagem{Tipo: "nota_rejeitada", Para: toEmail, Assunto: "Nota Fiscal Rejeitada — Código " + erroCodigo, HTML: html})
}

// SendBoasVindas sends the welcome email with the API key to a new MEI.
func (s *Service) SendBoasVindas(
	ctx context.Context,
	toEmail, razaoSocial, cnpj, apiKey string,
) error {
	html := BoasVindasHTML(BoasVindasParams{
		RazaoSocial: razaoSocial,
		CNPJ:        cnpj,
		APIKey:      apiKey,
	})
	return s.enviar(ctx, Mensagem{Tipo: "boas_vindas", Para: toEmail, Assunto: "Bem-vindo ao Nota MEI Gateway — sua API Key", HTML: html})
}

// SendPagamentoFalhou sends the payment-failed alert to the MEI.
func (s *Service) SendPagamentoFalhou(
	ctx context.Context,
	toEmail, razaoSocial, planoNome, valorBRL, portalURL string,
) error {
	html := PagamentoFalhouHTML(PagamentoFalhouParams{
		RazaoSocial: razaoSocial,
		PlanoNome:   planoNome,
		ValorBRL:    valorBRL,
		PortalURL:   portalURL,
	})
	return s.enviar(ctx, Mensagem{Tipo: "pagamento_falhou", Para: toEmail, Assunto: "Ação necessária: falha no pagamento da assinatura", HTML: html})
}

// SendBoasVindasME sends the welcome email to a new ME/EPP empresa with
// ISS recolhimento guidance tailored to the regime tributário.
func (s *Service) SendBoasVindasME(
	ctx context.Context,
	toEmail, razaoSocial, apiKey, regimeTributario string,
) error {
	html := BoasVindasMEHTML(BoasVindasMEParams{
		RazaoSocial:      razaoSocial,
		APIKey:           apiKey,
		RegimeTributario: regimeTributario,
	})
	return s.enviar(ctx, Mensagem{Tipo: "boas_vindas_me", Para: toEmail, Assunto: "Bem-vindo ao Nota MEI Gateway — sua empresa ME foi cadastrada", HTML: html})
}

// SendRecorrenciaSemCertificado avisa o dono que a automação está parada até
// ele enviar o certificado A1 (#268/#270).
func (s *Service) SendRecorrenciaSemCertificado(ctx context.Context, toEmail, razaoSocial, nomeRecorrencia string) error {
	html := RecorrenciaSemCertificadoHTML(razaoSocial, nomeRecorrencia, "https://www.emitirnotafacil.com.br/configuracoes")
	return s.enviar(ctx, Mensagem{
		Tipo:    "recorrencia_sem_certificado",
		Para:    toEmail,
		Assunto: "Sua nota automática está aguardando o certificado digital",
		HTML:    html,
	})
}
