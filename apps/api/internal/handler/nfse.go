// Package handler implements the Fiber HTTP handlers for the Nota MEI Gateway API.
package handler

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/billing"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/document"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/nfse"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/webhook"
	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/storage"
	stripeClient "github.com/christopheScantelbury/nota-mei-gateway/api/pkg/stripe"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// CertProvider retrieves a TLS certificate from the secret store.
type CertProvider interface {
	GetCert(ctx context.Context, secretARN string) (*tls.Certificate, error)
}

// NFSeHandler holds all dependencies needed to serve NFS-e endpoints.
type NFSeHandler struct {
	notaRepo     *nfse.NotaRepository
	adapter      *nfse.Adapter
	builder      *document.Builder    // MEI RPS builder
	dpsBuilder   *document.DPSBuilder // ME/EPP DPS builder
	signer       document.Signer
	certProv     CertProvider
	billingRepo  *billing.Repository
	billingGrd   *billing.Guard
	publisher    *webhook.Publisher
	nbsValidator *document.NBSValidator
	issLookup    *document.ISSLookup
	sc           *stripeClient.Client // optional — nil disables metered billing
	store        storage.ObjectStore  // optional — nil disables S3 upload (STOR-01)
	apiBase      string
	whSecret     string // HMAC secret used to sign webhook payloads
	devMode      bool   // true in development — skips cert loading for NoopSigner
}

// NewNFSeHandler creates an NFSeHandler with all its dependencies.
func NewNFSeHandler(
	notaRepo *nfse.NotaRepository,
	adapter *nfse.Adapter,
	builder *document.Builder,
	dpsBuilder *document.DPSBuilder,
	signer document.Signer,
	certProv CertProvider,
	billingRepo *billing.Repository,
	billingGrd *billing.Guard,
	publisher *webhook.Publisher,
	apiBase, whSecret string,
) *NFSeHandler {
	return &NFSeHandler{
		notaRepo:    notaRepo,
		adapter:     adapter,
		builder:     builder,
		dpsBuilder:  dpsBuilder,
		signer:      signer,
		certProv:    certProv,
		billingRepo: billingRepo,
		billingGrd:  billingGrd,
		publisher:   publisher,
		apiBase:     apiBase,
		whSecret:    whSecret,
	}
}

// WithDevMode skips certificate loading, enabling E2E tests in development
// where no real A1 certificate has been uploaded. The NoopSigner handles nil certs.
func (h *NFSeHandler) WithDevMode() *NFSeHandler {
	h.devMode = true
	return h
}

// WithStripeClient sets the Stripe client for metered overage billing.
// When set, EmitirNota will call stripe.UsageRecords.New for every note
// authorized beyond the plan's included emission limit.
func (h *NFSeHandler) WithStripeClient(sc *stripeClient.Client) *NFSeHandler {
	h.sc = sc
	return h
}

// WithNBSValidator sets the NBS validator. When set, EmitirNota will reject
// unknown NBS codes with INVALID_NBS before processing the request.
func (h *NFSeHandler) WithNBSValidator(v *document.NBSValidator) *NFSeHandler {
	h.nbsValidator = v
	return h
}

// WithISSLookup sets the ISS rate lookup table. When set, EmitirNota will
// resolve the effective alíquota from the municipality default when the caller
// does not supply one explicitly.
func (h *NFSeHandler) WithISSLookup(l *document.ISSLookup) *NFSeHandler {
	h.issLookup = l
	return h
}

// WithStorage sets the ObjectStore used to persist fiscal documents (STOR-01).
// When set, XMLs and PDFs are uploaded to S3 instead of being stored in the DB.
func (h *NFSeHandler) WithStorage(s storage.ObjectStore) *NFSeHandler {
	h.store = s
	return h
}

// ─── POST /v1/nfse ─────────────────────────────────────────────────────────

// EmitirNota handles POST /v1/nfse.
//
// Routes by company type:
//   - MEI  → RPS builder (ABRASF/municipal) via the meis table
//   - ME/EPP → DPS builder (SEFIN Nacional) via the empresas table
func (h *NFSeHandler) EmitirNota(c *fiber.Ctx) error {
	// Detect company type from context locals set by auth.Middleware.
	mei := auth.GetMEI(c)
	empresa := auth.GetEmpresa(c)

	if mei == nil && empresa == nil {
		return internalError(c, "nenhuma empresa autenticada no contexto")
	}

	var req document.EmissaoRequest
	if err := c.BodyParser(&req); err != nil {
		return validationError(c, "corpo da requisição inválido: "+err.Error())
	}
	if errs := validateEmissaoRequest(req); len(errs) > 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":      "VALIDATION_ERROR",
			"message":    "campos inválidos",
			"fields":     errs,
			"request_id": c.Locals("request_id"),
		})
	}

	// Route: ME/EPP uses the DPS path.
	if empresa != nil {
		return h.emitirNotaME(c, req, empresa)
	}
	// Legacy MEI path.
	return h.emitirNotaMEI(c, req, mei)
}

