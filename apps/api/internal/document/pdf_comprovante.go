package document

import (
	"bytes"
	"fmt"
	"time"

	"github.com/go-pdf/fpdf"
)

// ComprovanteParams holds all data needed to render the NFS-e comprovante PDF.
type ComprovanteParams struct {
	// Prestador (emitente)
	PrestadorNome string
	PrestadorCNPJ string

	// Tomador (tomador do serviço)
	TomadorNome string
	TomadorDoc  string // CPF ou CNPJ

	// Nota
	NumeroRPS        int64
	NumeroNFSe       string // chave de 50 dígitos ou número curto
	CodVerificacao   string
	ProtocoloReceita string
	ValorServico     float64
	Competencia      string // AAAA-MM
	Status           string // AUTORIZADA | CANCELADA

	// Timestamps
	EmitidaEm   *time.Time
	CanceladaEm *time.Time
}

// GenerateComprovante creates a one-page PDF comprovante for the given NFS-e and
// returns its bytes. It uses go-pdf/fpdf and has no external resource dependencies
// (no font files — uses PDF built-in Helvetica).
func GenerateComprovante(p ComprovanteParams) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.AddPage()

	pageW, _ := pdf.GetPageSize()
	contentW := pageW - 30 // left+right margins = 30

	// ── Header bar ────────────────────────────────────────────────────────────
	pdf.SetFillColor(10, 15, 30)   // navy-900 #0A0F1E
	pdf.SetTextColor(0, 232, 255)  // cyan-500 #00E8FF
	pdf.SetFont("Helvetica", "B", 14)
	pdf.CellFormat(contentW, 12, "NotaFácil MEI", "", 0, "L", true, 0, "")
	pdf.Ln(14)

	// Title
	pdf.SetTextColor(30, 30, 30)
	pdf.SetFont("Helvetica", "B", 13)
	statusLabel := "COMPROVANTE DE NOTA FISCAL DE SERVIÇOS ELETRÔNICA (NFS-e)"
	pdf.CellFormat(contentW, 8, statusLabel, "", 1, "C", false, 0, "")
	pdf.Ln(2)

	// Status badge
	var r, g, b int
	switch p.Status {
	case "AUTORIZADA":
		r, g, b = 0, 200, 90 // green
	case "CANCELADA":
		r, g, b = 100, 115, 160 // neutral
	default:
		r, g, b = 240, 180, 20 // yellow
	}
	pdf.SetFillColor(r, g, b)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Helvetica", "B", 11)
	pdf.CellFormat(contentW, 8, "  "+p.Status+"  ", "0", 1, "C", true, 0, "")
	pdf.Ln(4)

	// ── Helper: draw a 2-col row ───────────────────────────────────────────────
	drawRow := func(label, value string) {
		pdf.SetTextColor(100, 100, 100)
		pdf.SetFont("Helvetica", "", 8)
		pdf.CellFormat(55, 6, label, "0", 0, "L", false, 0, "")
		pdf.SetTextColor(20, 20, 20)
		pdf.SetFont("Helvetica", "", 9)
		pdf.CellFormat(contentW-55, 6, value, "0", 1, "L", false, 0, "")
	}

	drawSectionTitle := func(title string) {
		pdf.Ln(2)
		pdf.SetFillColor(230, 235, 245)
		pdf.SetTextColor(40, 60, 100)
		pdf.SetFont("Helvetica", "B", 9)
		pdf.CellFormat(contentW, 7, "  "+title, "0", 1, "L", true, 0, "")
		pdf.Ln(1)
	}

	// ── Identificação ─────────────────────────────────────────────────────────
	drawSectionTitle("IDENTIFICAÇÃO")
	drawRow("Nº RPS:", fmt.Sprintf("%d", p.NumeroRPS))
	if len(p.NumeroNFSe) == 50 {
		// long chave — split across two rows for readability
		drawRow("NFS-e nº (chave):", p.NumeroNFSe[:25])
		drawRow("", p.NumeroNFSe[25:])
	} else if p.NumeroNFSe != "" {
		drawRow("NFS-e nº:", p.NumeroNFSe)
	}
	if p.CodVerificacao != "" {
		drawRow("Código de verificação:", p.CodVerificacao)
	}
	if p.ProtocoloReceita != "" {
		drawRow("Protocolo Receita:", p.ProtocoloReceita)
	}

	// ── Prestador ─────────────────────────────────────────────────────────────
	drawSectionTitle("PRESTADOR DE SERVIÇOS")
	drawRow("Razão social:", p.PrestadorNome)
	if p.PrestadorCNPJ != "" {
		drawRow("CNPJ:", formatDoc(p.PrestadorCNPJ))
	}

	// ── Tomador ───────────────────────────────────────────────────────────────
	drawSectionTitle("TOMADOR DE SERVIÇOS")
	if p.TomadorNome != "" {
		drawRow("Nome / Razão social:", p.TomadorNome)
	}
	if p.TomadorDoc != "" {
		docLabel := "CPF:"
		if len(p.TomadorDoc) == 14 {
			docLabel = "CNPJ:"
		}
		drawRow(docLabel, formatDoc(p.TomadorDoc))
	}

	// ── Serviço ───────────────────────────────────────────────────────────────
	drawSectionTitle("SERVIÇO")
	drawRow("Competência:", p.Competencia)
	drawRow("Valor do serviço:", fmt.Sprintf("R$ %.2f", p.ValorServico))

	// ── Datas ─────────────────────────────────────────────────────────────────
	drawSectionTitle("DATAS")
	if p.EmitidaEm != nil {
		drawRow("Emitida em:", p.EmitidaEm.In(brLocation()).Format("02/01/2006 às 15:04:05"))
	}
	if p.CanceladaEm != nil {
		drawRow("Cancelada em:", p.CanceladaEm.In(brLocation()).Format("02/01/2006 às 15:04:05"))
	}

	// ── Link consulta pública ─────────────────────────────────────────────────
	if len(p.NumeroNFSe) == 50 {
		pdf.Ln(4)
		pdf.SetTextColor(80, 80, 80)
		pdf.SetFont("Helvetica", "I", 8)
		consultaURL := "https://www.nfse.gov.br/consultapublica?chaveAcesso=" + p.NumeroNFSe
		pdf.MultiCell(contentW, 5,
			"Para acessar o documento oficial no portal da Receita Federal:\n"+consultaURL,
			"0", "L", false)
	}

	// ── Footer ────────────────────────────────────────────────────────────────
	pdf.Ln(6)
	pdf.SetDrawColor(200, 200, 200)
	pdf.Line(15, pdf.GetY(), pageW-15, pdf.GetY())
	pdf.Ln(2)
	pdf.SetTextColor(150, 150, 150)
	pdf.SetFont("Helvetica", "I", 7)
	pdf.MultiCell(contentW, 4,
		"Este comprovante foi gerado automaticamente pelo sistema NotaFácil MEI. "+
			"Emitido em: "+time.Now().In(brLocation()).Format("02/01/2006 às 15:04:05")+" (horário de Brasília).",
		"0", "L", false)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("pdf output: %w", err)
	}
	return buf.Bytes(), nil
}

// formatDoc formats CPF (11 digits) or CNPJ (14 digits) with punctuation.
// Accepts raw numeric strings; returns unchanged if length doesn't match.
func formatDoc(doc string) string {
	switch len(doc) {
	case 11: // CPF: 000.000.000-00
		return doc[0:3] + "." + doc[3:6] + "." + doc[6:9] + "-" + doc[9:11]
	case 14: // CNPJ: 00.000.000/0000-00
		return doc[0:2] + "." + doc[2:5] + "." + doc[5:8] + "/" + doc[8:12] + "-" + doc[12:14]
	}
	return doc
}

func brLocation() *time.Location {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		return time.UTC
	}
	return loc
}
