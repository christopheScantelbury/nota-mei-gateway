package handler

import (
	"context"
	"fmt"
	"io"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/christopheScantelbury/nota-mei-gateway/api/pkg/supabase"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// certManager is the subset of cert.CertProvider used by CertificateHandler.
// StoreCert is called on first upload; UpdateCert is called on renewal.
// Both are satisfied by *cert.Provider; inject a stub in tests.
type certManager interface {
	StoreCert(ctx context.Context, name string, pfxData []byte, password string) (string, error)
	UpdateCert(ctx context.Context, secretARN string, pfxData []byte, password string) error
}

// arnSaver persists the cert_secret_arn back to the database.
// Satisfied by *auth.Repository; inject a stub in tests.
type arnSaver interface {
	SaveCertSecretARN(ctx context.Context, meiID uuid.UUID, arn string) error
}

// CertificateHandler handles POST /v1/auth/certificate.
type CertificateHandler struct {
	certProvider certManager
	arnSaver     arnSaver
	db           *supabase.Client
}

// NewCertificateHandler creates a CertificateHandler.
// cp must implement both StoreCert and UpdateCert (e.g. *cert.Provider).
// saver is used to persist the cert ARN on first upload (e.g. *auth.Repository).
func NewCertificateHandler(cp certManager, saver arnSaver, db *supabase.Client) *CertificateHandler {
	return &CertificateHandler{certProvider: cp, arnSaver: saver, db: db}
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

	// ── 3. Store or update the secret in AWS Secrets Manager ─────────────────
	if secretARN == "" {
		// First upload: create a new secret and persist the ARN.
		secretName := fmt.Sprintf("nota-mei-gateway/certs/%s", mei.ID)
		newARN, storeErr := h.certProvider.StoreCert(c.Context(), secretName, pfxData, password)
		if storeErr != nil {
			log.Ctx(c.Context()).Error().Err(storeErr).Str("mei_id", mei.ID.String()).Msg("StoreCert failed")
			if isCertParseError(storeErr) {
				return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
					"error":      "INVALID_CERTIFICATE",
					"message":    "certificado inválido ou senha incorreta: " + storeErr.Error(),
					"request_id": c.Locals("request_id"),
				})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":      "INTERNAL_ERROR",
				"message":    "não foi possível armazenar o certificado",
				"request_id": c.Locals("request_id"),
			})
		}
		if saveErr := h.arnSaver.SaveCertSecretARN(c.Context(), mei.ID, newARN); saveErr != nil {
			// Secret was stored but ARN save failed — log the inconsistency.
			log.Ctx(c.Context()).Error().Err(saveErr).
				Str("mei_id", mei.ID.String()).
				Str("arn", newARN).
				Msg("cert stored but ARN save failed — manual remediation required")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":      "INTERNAL_ERROR",
				"message":    "certificado armazenado mas ARN não foi salvo; tente novamente",
				"request_id": c.Locals("request_id"),
			})
		}
		log.Ctx(c.Context()).Info().
			Str("mei_id", mei.ID.String()).
			Str("arn", newARN).
			Msg("certificado A1 armazenado (primeiro upload)")
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"mensagem": "Certificado cadastrado com sucesso",
		})
	}

	// Subsequent upload: replace the existing secret in-place.
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