// emitirNotaMEI handles POST /v1/nfse for MEI companies (RPS/ABRASF path).
func (h *NFSeHandler) emitirNotaMEI(c *fiber.Ctx, req document.EmissaoRequest, mei *auth.MEI) error {
	// ── NBS validation ────────────────────────────────────────────────────
	if h.nbsValidator != nil {
		if err := h.nbsValidator.Validate(c.Context(), req.Servico.CodigoNBS); err != nil {
			if errors.Is(err, document.ErrInvalidNBS) {
				return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
					"error":      "INVALID_NBS",
					"message":    "código NBS inválido ou não encontrado",
					"request_id": c.Locals("request_id"),
				})
			}
			log.Ctx(c.Context()).Error().Err(err).Str("codigo_nbs", req.Servico.CodigoNBS).Msg("nbs validation error")
			return internalError(c, "erro ao validar código NBS")
		}
	}

	// ── 1. Billing check ──────────────────────────────────────────────────
	em, err := h.billingRepo.GetOrCreateEmissaoMensal(c.Context(), mei.ID)
	if err != nil {
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", mei.ID.String()).Msg("billing getOrCreate failed")
		return internalError(c, "erro ao verificar limite de emissões")
	}

	if denied, resp := h.checkStripeSubscription(c, mei.ID, em); denied {
		return resp
	}

	allowed, err := h.billingGrd.Allow(c.Context(), mei.ID, mei.PlanoLimite)
	if err != nil {
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", mei.ID.String()).Msg("billing guard error")
		return internalError(c, "erro ao verificar limite de emissões")
	}
	if !allowed {
		return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
			"error":      "PLAN_LIMIT_REACHED",
			"message":    fmt.Sprintf("limite de %d notas mensais atingido", mei.PlanoLimite),
			"request_id": c.Locals("request_id"),
		})
	}

	// ── 2. Allocate RPS number ────────────────────────────────────────────
	numeroRPS, err := h.notaRepo.NextNumeroRPS(c.Context(), mei.ID)
	if err != nil {
		return internalError(c, "erro ao alocar número de RPS")
	}

	// ── 3. Resolve ISS rate ───────────────────────────────────────────────
	if h.issLookup != nil {
		req.Servico.AliquotaISS = h.issLookup.Resolve(mei.MunicipioIBGE, req.Servico.AliquotaISS)
	}

	// ── 4. Build RPS XML ──────────────────────────────────────────────────
	xmlDoc, err := h.builder.Build(req, mei.CNPJ, mei.MunicipioIBGE, numeroRPS)
	if err != nil {
		return validationError(c, "erro ao construir RPS: "+err.Error())
	}

	// ── 5. Load certificate ───────────────────────────────────────────────
	cert, err := h.loadCert(c.Context(), mei)
	if err != nil {
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", mei.ID.String()).Msg("certificate load failed")
		return internalError(c, "erro ao carregar certificado digital")
	}

	// ── 6. Sign XML ───────────────────────────────────────────────────────
	signedXML, err := h.signer.Sign(c.Context(), xmlDoc, cert)
	if err != nil {
		return internalError(c, "erro ao assinar XML")
	}

	// ── 7. Persist nota ───────────────────────────────────────────────────
	// After ARCH-03, empresa_id = mei_id for all MEI rows — pass both.
	nota, err := h.notaRepo.Create(c.Context(), nfse.CreateNotaInput{
		MeiID:          mei.ID,
		EmpresaID:      mei.ID, // empresa_id = mei_id for MEI (ARCH-03 invariant)
		NumeroRPS:      numeroRPS,
		XMLEnviado:     string(signedXML),
		WebhookURL:     req.WebhookURL,
		TomadorDoc:     req.Tomador.Documento,
		TomadorNome:    req.Tomador.RazaoSocial,
		ValorServico:   req.Servico.Valor,
		Competencia:    req.Competencia,
		IdempotencyKey: c.Get("Idempotency-Key"),
	})
	if err != nil {
		return internalError(c, "erro ao salvar nota")
	}

	// ── 7a. Upload signed RPS XML to S3 (STOR-01) ─────────────────────────
	if h.store != nil {
		s3Key := storage.S3KeyForRPS(mei.ID.String(), nota.ID.String())
		if uploadErr := h.store.Put(c.Context(), s3Key, "application/xml", signedXML); uploadErr != nil {
			log.Ctx(c.Context()).Error().Err(uploadErr).
				Str("nota_id", nota.ID.String()).
				Str("s3_key", s3Key).
				Msg("falha ao fazer upload do RPS XML para S3 (non-fatal)")
		} else {
			if setErr := h.notaRepo.SetXMLS3Key(c.Context(), nota.ID, s3Key); setErr != nil {
				log.Ctx(c.Context()).Warn().Err(setErr).
					Str("nota_id", nota.ID.String()).
					Msg("falha ao registrar xml_s3_key no banco (non-fatal)")
			}
		}
	}

	log.Ctx(c.Context()).Info().
		Str("mei_id", mei.ID.String()).
		Str("nota_id", nota.ID.String()).
		Int64("numero_rps", numeroRPS).
		Msg("nota MEI criada, enviando para Receita Federal")

	// ── 8. Send to Receita Federal ─────────────────────────────────────────
	if h.devMode {
		return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
			"nota_id":  nota.ID,
			"status":   "PROCESSANDO",
			"mensagem": "Nota enviada para processamento [dev mode]",
		})
	}

	return h.enviarEProcessar(c, nota, signedXML, cert, em, mei.ID, mei.PlanoLimite)
}

