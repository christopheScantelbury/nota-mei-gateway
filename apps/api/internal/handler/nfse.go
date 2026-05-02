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
	builder      *document.Builder
	signer       document.Signer
	certProv     CertProvider
	billingRepo  *billing.Repository
	billingGrd   *billing.Guard
	publisher    *webhook.Publisher
	nbsValidator *document.NBSValidator
	apiBase      string
	whSecret     string // HMAC secret used to sign webhook payloads
}

// NewNFSeHandler creates an NFSeHandler with all its dependencies.
func NewNFSeHandler(
	notaRepo *nfse.NotaRepository,
	adapter *nfse.Adapter,
	builder *document.Builder,
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
		signer:      signer,
		certProv:    certProv,
		billingRepo: billingRepo,
		billingGrd:  billingGrd,
		publisher:   publisher,
		apiBase:     apiBase,
		whSecret:    whSecret,
	}
}

// WithNBSValidator sets the NBS validator. When set, EmitirNota will reject
// unknown NBS codes with INVALID_NBS before processing the request.
func (h *NFSeHandler) WithNBSValidator(v *document.NBSValidator) *NFSeHandler {
	h.nbsValidator = v
	return h
}

// ─── POST /v1/nfse ─────────────────────────────────────────────────────────

// EmitirNota handles POST /v1/nfse.
// It validates the request, checks billing, builds + signs the RPS XML,
// sends it to the Receita Federal, and stores the result.
func (h *NFSeHandler) EmitirNota(c *fiber.Ctx) error {
	mei := auth.GetMEI(c)
	if mei == nil {
		return internalError(c, "MEI not in context")
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

	ctx := c.Context()

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
	em, err := h.billingRepo.GetOrCreateEmissaoMensal(ctx, mei.ID)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Str("mei_id", mei.ID.String()).Msg("billing getOrCreate failed")
		return internalError(c, "erro ao verificar limite de emissões")
	}

	allowed, err := h.billingGrd.Allow(ctx, mei.ID, mei.PlanoLimite)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Str("mei_id", mei.ID.String()).Msg("billing guard error")
		return internalError(c, "erro ao verificar limite de emissões")
	}
	if !allowed {
		return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
			"error":      "PLAN_LIMIT_REACHED",
			"message":    fmt.Sprintf("limite de %d notas mensais atingido", mei.PlanoLimite),
			"request_id": c.Locals("request_id"),
		})
	}
	_ = em // emissao_mensal available if needed for metered billing later

	// ── 2. Allocate RPS number ────────────────────────────────────────────
	numeroRPS, err := h.notaRepo.NextNumeroRPS(ctx, mei.ID)
	if err != nil {
		return internalError(c, "erro ao alocar número de RPS")
	}

	// ── 3. Build RPS XML ─────────────────────────────────────────────────
	xmlDoc, err := h.builder.Build(req, mei.CNPJ, mei.MunicipioIBGE, numeroRPS)
	if err != nil {
		return validationError(c, "erro ao construir RPS: "+err.Error())
	}

	// ── 4. Load certificate ───────────────────────────────────────────────
	if mei.ID == uuid.Nil {
		return internalError(c, "MEI sem certificado configurado")
	}
	// cert_secret_arn is stored on the MEI — we'd pass it from the DB.
	// For now we use a placeholder; wire the actual ARN via MEI.CertSecretARN.
	cert, err := h.loadCert(ctx, mei)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Str("mei_id", mei.ID.String()).Msg("certificate load failed")
		return internalError(c, "erro ao carregar certificado digital")
	}

	// ── 5. Sign XML ───────────────────────────────────────────────────────
	signedXML, err := h.signer.Sign(xmlDoc, cert)
	if err != nil {
		return internalError(c, "erro ao assinar XML")
	}

	// ── 6. Persist nota with PROCESSANDO status ───────────────────────────
	nota, err := h.notaRepo.Create(ctx, nfse.CreateNotaInput{
		MeiID:          mei.ID,
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

	log.Ctx(ctx).Info().
		Str("mei_id", mei.ID.String()).
		Str("nota_id", nota.ID.String()).
		Int64("numero_rps", numeroRPS).
		Msg("nota criada, enviando para Receita Federal")

	// ── 7. Send to Receita Federal ────────────────────────────────────────
	envioResp, err := h.adapter.Enviar(ctx, signedXML, cert)
	if err != nil {
		// Transient error — keep status PROCESSANDO for later polling.
		log.Ctx(ctx).Warn().Err(err).Str("nota_id", nota.ID.String()).Msg("envio falhou, mantendo PROCESSANDO")
		return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
			"nota_id":  nota.ID,
			"status":   "PROCESSANDO",
			"mensagem": "Nota enviada para processamento (retry automático)",
		})
	}

	// ── 8. Process response ───────────────────────────────────────────────
	if len(envioResp.Erros) > 0 {
		codigo := envioResp.Erros[0].Codigo
		descricao := envioResp.Erros[0].Descricao
		_ = h.notaRepo.Rejeitar(ctx, nota.ID, codigo, descricao)
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
		// Synchronous authorisation.
		_ = h.notaRepo.Autorizar(ctx, nota.ID, envioResp.NumeroNFSe, envioResp.CodVerificacao, "")
		_, _ = h.billingRepo.IncrementEmitidas(ctx, mei.ID)
		log.Ctx(ctx).Info().
			Str("nota_id", nota.ID.String()).
			Str("numero_nfse", envioResp.NumeroNFSe).
			Msg("nota autorizada")
		h.publishEvent(ctx, nota, webhook.EventAutorizada, envioResp.NumeroNFSe, envioResp.CodVerificacao, "", "")
	} else if envioResp.Protocolo != "" {
		// Async — store protocol, worker will poll later.
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
	if mei == nil {
		return internalError(c, "MEI not in context")
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

	notas, total, err := h.notaRepo.ListByMEI(c.Context(), mei.ID, limit, offset)
	if err != nil {
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

	return c.JSON(notaToMap(*nota))
}

// ─── DELETE /v1/nfse/:id ───────────────────────────────────────────────────

// CancelarNota handles DELETE /v1/nfse/:id.
func (h *NFSeHandler) CancelarNota(c *fiber.Ctx) error {
	mei := auth.GetMEI(c)
	if mei == nil {
		return internalError(c, "MEI not in context")
	}

	notaID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return notFound(c)
	}

	// Load the nota to get the NFS-e number for the cancellation XML.
	nota, err := h.notaRepo.FindByID(c.Context(), notaID, mei.ID)
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

	// Load certificate.
	cert, err := h.loadCert(c.Context(), mei)
	if err != nil {
		return internalError(c, "erro ao carregar certificado digital")
	}

	// Build cancellation XML.
	xmlCancel, err := h.builder.BuildCancelamento(*nota.NumeroNFSe, mei.CNPJ, mei.MunicipioIBGE)
	if err != nil {
		return internalError(c, "erro ao construir XML de cancelamento")
	}
	signedCancel, err := h.signer.Sign(xmlCancel, cert)
	if err != nil {
		return internalError(c, "erro ao assinar XML de cancelamento")
	}

	// Send to Receita Federal.
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

	if err := h.notaRepo.Cancelar(c.Context(), notaID, mei.ID); err != nil {
		return internalError(c, "erro ao atualizar status da nota")
	}

	h.publishEvent(c.Context(), nota, webhook.EventCancelada, "", "", "", "")

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"nota_id": notaID,
		"status":  "CANCELADA",
	})
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

	if nota.PDFPath == nil || *nota.PDFPath == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "NOT_FOUND",
			"message": "PDF ainda não está disponível para esta nota",
		})
	}

	// Redirect to Supabase Storage URL (signed URL would be generated here).
	return c.Redirect(*nota.PDFPath, fiber.StatusTemporaryRedirect)
}

// ─── helpers ───────────────────────────────────────────────────────────────

// loadCert loads the MEI's certificate from Secrets Manager.
// The ARN is expected to be stored somewhere accessible from the MEI struct.
// For now we use the MEI ID as a naming convention in Secrets Manager.
func (h *NFSeHandler) loadCert(ctx context.Context, mei *auth.MEI) (*tls.Certificate, error) {
	// Convention: secrets are named "nota-mei-gateway/certs/{mei_id}"
	arn := fmt.Sprintf("nota-mei-gateway/certs/%s", mei.ID)
	return h.certProv.GetCert(ctx, arn)
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
