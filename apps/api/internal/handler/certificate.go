package handler

import (
	"context"
	"io"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/supabase"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// certUpdater is the subset of cert.CertProvider used by CertificateHandler.
// It is satisfied by *cert.Provider; inject a stub in tests.
type certUpdater interface {
	UpdateCert(ctx context.Context, secretARN string, pfxData []byte, password string) error
}

// CertificateHandler handles POST /v1/auth/certificate.
type CertificateHandler struct {
	certProvider certUpdater
	db           *supabase.Client
}

// NewCertificateHandler creates a CertificateHandler.
// cp may be any certUpdater (including *cert.Provider); use a stub in tests.
func NewCertificateHandler(cp certUpdater, db *supabase.Client) *CertificateHandler {
	return &CertificateHandler{certProvider: cp, db: db}
}

// Renew handles POST /v1/auth/certificate.
//
// Expects multipart/form-data with:
//   - certificado      — PFX/P12 file (binary)
//   - senha_certificado — plaintext password for the PFX
//
// It replaces the certificate stored in AWS Secrets Manager under the MEI's
// cert_secret_arn. If the MEI has no cert_secret_arn yet (i.e. was registered
// before this endpoint existed), the request is rejected with 409.
func (h *CertificateHandler) Renew(c *fiber.Ctx) error {
	mei := auth.GetMEI(c)
	if mei == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":      "INVALID_API_KEY",
			"message":    "não autenticado",
			"request_id": c.Locals("request_id"),
		})
	}

	// ── 1. Parse multipart form ──────────────────────────────────────────────
	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":      "VALIDATION_ERROR",
			"message":    "requisição deve ser multipart/form-data",
			"request_id": c.Locals("request_id"),
		})
	}

	// Password field.
	passwords := form.Value["senha_certificado"]
	if len(passwords) == 0 || passwords[0] == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":      "VALIDATION_ERROR",
			"message":    "senha_certificado é obrigatória",
			"request_id": c.Locals("request_id"),
		})
	}
	password := passwords[0]

	// Certificate file.
	files := form.File["certificado"]
	if len(files) == 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":      "VALIDATION_ERROR",
			"message":    "certificado é obrigatório",
			"request_id": c.Locals("request_id"),
		})
	}
	fh := files[0]
	if fh.Size > 10<<20 { // 10 MB guard
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
			"error":      "VALIDATION_ERROR",
			"message":    "certificado excede o tamanho máximo de 10 MB",
			"request_id": c.Locals("request_id"),
		})
	}

	f, err := fh.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "não foi possível ler o arquivo",
			"request_id": c.Locals("request_id"),
		})
	}
	defer f.Close()

	pfxData, err := io.ReadAll(f)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "não foi possível ler o arquivo",
			"request_id": c.Locals("request_id"),
		})
	}

	// ── 2. Lookup cert ARN for this MEI ──────────────────────────────────────
	secretARN, err := h.getCertARN(c.Context(), mei.ID)
	if err != nil {
		log.Ctx(c.Context()).Error().Err(err).Str("mei_id", mei.ID.String()).Msg("lookup cert ARN failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "não foi possível consultar o ARN do certificado",
			"request_id": c.Locals("request_id"),
		})
	}
	if secretARN == "" {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":      "NO_CERTIFICATE",
			"message":    "este MEI ainda não possui um certificado registrado; use POST /v1/auth/register",
			"request_id": c.Locals("request_id"),
		})
	}

	// ── 3. Update the secret in AWS Secrets Manager ───────────────────────────
	if err := h.certProvider.UpdateCert(c.Context(), secretARN, pfxData, password); err != nil {
		log.Ctx(c.Context()).Error().Err(err).Str("arn", secretARN).Msg("UpdateCert failed")
		// Surface PFX parse errors as 422 so the client knows to send a valid cert.
		if isCertParseError(err) {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"error":      "INVALID_CERTIFICATE",
				"message":    "certificado inválido ou senha incorreta: " + err.Error(),
				"request_id": c.Locals("request_id"),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "INTERNAL_ERROR",
			"message":    "não foi possível atualizar o certificado",
			"request_id": c.Locals("request_id"),
		})
	}

	log.Ctx(c.Context()).Info().
		Str("mei_id", mei.ID.String()).
		Str("arn", secretARN).
		Msg("certificado A1 renovado")

	return c.JSON(fiber.Map{
		"mensagem": "Certificado atualizado com sucesso",
	})
}

// getCertARN returns the cert_secret_arn for the given MEI, or "" if not set.
func (h *CertificateHandler) getCertARN(ctx context.Context, meiID uuid.UUID) (string, error) {
	row := h.db.Pool().QueryRow(ctx, `
		SELECT COALESCE(cert_secret_arn, '') FROM meis WHERE id = $1
	`, meiID)
	var arn string
	if err := row.Scan(&arn); err != nil {
		return "", err
	}
	return arn, nil
}

// isCertParseError returns true for errors that indicate the PFX data or
// password are invalid (as opposed to an AWS API error).
func isCertParseError(err error) bool {
	msg := err.Error()
	for _, s := range []string{
		"decode PKCS12",
		"parse PFX",
		"certificate private key must be RSA",
		"pkcs12",
	} {
		if len(msg) >= len(s) {
			for i := 0; i <= len(msg)-len(s); i++ {
				if msg[i:i+len(s)] == s {
					return true
				}
			}
		}
	}
	return false
}