// emitirNotaME handles POST /v1/nfse for ME/EPP companies (DPS/SEFIN path).
func (h *NFSeHandler) emitirNotaME(c *fiber.Ctx, req document.EmissaoRequest, empresa *auth.Empresa) error {
	ctx := c.Context()

	// ── ME-21: Validar município habilitado para NFS-e Nacional ───────────
	if h.issLookup != nil && !h.issLookup.IsHabilitado(empresa.MunicipioIBGE) {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":      "MUNICIPIO_NAO_HABILITADO",
			"message":    "município não habilitado para emissão no NFS-e Nacional",
			"ibge":       empresa.MunicipioIBGE,
			"request_id": c.Locals("request_id"),
		})
	}

	// ── NBS validation ────────────────────────────────────────────────────
	if h.nbsValidator != nil {
		if err := h.nbsValidator.Validate(ctx, req.Servico.CodigoNBS); err != nil {
			if errors.Is(err, document.ErrInvalidNBS) {
				return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
					"error":      "INVALID_NBS",
					"message":    "código NBS inválido ou não encontrado",
					"request_id": c.Locals("request_id"),
				})
			}
			log.Ctx(ctx).Error().Err(err).Str("codigo_nbs", req.Servico.CodigoNBS).Msg("nbs validation error")
			return internalError(c, "erro ao validar código NBS")
		}
	}

	// ── 1. Billing check ──────────────────────────────────────────────────
	em, err := h.billingRepo.GetOrCreateEmissaoMensalEmpresa(ctx, empresa.ID)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Str("empresa_id", empresa.ID.String()).Msg("billing getOrCreate failed")
		return internalError(c, "erro ao verificar limite de emissões")
	}

	if denied, resp := h.checkStripeSubscription(c, empresa.ID, em); denied {
		return resp
	}

	// Bypass billing guard when trial_me is active.
	if !empresa.TrialMe {
		allowed, guardErr := h.billingGrd.Allow(ctx, empresa.ID, empresa.PlanoLimite)
		if guardErr != nil {
			log.Ctx(ctx).Error().Err(guardErr).Str("empresa_id", empresa.ID.String()).Msg("billing guard error")
			return internalError(c, "erro ao verificar limite de emissões")
		}
		if !allowed {
			return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
				"error":      "PLAN_LIMIT_REACHED",
				"message":    fmt.Sprintf("limite de %d notas mensais atingido", empresa.PlanoLimite),
				"request_id": c.Locals("request_id"),
			})
		}
	}

	// ── 2. Allocate DPS number ───────────────────────────────────────────
	numeroDPS, err := h.notaRepo.NextNumeroDPS(ctx, empresa.ID)
	if err != nil {
		return internalError(c, "erro ao alocar número de DPS")
	}

	// ── 3. Resolve ISS rate ───────────────────────────────────────────────
	if h.issLookup != nil {
		req.Servico.AliquotaISS = h.issLookup.Resolve(empresa.MunicipioIBGE, req.Servico.AliquotaISS)
	}

	// ── 4. Build DPS XML ──────────────────────────────────────────────────
	dpsResult, err := h.dpsBuilder.Build(req, empresa, numeroDPS)
	if err != nil {
		// ErrValidation → 422 (e.g. iss_retido nil for LP)
		var validErr *document.ErrValidation
		if errors.As(err, &validErr) {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"error":      "VALIDATION_ERROR",
				"message":    validErr.Message,
				"fields":     []fiber.Map{{"field": validErr.Field, "message": validErr.Message}},
				"request_id": c.Locals("request_id"),
			})
		}
		return validationError(c, "erro ao construir DPS: "+err.Error())
	}

	// ── 5. Load certificate ───────────────────────────────────────────────
	cert, err := h.loadCertEmpresa(ctx, empresa)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Str("empresa_id", empresa.ID.String()).Msg("certificate load failed")
		return internalError(c, "erro ao carregar certificado digital")
	}

	// ── 6. Sign XML ───────────────────────────────────────────────────────
	signedXML, err := h.signer.Sign(ctx, dpsResult.XML, cert)
	if err != nil {
		return internalError(c, "erro ao assinar DPS")
	}

	// ── 7. Persist nota ───────────────────────────────────────────────────
	// MeiID is intentionally uuid.Nil — ME/EPP companies have no row in meis.
	nota, err := h.notaRepo.Create(ctx, nfse.CreateNotaInput{
		EmpresaID:      empresa.ID,
		NumeroRPS:      numeroDPS,
		XMLEnviado:     string(signedXML),
		WebhookURL:     req.WebhookURL,
		TomadorDoc:     req.Tomador.Documento,
		TomadorNome:    req.Tomador.RazaoSocial,
		ValorServico:   req.Servico.Valor,
		Competencia:    req.Competencia,
		IdempotencyKey: c.Get("Idempotency-Key"),
	})
	if err != nil {
		return internalError(c, "erro ao salvar nota")
	}

	// ── 7a. Upload DPS XML to S3 (STOR-01) ────────────────────────────────
	if h.store != nil {
		s3Key := storage.S3KeyForRPS(empresa.ID.String(), nota.ID.String())
		if uploadErr := h.store.Put(ctx, s3Key, "application/xml", signedXML); uploadErr != nil {
			log.Ctx(ctx).Error().Err(uploadErr).
				Str("nota_id", nota.ID.String()).
				Msg("falha ao fazer upload do DPS XML para S3 (non-fatal)")
		} else {
			if setErr := h.notaRepo.SetXMLS3Key(ctx, nota.ID, s3Key); setErr != nil {
				log.Ctx(ctx).Warn().Err(setErr).
					Str("nota_id", nota.ID.String()).
					Msg("falha ao registrar xml_s3_key no banco (non-fatal)")
			}
		}
	}

	log.Ctx(ctx).Info().
		Str("empresa_id", empresa.ID.String()).
		Str("nota_id", nota.ID.String()).
		Int64("numero_dps", numeroDPS).
		Str("regime", empresa.RegimeTributario).
		Bool("iss_retido", dpsResult.ISSRetido).
		Msg("DPS criada, enviando para SEFIN Nacional")

	// ── 8. Send to SEFIN Nacional ──────────────────────────────────────────
	if h.devMode {
		return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
			"nota_id":           nota.ID,
			"status":            "PROCESSANDO",
			"regime_tributario": empresa.RegimeTributario,
			"iss_retido":        dpsResult.ISSRetido,
			"valor_iss":         dpsResult.ValorISS,
			"valor_liquido":     dpsResult.ValorLiquido,
			"mensagem":          "Nota enviada para processamento [dev mode]",
		})
	}

	// Build warnings slice (e.g. orgao_publico ISS forced).
	var warnings []string
	if req.Tomador.TipoOrgao == "ORGAO_PUBLICO" && req.IssRetido != nil && !*req.IssRetido {
		warnings = append(warnings, "ISS forçado para retido: tomador é órgão público (Art. 6 LC 116/2003)")
	}

	envioResp, envErr := h.adapter.Enviar(ctx, signedXML, cert)
	if envErr != nil {
		log.Ctx(ctx).Warn().Err(envErr).Str("nota_id", nota.ID.String()).Msg("envio DPS falhou, mantendo PROCESSANDO")
		resp := fiber.Map{
			"nota_id":           nota.ID,
			"status":            "PROCESSANDO",
			"regime_tributario": empresa.RegimeTributario,
			"iss_retido":        dpsResult.ISSRetido,
			"valor_iss":         dpsResult.ValorISS,
			"valor_liquido":     dpsResult.ValorLiquido,
			"mensagem":          "Nota enviada para processamento (retry automático)",
		}
		if len(warnings) > 0 {
			resp["avisos"] = warnings
		}
		return c.Status(fiber.StatusAccepted).JSON(resp)
	}

	// ── 9. Process response ────────────────────────────────────────────────
	if len(envioResp.Erros) > 0 {
		codigo := envioResp.Erros[0].Codigo
		descricao := envioResp.Erros[0].Descricao
		_, _ = h.notaRepo.Rejeitar(ctx, nota.ID, codigo, descricao)
		h.publishEvent(ctx, nota, webhook.EventRejeitada, "", "", codigo, descricao)
		return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
			"nota_id":           nota.ID,
			"status":            "REJEITADA",
			"regime_tributario": empresa.RegimeTributario,
			"erro_codigo":       codigo,
			"erro_descricao":    descricao,
		})
	}

	if envioResp.NumeroNFSe != "" {
		_, _ = h.notaRepo.Autorizar(ctx, nota.ID, envioResp.NumeroNFSe, envioResp.CodVerificacao, "")
		total, _ := h.billingRepo.IncrementEmitidasEmpresa(ctx, empresa.ID)
		h.publishEvent(ctx, nota, webhook.EventAutorizada, envioResp.NumeroNFSe, envioResp.CodVerificacao, "", "")
		h.reportOverageIfNeeded(ctx, nota.ID.String(), total, empresa.PlanoLimite, em)
	} else if envioResp.Protocolo != "" {
		_ = h.notaRepo.SetProtocolo(ctx, nota.ID, envioResp.Protocolo)
	}

	resp := fiber.Map{
		"nota_id":           nota.ID,
		"status":            "PROCESSANDO",
		"regime_tributario": empresa.RegimeTributario,
		"iss_retido":        dpsResult.ISSRetido,
		"valor_iss":         dpsResult.ValorISS,
		"valor_liquido":     dpsResult.ValorLiquido,
		"mensagem":          "Nota enviada para processamento",
	}
	if len(warnings) > 0 {
		resp["avisos"] = warnings
	}
	return c.Status(fiber.StatusAccepted).JSON(resp)
}

