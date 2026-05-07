package handler

import (
	"context"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/audit"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

type migrarRequest struct {
	EmpresaID          string  `json:"empresa_id"`
	ParaTipo           string  `json:"para_tipo"`
	RegimeTributario   string  `json:"regime_tributario"`
	InscricaoMunicipal *string `json:"inscricao_municipal,omitempty"`
}

// MigrarHandler handles MEI → ME migrations initiated from the dashboard.
type MigrarHandler struct {
	db      *pgxpool.Pool
	auditor *audit.AuditLogger
}

func NewMigrarHandler(db *pgxpool.Pool, auditor *audit.AuditLogger) *MigrarHandler {
	return &MigrarHandler{db: db, auditor: auditor}
}

// MigrarMEI handles POST /v1/auth/migrar
// Protected by JWTMiddleware (Supabase human session).
func (h *MigrarHandler) MigrarMEI(c *fiber.Ctx) error {
	userID, ok := c.Locals("jwt_user_id").(uuid.UUID)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "UNAUTHORIZED",
			"message": "sessão inválida",
		})
	}

	var req migrarRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "VALIDATION_ERROR",
			"message": "corpo da requisição inválido",
		})
	}

	if req.ParaTipo != "ME" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "VALIDATION_ERROR",
			"message": "apenas migração para ME é suportada",
		})
	}
	if !validRegimes[req.RegimeTributario] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "VALIDATION_ERROR",
			"message": "regime_tributario inválido: use SIMPLES_NACIONAL, LUCRO_PRESUMIDO ou LUCRO_REAL",
		})
	}

	empresaID, err := uuid.Parse(req.EmpresaID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "VALIDATION_ERROR",
			"message": "empresa_id inválido",
		})
	}

	// Verify ownership and current tipo atomically.
	var currentTipo string
	err = h.db.QueryRow(c.Context(),
		`SELECT tipo FROM empresas WHERE id=$1 AND user_id=$2`,
		empresaID, userID,
	).Scan(&currentTipo)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "NOT_FOUND",
			"message": "empresa não encontrada",
		})
	}
	if currentTipo != "MEI" {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":   "INVALID_TIPO",
			"message": "apenas empresas do tipo MEI podem ser migradas para ME",
		})
	}

	tx, err := h.db.Begin(c.Context())
	if err != nil {
		log.Ctx(c.Context()).Error().Err(err).Msg("migrar: begin tx")
		return internalError(c, "erro ao iniciar transação")
	}
	defer tx.Rollback(context.Background()) //nolint:errcheck

	tag, err := tx.Exec(c.Context(),
		`UPDATE empresas
		    SET tipo='ME', regime_tributario=$1, inscricao_municipal=$2, updated_at=NOW()
		  WHERE id=$3 AND user_id=$4 AND tipo='MEI'`,
		req.RegimeTributario, req.InscricaoMunicipal, empresaID, userID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":   "MIGRATION_FAILED",
			"message": "migração não pôde ser concluída — verifique o tipo atual da empresa",
		})
	}

	_, err = tx.Exec(c.Context(),
		`INSERT INTO empresa_migracoes (empresa_id, de_tipo, para_tipo, status)
		 VALUES ($1, 'MEI', 'ME', 'CONCLUIDA')`,
		empresaID,
	)
	if err != nil {
		log.Ctx(c.Context()).Error().Err(err).
			Str("empresa_id", empresaID.String()).Msg("migrar: insert empresa_migracoes")
		return internalError(c, "erro ao registrar migração")
	}

	if err := tx.Commit(c.Context()); err != nil {
		log.Ctx(c.Context()).Error().Err(err).Msg("migrar: commit tx")
		return internalError(c, "erro ao confirmar migração")
	}

	ip := c.Get("X-Real-IP")
	if ip == "" {
		ip = c.IP()
	}
	h.auditor.Log(c.Context(), audit.LogEntry{
		UserID:    userID.String(),
		EmpresaID: empresaID.String(),
		Produto:   "ME_DASHBOARD",
		Acao:      "migrar_mei_para_me",
		Metadata:  map[string]any{"regime_tributario": req.RegimeTributario},
		IPOrigem:  ip,
	})

	log.Ctx(c.Context()).Info().
		Str("user_id", userID.String()).
		Str("empresa_id", empresaID.String()).
		Str("regime", req.RegimeTributario).
		Msg("empresa migrada de MEI para ME")

	return c.JSON(fiber.Map{
		"message": "migração concluída com sucesso",
		"tipo":    "ME",
	})
}
