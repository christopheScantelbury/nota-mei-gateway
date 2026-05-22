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

// NotaFácil brand palette (light identity — brand-kit v1.0).
var (
	clBlue    = [3]int{59, 130, 246}  // blue-500  #3B82F6 (marca)
	clTeal    = [3]int{20, 184, 166}  // teal-500  #14B8A6 (persona MEI)
	clSlate900 = [3]int{15, 23, 42}   // slate-900 #0F172A (texto forte)
	clSlate700 = [3]int{51, 65, 85}   // slate-700 #334155
	clSlate500 = [3]int{100, 116, 139} // slate-500 #64748B (texto suave)
	clSlate400 = [3]int{148, 163, 184} // slate-400 #94A3B8 (muted)
	clSlate200 = [3]int{226, 232, 240} // slate-200 #E2E8F0 (bordas)
	clSlate100 = [3]int{241, 245, 249} // slate-100 #F1F5F9 (fundo seção)
	clSuccess  = [3]int{22, 163, 74}   // success   #16A34A
	clWarning  = [3]int{217, 119, 6}   // warning   #D97706
)

// GenerateComprovante creates a one-page PDF comprovante for the given NFS-e and
// returns its bytes. It uses go-pdf/fpdf with the built-in Helvetica font.
//
// IMPORTANT: the built-in PDF fonts use CP1252 encoding, not UTF-8. All text is
// passed through the Unicode translator (tr) so that accented characters
// (á, ç, ã, ô, é …) render correctly instead of as mojibake.
func GenerateComprovante(p ComprovanteParams) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.AddPage()

	// Translator UTF-8 → CP1252 (fonte built-in). Sem isto, "á" vira "Ã¡".
	tr := pdf.UnicodeTranslatorFromDescriptor("")

	setFill := func(c [3]int) { pdf.SetFillColor(c[0], c[1], c[2]) }
	setText := func(c [3]int) { pdf.SetTextColor(c[0], c[1], c[2]) }
	setDraw := func(c [3]int) { pdf.SetDrawColor(c[0], c[1], c[2]) }

	pageW, _ := pdf.GetPageSize()
	contentW := pageW - 30 // left+right margins = 30

	// ── Marca: wordmark "NotaFácil" + sufixo persona "MEI" ──────────────────────
	pdf.SetFont("Helvetica", "B", 20)
	setText(clSlate900)
	nota := tr("Nota")
	pdf.CellFormat(pdf.GetStringWidth(nota), 11, nota, "", 0, "L", false, 0, "")
	setText(clBlue)
	facil := tr("Fácil")
	pdf.CellFormat(pdf.GetStringWidth(facil), 11, facil, "", 0, "L", false, 0, "")
	setText(clTeal)
	pdf.SetFont("Helvetica", "B", 20)
	pdf.CellFormat(0, 11, " MEI", "", 1, "L", false, 0, "")

	// Tagline
	setText(clSlate400)
	pdf.SetFont("Helvetica", "", 8)
	pdf.CellFormat(contentW, 5, tr("EMISSÃO AUTOMATIZADA DE NFS-e"), "", 1, "L", false, 0, "")
	pdf.Ln(3)

	// Régua sob a marca
	setDraw(clSlate200)
	pdf.SetLineWidth(0.4)
	pdf.Line(15, pdf.GetY(), pageW-15, pdf.GetY())
	pdf.Ln(5)

	// Título do documento
	setText(clSlate900)
	pdf.SetFont("Helvetica", "B", 12)
	pdf.MultiCell(contentW, 6, tr("Comprovante de Nota Fiscal de Serviços Eletrônica (NFS-e)"), "", "C", false)
	pdf.Ln(2)

	// ── Status badge ────────────────────────────────────────────────────────────
	var badge [3]int
	switch p.Status {
	case "AUTORIZADA":
		badge = clSuccess
	case "CANCELADA":
		badge = clSlate400
	default:
		badge = clWarning
	}
	setFill(badge)
	setText([3]int{255, 255, 255})
	pdf.SetFont("Helvetica", "B", 11)
	pdf.CellFormat(contentW, 9, tr(p.Status), "0", 1, "C", true, 0, "")
	pdf.Ln(4)

	// ── Helpers ─────────────────────────────────────────────────────────────────
	drawRow := func(label, value string) {
		setText(clSlate500)
		pdf.SetFont("Helvetica", "", 8.5)
		pdf.CellFormat(55, 6, tr(label), "0", 0, "L", false, 0, "")
		setText(clSlate900)
		pdf.SetFont("Helvetica", "", 9.5)
		pdf.CellFormat(contentW-55, 6, tr(value), "0", 1, "L", false, 0, "")
	}

	drawSectionTitle := func(title string) {
		pdf.Ln(2)
		setFill(clSlate100)
		setText(clSlate700)
		pdf.SetFont("Helvetica", "B", 9)
		pdf.CellFormat(contentW, 7, tr("  "+title), "0", 1, "L", true, 0, "")
		pdf.Ln(1)
	}

	// ── Identificação ─────────────────────────────────────────────────────────
	drawSectionTitle("IDENTIFICAÇÃO")
	drawRow("Nº RPS:", fmt.Sprintf("%d", p.NumeroRPS))
	if len(p.NumeroNFSe) == 50 {
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
		setText(clSlate500)
		pdf.SetFont("Helvetica", "I", 8)
		consultaURL := "https://www.nfse.gov.br/consultapublica?chaveAcesso=" + p.NumeroNFSe
		pdf.MultiCell(contentW, 5,
			tr("Para acessar o documento oficial no portal da Receita Federal:\n"+consultaURL),
			"0", "L", false)
	}

	// ── Footer ────────────────────────────────────────────────────────────────
	pdf.Ln(6)
	setDraw(clSlate200)
	pdf.Line(15, pdf.GetY(), pageW-15, pdf.GetY())
	pdf.Ln(2)
	setText(clSlate400)
	pdf.SetFont("Helvetica", "I", 7)
	pdf.MultiCell(contentW, 4,
		tr("Este comprovante foi gerado automaticamente pelo NotaFácil MEI · ScantelburyDevs. "+
			"Emitido em: "+time.Now().In(brLocation()).Format("02/01/2006 às 15:04:05")+" (horário de Brasília)."),
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