// enviarEProcessar sends signed XML to Receita Federal and processes the response.
// Shared by the MEI path.
func (h *NFSeHandler) enviarEProcessar(
	c *fiber.Ctx,
	nota *nfse.Nota,
	signedXML []byte,
	cert *tls.Certificate,
	em *billing.EmissaoMensal,
	ownerID uuid.UUID,
	planoLimite int,
) error {
	ctx := c.Context()

	envioResp, err := h.adapter.Enviar(ctx, signedXML, cert)
	if err != nil {
		log.Ctx(ctx).Warn().Err(err).Str("nota_id", nota.ID.String()).Msg("envio falhou, mantendo PROCESSANDO")
		return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
			"nota_id":  nota.ID,
			"status":   "PROCESSANDO",
			"mensagem": "Nota enviada para processamento (retry automático)",
		})
	}

	if len(envioResp.Erros) > 0 {
		codigo := envioResp.Erros[0].Codigo
		descricao := envioResp.Erros[0].Descricao
		_, _ = h.notaRepo.Rejeitar(ctx, nota.ID, codigo, descricao)
		log.Ctx(ctx).Warn().
			Str("nota_id", nota.ID.String()).
			Str("erro_codigo", codigo).
			Msg("nota rejeitada pela Receita Federal")
		h.publishEvent(ctx, nota, webhook.EventRejeitada, envioResp.NumeroNFSe, envioResp.CodVerificacao, codigo, descricao)
		return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
			"nota_id":        nota.ID,
			"status":         "REJEITADA",
			"erro_codigo":    codigo,
			"erro_descricao": descricao,
		})
	}

	if envioResp.NumeroNFSe != "" {
		_, _ = h.notaRepo.Autorizar(ctx, nota.ID, envioResp.NumeroNFSe, envioResp.CodVerificacao, "")
		total, _ := h.billingRepo.IncrementEmitidas(ctx, ownerID)
		log.Ctx(ctx).Info().
			Str("nota_id", nota.ID.String()).
			Str("numero_nfse", envioResp.NumeroNFSe).
			Msg("nota autorizada")
		h.publishEvent(ctx, nota, webhook.EventAutorizada, envioResp.NumeroNFSe, envioResp.CodVerificacao, "", "")
		h.reportOverageIfNeeded(ctx, nota.ID.String(), total, planoLimite, em)
	} else if envioResp.Protocolo != "" {
		_ = h.notaRepo.SetProtocolo(ctx, nota.ID, envioResp.Protocolo)
	}

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"nota_id":  nota.ID,
		"status":   "PROCESSANDO",
		"mensagem": "Nota enviada para processamento",
	})
}

