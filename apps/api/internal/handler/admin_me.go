package handler

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// empresaRelatorioRow holds the data for a single empresa in the CSV export.
type empresaRelatorioRow struct {
	EmpresaID        uuid.UUID
	CNPJ             string
	RazaoSocial      string
	Email            string
	Tipo             string
	RegimeTributario string
	Competencia      string
	TotalEmitidas    int
	TrialMe          bool
}

// AdminRelatorioMEHandler handles GET /v1/admin/relatorio-me.
// ME-52: exports a CSV of all ME/EPP empresas for a given competencia.
// Protected by IP whitelist middleware in main.go.
type AdminRelatorioMEHandler struct {
	pool *pgxpool.Pool
}

// NewAdminRelatorioMEHandler creates an AdminRelatorioMEHandler backed by a pgx pool.
func NewAdminRelatorioMEHandler(pool *pgxpool.Pool) *AdminRelatorioMEHandler {
	return &AdminRelatorioMEHandler{pool: pool}
}

// RelatorioME handles GET /v1/admin/relatorio-me?competencia=YYYY-MM.
// Returns a CSV with one row per ME/EPP empresa active in the given month.
func (h *AdminRelatorioMEHandler) RelatorioME(c *fiber.Ctx) error {
	competencia := c.Query("competencia")
	if competencia == "" {
		competencia = time.Now().UTC().Format("2006-01")
	}
	if _, err := time.Parse("2006-01", competencia); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "INVALID_COMPETENCIA",
			"message": "competencia deve estar no formato YYYY-MM",
		})
	}

	rows, err := h.pool.Query(c.Context(), `
		SELECT
			e.id,
			e.cnpj,
			e.razao_social,
			e.email,
			e.tipo,
			e.regime_tributario,
			em.competencia,
			COALESCE(em.total_emitidas, 0) AS total_emitidas,
			e.trial_me
		FROM empresas e
		LEFT JOIN emissoes_mensais em
			ON em.empresa_id = e.id AND em.competencia = $1
		WHERE e.tipo IN ('ME', 'EPP')
		ORDER BY e.razao_social
	`, competencia)
	if err != nil {
		return internalError(c, "erro ao consultar banco de dados")
	}
	defer rows.Close()

	var sb strings.Builder
	sb.WriteString("empresa_id,cnpj,razao_social,email,tipo,regime_tributario,competencia,total_emitidas,trial_me\n")

	for rows.Next() {
		var r empresaRelatorioRow
		var comp *string
		if err := rows.Scan(
			&r.EmpresaID, &r.CNPJ, &r.RazaoSocial, &r.Email,
			&r.Tipo, &r.RegimeTributario,
			&comp, &r.TotalEmitidas, &r.TrialMe,
		); err != nil {
			return internalError(c, "erro ao processar dados")
		}
		if comp != nil {
			r.Competencia = *comp
		} else {
			r.Competencia = competencia
		}

		sb.WriteString(fmt.Sprintf("%s,%s,%s,%s,%s,%s,%s,%d,%t\n",
			r.EmpresaID,
			csvEscape(r.CNPJ),
			csvEscape(r.RazaoSocial),
			csvEscape(r.Email),
			r.Tipo,
			r.RegimeTributario,
			r.Competencia,
			r.TotalEmitidas,
			r.TrialMe,
		))
	}
	if err := rows.Err(); err != nil {
		return internalError(c, "erro ao iterar resultados")
	}

	filename := fmt.Sprintf("relatorio-me-%s.csv", competencia)
	c.Set("Content-Type", "text/csv; charset=utf-8")
	c.Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	return c.SendString(sb.String())
}

// csvEscape wraps a CSV field in double-quotes if it contains a comma or quote.
func csvEscape(s string) string {
	if strings.ContainsAny(s, `,"`) {
		return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
	}
	return s
}

// queryRelatorioME is used in tests to mock the DB query.
type queryRelatorioMEFn func(ctx context.Context, competencia string) ([]empresaRelatorioRow, error)
