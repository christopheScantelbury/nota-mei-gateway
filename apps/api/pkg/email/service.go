package email

import (
	"context"

	"github.com/rs/zerolog"
)

// Service wraps Client with domain-specific send methods.
type Service struct {
	client *Client
	log    zerolog.Logger
}

// NewService creates a Service backed by the given Client and logger.
func NewService(client *Client, logger zerolog.Logger) *Service {
	return &Service{
		client: client,
		log:    logger,
	}
}

// Enabled reports whether emails are actually delivered (Resend configured).
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
	id, err := s.client.Send(ctx, SendRequest{
		To:      []string{toEmail},
		Subject: "Nota Fiscal Autorizada — NFS-e " + numeroNFSe,
		HTML:    html,
	})
	l := s.log.With().Str("to_email", toEmail).Str("type", "nota_autorizada").Logger()
	if err != nil {
		l.Error().Err(err).Msg("email: send failed")
		return err
	}
	l.Info().Str("email_id", id).Msg("email: sent")
	return nil
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
	id, err := s.client.Send(ctx, SendRequest{
		To:      []string{toEmail},
		Subject: "Nota Fiscal Rejeitada — Código " + erroCodigo,
		HTML:    html,
	})
	l := s.log.With().Str("to_email", toEmail).Str("type", "nota_rejeitada").Logger()
	if err != nil {
		l.Error().Err(err).Msg("email: send failed")
		return err
	}
	l.Info().Str("email_id", id).Msg("email: sent")
	return nil
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
	id, err := s.client.Send(ctx, SendRequest{
		To:      []string{toEmail},
		Subject: "Bem-vindo ao Nota MEI Gateway — sua API Key",
		HTML:    html,
	})
	l := s.log.With().Str("to_email", toEmail).Str("type", "boas_vindas").Logger()
	if err != nil {
		l.Error().Err(err).Msg("email: send failed")
		return err
	}
	l.Info().Str("email_id", id).Msg("email: sent")
	return nil
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
	id, err := s.client.Send(ctx, SendRequest{
		To:      []string{toEmail},
		Subject: "Ação necessária: falha no pagamento da assinatura",
		HTML:    html,
	})
	l := s.log.With().Str("to_email", toEmail).Str("type", "pagamento_falhou").Logger()
	if err != nil {
		l.Error().Err(err).Msg("email: send failed")
		return err
	}
	l.Info().Str("email_id", id).Msg("email: sent")
	return nil
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
	id, err := s.client.Send(ctx, SendRequest{
		To:      []string{toEmail},
		Subject: "Bem-vindo ao Nota MEI Gateway — sua empresa ME foi cadastrada",
		HTML:    html,
	})
	l := s.log.With().Str("to_email", toEmail).Str("type", "boas_vindas_me").Logger()
	if err != nil {
		l.Error().Err(err).Msg("email: send failed")
		return err
	}
	l.Info().Str("email_id", id).Msg("email: sent")
	return nil
}