// ─── GET /v1/nfse ──────────────────────────────────────────────────────────

// ListarNotas handles GET /v1/nfse.
func (h *NFSeHandler) ListarNotas(c *fiber.Ctx) error {
	mei := auth.GetMEI(c)
	empresa := auth.GetEmpresa(c)
	if mei == nil && empresa == nil {
		return internalError(c, "nenhuma empresa autenticada no contexto")
	}

	limit := 20
	offset := 0
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 100 {
			limit = v
		}
	}
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			offset = (v - 1) * limit
		}
	}

	var notas []nfse.Nota
	var total int
	var listErr error
	if empresa != nil {
		notas, total, listErr = h.notaRepo.ListByEmpresa(c.Context(), empresa.ID, limit, offset)
	} else {
		notas, total, listErr = h.notaRepo.ListByMEI(c.Context(), mei.ID, limit, offset)
	}
	if listErr != nil {
		return internalError(c, "erro ao listar notas")
	}

	items := make([]fiber.Map, 0, len(notas))
	for _, n := range notas {
		items = append(items, notaToMap(n))
	}

	return c.JSON(fiber.Map{
		"total":  total,
		"limit":  limit,
		"offset": offset,
		"data":   items,
	})
}

// ─── GET /v1/nfse/:id ──────────────────────────────────────────────────────

// ConsultarNota handles GET /v1/nfse/:id.
func (h *NFSeHandler) ConsultarNota(c *fiber.Ctx) error {
	mei := auth.GetMEI(c)
	empresa := auth.GetEmpresa(c)
	if mei == nil && empresa == nil {
		return internalError(c, "nenhuma empresa autenticada no contexto")
	}

	notaID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return notFound(c)
	}

	var nota *nfse.Nota
	if empresa != nil {
		nota, err = h.notaRepo.FindByIDForEmpresa(c.Context(), notaID, empresa.ID)
	} else {
		nota, err = h.notaRepo.FindByID(c.Context(), notaID, mei.ID)
	}
	if err != nil {
		if isNotFound(err) {
			return notFound(c)
		}
		return internalError(c, "erro ao consultar nota")
	}

	return c.JSON(notaToMap(*nota))
}

// ─── DELETE /v1/nfse/:id ───────────────────────────────────────────────────

// CancelarNota handles DELETE /v1/nfse/:id.
// ME-31: validates 90-day cancellation window for ME/EPP (365 days for public sector).
func (h *NFSeHandler) CancelarNota(c *fiber.Ctx) error {
	mei := auth.GetMEI(c)
	empresa := auth.GetEmpresa(c)
	if mei == nil && empresa == nil {
		return internalError(c, "nenhuma empresa autenticada no contexto")
	}

	notaID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return notFound(c)
	}

	// Load the nota to get the NFS-e number for the cancellation XML.
	var nota *nfse.Nota
	if empresa != nil {
		nota, err = h.notaRepo.FindByIDForEmpresa(c.Context(), notaID, empresa.ID)
	} else {
		nota, err = h.notaRepo.FindByID(c.Context(), notaID, mei.ID)
	}
	if err != nil {
		if isNotFound(err) {
			return notFound(c)
		}
		return internalError(c, "erro ao consultar nota")
	}
	if nota.Status != "AUTORIZADA" {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":      "ALREADY_CANCELLED",
			"message":    "apenas notas autorizadas podem ser canceladas",
			"request_id": c.Locals("request_id"),
		})
	}
	if nota.NumeroNFSe == nil {
		return internalError(c, "nota sem número NFS-e")
	}

	// ME-31: validate 90-day cancellation window for ME/EPP.
	if empresa != nil && nota.EmitidaEm != nil {
		janela := 90 * 24 * time.Hour
		if time.Since(*nota.EmitidaEm) > janela {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"error":      "CANCELLATION_WINDOW_EXPIRED",
				"message":    "prazo de cancelamento de 90 dias expirado",
				"emitida_em": nota.EmitidaEm,
				"request_id": c.Locals("request_id"),
			})
		}
	}

	// Load certificate and build cancellation.
	if empresa != nil {
		return h.cancelarNotaME(c, nota, empresa)
	}
	return h.cancelarNotaMEI(c, nota, mei)
}

// cancelarNotaMEI cancels a MEI nota via the ABRASF RPS flow.
func (h *NFSeHandler) cancelarNotaMEI(c *fiber.Ctx, nota *nfse.Nota, mei *auth.MEI) error {
	cert, err := h.loadCert(c.Context(), mei)
	if err != nil {
		return internalError(c, "erro ao carregar certificado digital")
	}

	xmlCancel, err := h.builder.BuildCancelamento(*nota.NumeroNFSe, mei.CNPJ, mei.MunicipioIBGE)
	if err != nil {
		return internalError(c, "erro ao construir XML de cancelamento")
	}
	signedCancel, err := h.signer.Sign(c.Context(), xmlCancel, cert)
	if err != nil {
		return internalError(c, "erro ao assinar XML de cancelamento")
	}

	resp, err := h.adapter.Cancelar(c.Context(), signedCancel, cert)
	if err != nil {
		return internalError(c, "erro ao comunicar cancelamento à Receita Federal")
	}
	if !resp.OK && len(resp.Erros) > 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":   "RECEITA_REJECTION",
			"message": resp.Erros[0].Descricao,
			"codigo":  resp.Erros[0].Codigo,
		})
	}

	if err := h.notaRepo.Cancelar(c.Context(), nota.ID, mei.ID); err != nil {
		return internalError(c, "erro ao atualizar status da nota")
	}
	h.publishEvent(c.Context(), nota, webhook.EventCancelada, "", "", "", "")
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"nota_id": nota.ID, "status": "CANCELADA"})
}

// cancelarNotaME cancels a ME/EPP nota via the SEFIN Nacional DPS cancellation flow.
func (h *NFSeHandler) cancelarNotaME(c *fiber.Ctx, nota *nfse.Nota, empresa *auth.Empresa) error {
	cert, err := h.loadCertEmpresa(c.Context(), empresa)
	if err != nil {
		return internalError(c, "erro ao carregar certificado digital")
	}

	// DPS cancellation uses the same ABRASF cancellation XML for now.
	// TODO(ME-32): replace with DPS-native cancellation when ADN endpoint is confirmed.
	xmlCancel, err := h.builder.BuildCancelamento(*nota.NumeroNFSe, empresa.CNPJ, empresa.MunicipioIBGE)
	if err != nil {
		return internalError(c, "erro ao construir XML de cancelamento")
	}
	signedCancel, err := h.signer.Sign(c.Context(), xmlCancel, cert)
	if err != nil {
		return internalError(c, "erro ao assinar XML de cancelamento")
	}

	resp, err := h.adapter.Cancelar(c.Context(), signedCancel, cert)
	if err != nil {
		return internalError(c, "erro ao comunicar cancelamento à SEFIN Nacional")
	}
	if !resp.OK && len(resp.Erros) > 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":   "RECEITA_REJECTION",
			"message": resp.Erros[0].Descricao,
			"codigo":  resp.Erros[0].Codigo,
		})
	}

	if err := h.notaRepo.CancelarEmpresa(c.Context(), nota.ID, empresa.ID); err != nil {
		return internalError(c, "erro ao atualizar status da nota")
	}
	h.publishEvent(c.Context(), nota, webhook.EventCancelada, "", "", "", "")
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"nota_id": nota.ID, "status": "CANCELADA"})
}

// ─── GET /v1/nfse/:id/xml ──────────────────────────────────────────────────

// DownloadXML handles GET /v1/nfse/:id/xml.
func (h *NFSeHandler) DownloadXML(c *fiber.Ctx) error {
	mei := auth.GetMEI(c)
	if mei == nil {
		return internalError(c, "MEI not in context")
	}

	notaID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return notFound(c)
	}

	nota, err := h.notaRepo.FindByID(c.Context(), notaID, mei.ID)
	if err != nil {
		if isNotFound(err) {
			return notFound(c)
		}
		return internalError(c, "erro ao consultar nota")
	}

	// ── S3 path (STOR-01): redirect to a 15-minute presigned URL ─────────
	if nota.XMLS3Key != nil && h.store != nil {
		url, presignErr := h.store.PresignedURL(c.Context(), *nota.XMLS3Key, 15*time.Minute)
		if presignErr != nil {
			log.Ctx(c.Context()).Error().Err(presignErr).
				Str("nota_id", notaID.String()).
				Msg("falha ao gerar presigned URL para XML")
			return internalError(c, "erro ao gerar URL de download")
		}
		return c.Redirect(url, fiber.StatusTemporaryRedirect)
	}

	// ── Legacy path: serve XML text stored in the DB ──────────────────────
	var xmlData string
	if nota.XMLRetorno != nil && *nota.XMLRetorno != "" {
		xmlData = *nota.XMLRetorno
	} else if nota.XMLEnviado != nil {
		xmlData = *nota.XMLEnviado
	} else {
		return notFound(c)
	}

	c.Set("Content-Type", "application/xml; charset=utf-8")
	c.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="nfse-%s.xml"`, notaID))
	return c.SendString(xmlData)
}

// ─── GET /v1/nfse/:id/pdf ──────────────────────────────────────────────────

// DownloadPDF handles GET /v1/nfse/:id/pdf.
// The PDF is stored in Supabase Storage; this handler redirects to the signed URL.
// (PDF generation itself is a separate background process.)
func (h *NFSeHandler) DownloadPDF(c *fiber.Ctx) error {
	mei := auth.GetMEI(c)
	if mei == nil {
		return internalError(c, "MEI not in context")
	}

	notaID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return notFound(c)
	}

	nota, err := h.notaRepo.FindByID(c.Context(), notaID, mei.ID)
	if err != nil {
		if isNotFound(err) {
			return notFound(c)
		}
		return internalError(c, "erro ao consultar nota")
	}

	// ── S3 path (STOR-01): redirect to a 15-minute presigned URL ─────────
	if nota.PDFS3Key != nil && h.store != nil {
		url, presignErr := h.store.PresignedURL(c.Context(), *nota.PDFS3Key, 15*time.Minute)
		if presignErr != nil {
			log.Ctx(c.Context()).Error().Err(presignErr).
				Str("nota_id", notaID.String()).
				Msg("falha ao gerar presigned URL para PDF")
			return internalError(c, "erro ao gerar URL de download")
		}
		return c.Redirect(url, fiber.StatusTemporaryRedirect)
	}

	// ── Legacy path: redirect to Supabase Storage URL ─────────────────────
	if nota.PDFPath == nil || *nota.PDFPath == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "NOT_FOUND",
			"message": "PDF ainda não está disponível para esta nota",
		})
	}

	return c.Redirect(*nota.PDFPath, fiber.StatusTemporaryRedirect)
}

// ─── helpers ───────────────────────────────────────────────────────────────

// checkStripeSubscription verifies the MEI's Stripe subscription status.
// It reads from the Redis cache (populated by the webhook handler); on a cache
// miss it falls back to the value stored in em.StripeSubStatus and repopulates
// the cache.
//
// Returns (true, errorResponse) when the request must be blocked, or
// (false, nil) when the subscription is valid and the request may proceed.
func (h *NFSeHandler) checkStripeSubscription(c *fiber.Ctx, meiID uuid.UUID, em *billing.EmissaoMensal) (bool, error) {
	ctx := c.Context()

	// 1. Try the Redis cache.
	status, hit := h.billingGrd.GetCachedSubscriptionStatus(ctx, meiID)
	if !hit {
		// 2. Cache miss — use DB value and backfill the cache.
		if em.StripeSubStatus != nil {
			status = *em.StripeSubStatus
		}
		// Repopulate the cache (best-effort; ignore errors).
		_ = h.billingGrd.CacheSubscriptionStatus(ctx, meiID, status)
	}

	// 3. No subscription (trial or new user) → allow.
	if status == "" {
		return false, nil
	}

	// 4. Check against blocked statuses.
	if !billing.BlockedSubscriptionStatuses[status] {
		return false, nil
	}

	// 5. Blocked — return 402 with contextual action link.
	portalURL := h.apiBase + "/v1/billing/portal"
	checkoutURL := h.apiBase + "/v1/billing/checkout"
	actionURL := portalURL
	message := "assinatura inativa: acesse o portal de pagamentos para resolver"
	if status == "canceled" {
		actionURL = checkoutURL
		message = "assinatura cancelada: faça uma nova assinatura para continuar emitindo"
	}

	return true, c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
		"error":      "SUBSCRIPTION_INACTIVE",
		"message":    message,
		"status":     status,
		"action_url": actionURL,
		"request_id": c.Locals("request_id"),
	})
}

// reportOverageIfNeeded calls stripe.UsageRecords.New when the monthly
// emission count exceeds the plan limit and the MEI has a metered billing
// subscription item configured.  Errors are logged but do not fail the request
// — the note is already authorised; a billing correction can be applied manually.
func (h *NFSeHandler) reportOverageIfNeeded(
	ctx context.Context,
	notaID string,
	total, limit int,
	em *billing.EmissaoMensal,
) {
	if h.sc == nil {
		return // Stripe not configured (development / test)
	}
	if total <= limit {
		return // within included quota — no overage
	}
	if em == nil || em.StripeSubItemID == nil {
		return // no metered billing item on record
	}

	// Use the nota_id as the idempotency key so retries don't double-count.
	if err := h.sc.ReportUsage(ctx, *em.StripeSubItemID, notaID); err != nil {
		log.Ctx(ctx).Error().Err(err).
			Str("nota_id", notaID).
			Str("stripe_item_id", *em.StripeSubItemID).
			Int("total", total).
			Int("limit", limit).
			Msg("stripe metered usage report failed")
	} else {
		log.Ctx(ctx).Info().
			Str("nota_id", notaID).
			Str("stripe_item_id", *em.StripeSubItemID).
			Int("excedente_acumulado", total-limit).
			Msg("overage reported to Stripe")
	}
}

// loadCertEmpresa loads the ME/EPP empresa's A1 certificate from AWS Secrets Manager.
func (h *NFSeHandler) loadCertEmpresa(ctx context.Context, empresa *auth.Empresa) (*tls.Certificate, error) {
	if empresa.CertSecretARN == nil || *empresa.CertSecretARN == "" {
		if h.devMode {
			return nil, nil
		}
		return nil, fmt.Errorf("empresa %s não possui certificado A1 configurado; "+
			"envie o certificado via POST /v1/auth/certificate", empresa.ID)
	}
	return h.certProv.GetCert(ctx, *empresa.CertSecretARN)
}

// loadCert loads the MEI's A1 certificate from AWS Secrets Manager.
// The ARN is stored in meis.cert_secret_arn and set when the MEI uploads
// their certificate via POST /v1/auth/certificate (or during registration).
func (h *NFSeHandler) loadCert(ctx context.Context, mei *auth.MEI) (*tls.Certificate, error) {
	if mei.CertSecretARN == nil || *mei.CertSecretARN == "" {
		// In development (NoopSigner), skip cert loading — Sign() accepts nil cert.
		if h.devMode {
			return nil, nil
		}
		return nil, fmt.Errorf("MEI %s não possui certificado A1 configurado; "+
			"envie o certificado via POST /v1/auth/certificate", mei.ID)
	}
	return h.certProv.GetCert(ctx, *mei.CertSecretARN)
}

func (h *NFSeHandler) publishEvent(
	ctx context.Context,
	nota *nfse.Nota,
	event webhook.EventType,
	numeroNFSe, codVerificacao string,
	erroCodigo, erroDescricao string,
) {
	if nota.WebhookURL == nil || *nota.WebhookURL == "" {
		return
	}

	msg := webhook.DeliveryMessage{
		NotaID:         nota.ID.String(),
		Event:          event,
		Status:         string(event)[5:], // e.g. "nfse.autorizada" → "AUTORIZADA" via mapping below
		NumeroNFSe:     numeroNFSe,
		CodVerificacao: codVerificacao,
		WebhookURL:     *nota.WebhookURL,
		WebhookSecret:  h.whSecret,
		ErroCodigo:     erroCodigo,
		ErroDescricao:  erroDescricao,
	}

	// Map event to status string.
	switch event {
	case webhook.EventAutorizada:
		msg.Status = "AUTORIZADA"
		msg.EmitidaEm = time.Now().UTC()
	case webhook.EventRejeitada:
		msg.Status = "REJEITADA"
	case webhook.EventCancelada:
		msg.Status = "CANCELADA"
	}

	if err := h.publisher.Publish(ctx, msg); err != nil {
		log.Ctx(ctx).Error().Err(err).Str("nota_id", nota.ID.String()).Msg("failed to publish webhook event")
	}
}

// ─── validation ───────────────────────────────────────────────────────────

func validateEmissaoRequest(r document.EmissaoRequest) []fiber.Map {
	var errs []fiber.Map
	if r.Servico.CodigoNBS == "" {
		errs = append(errs, fiber.Map{"field": "servico.codigo_nbs", "message": "obrigatório"})
	}
	if r.Servico.Discriminacao == "" {
		errs = append(errs, fiber.Map{"field": "servico.discriminacao", "message": "obrigatório"})
	}
	if r.Servico.Valor <= 0 {
		errs = append(errs, fiber.Map{"field": "servico.valor", "message": "deve ser maior que zero"})
	}
	if r.Servico.AliquotaISS < 0 {
		errs = append(errs, fiber.Map{"field": "servico.aliquota_iss", "message": "não pode ser negativa"})
	}
	if r.Tomador.Documento == "" {
		errs = append(errs, fiber.Map{"field": "tomador.documento", "message": "obrigatório"})
	}
	if r.Tomador.RazaoSocial == "" {
		errs = append(errs, fiber.Map{"field": "tomador.razao_social", "message": "obrigatório"})
	}
	if r.Competencia == "" {
		errs = append(errs, fiber.Map{"field": "competencia", "message": "obrigatório (formato YYYY-MM)"})
	}
	if r.Tomador.TipoOrgao != "" &&
		r.Tomador.TipoOrgao != "PRIVADO" &&
		r.Tomador.TipoOrgao != "ORGAO_PUBLICO" {
		errs = append(errs, fiber.Map{"field": "tomador.tipo_orgao", "message": "deve ser PRIVADO ou ORGAO_PUBLICO"})
	}
	return errs
}

// ─── serialisation ────────────────────────────────────────────────────────

func notaToMap(n nfse.Nota) fiber.Map {
	m := fiber.Map{
		"id":            n.ID,
		"numero_rps":    n.NumeroRPS,
		"status":        n.Status,
		"competencia":   derefStr(n.Competencia),
		"tomador_doc":   derefStr(n.TomadorDoc),
		"tomador_nome":  derefStr(n.TomadorNome),
		"valor_servico": derefFloat(n.ValorServico),
		"created_at":    n.CreatedAt,
		"updated_at":    n.UpdatedAt,
	}
	if n.NumeroNFSe != nil {
		m["numero_nfse"] = *n.NumeroNFSe
	}
	if n.CodVerificacao != nil {
		m["codigo_verificacao"] = *n.CodVerificacao
	}
	if n.ProtocoloReceita != nil {
		m["protocolo_receita"] = *n.ProtocoloReceita
	}
	if n.ErroCodigo != nil {
		m["erro_codigo"] = *n.ErroCodigo
		m["erro_descricao"] = derefStr(n.ErroDescricao)
	}
	if n.EmitidaEm != nil {
		m["emitida_em"] = n.EmitidaEm
	}
	return m
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func derefFloat(f *float64) float64 {
	if f == nil {
		return 0
	}
	return *f
}

// ─── standard error responses ─────────────────────────────────────────────

func internalError(c *fiber.Ctx, msg string) error {
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		"error":      "INTERNAL_ERROR",
		"message":    msg,
		"request_id": c.Locals("request_id"),
	})
}

func validationError(c *fiber.Ctx, msg string) error {
	return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
		"error":      "VALIDATION_ERROR",
		"message":    msg,
		"request_id": c.Locals("request_id"),
	})
}

func notFound(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"error":      "NOT_FOUND",
		"message":    "recurso não encontrado",
		"request_id": c.Locals("request_id"),
	})
}

func isNotFound(err error) bool {
	_, ok := err.(nfse.ErrNotaNotFound)
	return ok
}
