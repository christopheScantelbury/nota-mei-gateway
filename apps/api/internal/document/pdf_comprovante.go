package document

import (
	"bytes"
	"fmt"
	"time"

	"github.com/go-pdf/fpdf"
)

// ComprovanteParams holds all data needed to render the NFS-e comprovante PDF.
// Basic fields come from the notas_fiscais columns; the richer fields (address,
// service description, tax rates, regime) are filled by ExtractDPSFields from
// the stored DPS XML.
type ComprovanteParams struct {
	// ── Identificação ──
	NumeroRPS        int64
	NumeroNFSe       string // chave de 50 dígitos ou número curto
	CodVerificacao   string
	ProtocoloReceita string
	Competencia      string // AAAA-MM
	Status           string // AUTORIZADA | CANCELADA | ...
	SerieDPS         string
	DhEmiDPS         string // ISO da emissão da DPS

	// ── Prestador (emitente) ──
	PrestadorNome          string
	PrestadorCNPJ          string
	PrestadorIM            string
	PrestadorEmail         string
	PrestadorEndereco      string
	PrestadorMunicipioIBGE string
	PrestadorCEP           string
	RegimeTributario       string

	// ── Tomador ──
	TomadorNome          string
	TomadorDoc           string // CPF ou CNPJ
	TomadorIM            string
	TomadorEmail         string
	TomadorEndereco      string
	TomadorMunicipioIBGE string
	TomadorCEP           string

	// ── Serviço ──
	CodTributacaoNacional string
	CodNBS                string
	DescricaoServico      string
	LocalPrestacaoIBGE    string

	// ── Tributação / valores ──
	TribISSQNTexto         string
	ISSRetidoTexto         string
	AliquotaISS            float64
	ValorServico           float64
	DescontoIncondicionado float64
	DescontoCondicionado   float64
	ValorLiquido           float64

	// Timestamps
	EmitidaEm   *time.Time
	CanceladaEm *time.Time
}

// NotaFácil brand palette (light identity — brand-kit v1.0).
var (
	clBlue     = [3]int{59, 130, 246}   // blue-500  #3B82F6 (marca)
	clTeal     = [3]int{20, 184, 166}   // teal-500  #14B8A6 (persona MEI)
	clSlate900 = [3]int{15, 23, 42}     // slate-900 #0F172A (texto forte)
	clSlate700 = [3]int{51, 65, 85}     // slate-700 #334155
	clSlate500 = [3]int{100, 116, 139}  // slate-500 #64748B (texto suave)
	clSlate400 = [3]int{148, 163, 184}  // slate-400 #94A3B8 (muted)
	clSlate200 = [3]int{226, 232, 240}  // slate-200 #E2E8F0 (bordas)
	clSlate100 = [3]int{241, 245, 249}  // slate-100 #F1F5F9 (fundo seção)
	clSuccess  = [3]int{22, 163, 74}    // success   #16A34A
	clWarning  = [3]int{217, 119, 6}    // warning   #D97706
)

// GenerateComprovante renders a one-page DANFSE-style comprovante for the given
// NFS-e and returns its PDF bytes. It uses go-pdf/fpdf with the built-in
// Helvetica font.
//
// IMPORTANT: built-in PDF fonts use CP1252, not UTF-8. All text is passed
// through the Unicode translator (tr) so accented characters render correctly.
func GenerateComprovante(p ComprovanteParams) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(14, 14, 14)
	pdf.SetAutoPageBreak(true, 14)
	pdf.AddPage()

	tr := pdf.UnicodeTranslatorFromDescriptor("")

	setFill := func(c [3]int) { pdf.SetFillColor(c[0], c[1], c[2]) }
	setText := func(c [3]int) { pdf.SetTextColor(c[0], c[1], c[2]) }
	setDraw := func(c [3]int) { pdf.SetDrawColor(c[0], c[1], c[2]) }

	pageW, _ := pdf.GetPageSize()
	contentW := pageW - 28 // margens 14+14

	dash := func(s string) string {
		if s == "" {
			return "-"
		}
		return s
	}
	money := func(v float64) string { return "R$ " + brNumber(v) }

	// ── Cabeçalho: marca + tipo de documento ────────────────────────────────
	pdf.SetFont("Helvetica", "B", 19)
	setText(clSlate900)
	nota := tr("Nota")
	pdf.CellFormat(pdf.GetStringWidth(nota), 9, nota, "", 0, "L", false, 0, "")
	setText(clBlue)
	facil := tr("Fácil")
	pdf.CellFormat(pdf.GetStringWidth(facil), 9, facil, "", 0, "L", false, 0, "")
	setText(clTeal)
	pdf.CellFormat(pdf.GetStringWidth(" MEI"), 9, " MEI", "", 0, "L", false, 0, "")
	// Tipo de documento à direita
	setText(clSlate400)
	pdf.SetFont("Helvetica", "B", 9)
	pdf.CellFormat(0, 9, tr("DANFSE · Documento Auxiliar da NFS-e"), "", 1, "R", false, 0, "")
	setText(clSlate400)
	pdf.SetFont("Helvetica", "", 7.5)
	pdf.CellFormat(contentW, 4, tr("Emissão automatizada de NFS-e — NFS-e Nacional"), "", 1, "L", false, 0, "")
	pdf.Ln(2)
	setDraw(clSlate200)
	pdf.SetLineWidth(0.4)
	pdf.Line(14, pdf.GetY(), pageW-14, pdf.GetY())
	pdf.Ln(4)

	// ── Chave de acesso + status ────────────────────────────────────────────
	if p.NumeroNFSe != "" {
		setText(clSlate500)
		pdf.SetFont("Helvetica", "", 8)
		pdf.CellFormat(contentW, 5, tr("Chave de Acesso da NFS-e"), "", 1, "L", false, 0, "")
		setText(clSlate900)
		pdf.SetFont("Helvetica", "B", 11)
		pdf.CellFormat(contentW, 6, p.NumeroNFSe, "", 1, "L", false, 0, "")
		pdf.Ln(2)
	}

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
	pdf.SetFont("Helvetica", "B", 10)
	pdf.CellFormat(contentW, 8, tr(p.Status), "0", 1, "C", true, 0, "")
	pdf.Ln(3)

	// ── Helpers de layout ───────────────────────────────────────────────────
	section := func(title string) {
		pdf.Ln(1.5)
		setFill(clSlate100)
		setText(clSlate700)
		pdf.SetFont("Helvetica", "B", 8.5)
		pdf.CellFormat(contentW, 6.5, tr("  "+title), "0", 1, "L", true, 0, "")
		pdf.Ln(0.5)
	}

	// row1: um único par label/valor em largura total.
	row1 := func(label, value string) {
		setText(clSlate500)
		pdf.SetFont("Helvetica", "", 7.5)
		pdf.CellFormat(48, 5.2, tr(label), "0", 0, "L", false, 0, "")
		setText(clSlate900)
		pdf.SetFont("Helvetica", "", 8.5)
		pdf.CellFormat(contentW-48, 5.2, tr(value), "0", 1, "L", false, 0, "")
	}

	// row2: dois pares label/valor lado a lado (compacto, estilo DANFSE).
	colW := contentW / 2
	labW := 36.0
	row2 := func(l1, v1, l2, v2 string) {
		setText(clSlate500)
		pdf.SetFont("Helvetica", "", 7.5)
		pdf.CellFormat(labW, 5.2, tr(l1), "0", 0, "L", false, 0, "")
		setText(clSlate900)
		pdf.SetFont("Helvetica", "", 8.5)
		pdf.CellFormat(colW-labW, 5.2, tr(v1), "0", 0, "L", false, 0, "")
		setText(clSlate500)
		pdf.SetFont("Helvetica", "", 7.5)
		pdf.CellFormat(labW, 5.2, tr(l2), "0", 0, "L", false, 0, "")
		setText(clSlate900)
		pdf.SetFont("Helvetica", "", 8.5)
		pdf.CellFormat(colW-labW, 5.2, tr(v2), "0", 1, "L", false, 0, "")
	}

	// ── Identificação ───────────────────────────────────────────────────────
	section("IDENTIFICAÇÃO DA NFS-e")
	row2("Competência", competenciaFmt(p.Competencia), "Nº DPS / Série", fmt.Sprintf("%d / %s", p.NumeroRPS, dash(p.SerieDPS)))
	emitida := "-"
	if p.EmitidaEm != nil {
		emitida = p.EmitidaEm.In(brLocation()).Format("02/01/2006 15:04:05")
	}
	row2("Emissão da NFS-e", emitida, "Emissão da DPS", dhEmiFmt(p.DhEmiDPS))
	if p.CodVerificacao != "" {
		row1("Código de verificação", p.CodVerificacao)
	}
	if p.ProtocoloReceita != "" {
		row1("Protocolo Receita", p.ProtocoloReceita)
	}

	// ── Prestador ───────────────────────────────────────────────────────────
	section("PRESTADOR DO SERVIÇO (EMITENTE)")
	row1("Nome / Razão social", dash(p.PrestadorNome))
	row2("CNPJ", formatDoc(p.PrestadorCNPJ), "Inscrição Municipal", dash(p.PrestadorIM))
	if p.PrestadorEndereco != "" {
		row1("Endereço", p.PrestadorEndereco)
	}
	row2("Município", municipioFmt(p.PrestadorMunicipioIBGE), "CEP", dash(p.PrestadorCEP))
	row2("E-mail", dash(p.PrestadorEmail), "Regime", dash(p.RegimeTributario))

	// ── Tomador ─────────────────────────────────────────────────────────────
	section("TOMADOR DO SERVIÇO")
	row1("Nome / Razão social", dash(p.TomadorNome))
	docLabel := "CPF/CNPJ"
	row2(docLabel, formatDoc(p.TomadorDoc), "Inscrição Municipal", dash(p.TomadorIM))
	if p.TomadorEndereco != "" {
		row1("Endereço", p.TomadorEndereco)
	}
	row2("Município", municipioFmt(p.TomadorMunicipioIBGE), "E-mail", dash(p.TomadorEmail))

	// ── Serviço ─────────────────────────────────────────────────────────────
	section("SERVIÇO PRESTADO")
	row2("Cód. Trib. Nacional", dash(p.CodTributacaoNacional), "Local da Prestação", municipioFmt(p.LocalPrestacaoIBGE))
	if p.CodNBS != "" {
		row1("Código NBS", p.CodNBS)
	}
	if p.DescricaoServico != "" {
		setText(clSlate500)
		pdf.SetFont("Helvetica", "", 7.5)
		pdf.CellFormat(contentW, 5, tr("Descrição do serviço"), "0", 1, "L", false, 0, "")
		setText(clSlate900)
		pdf.SetFont("Helvetica", "", 8.5)
		pdf.MultiCell(contentW, 4.6, tr(p.DescricaoServico), "0", "L", false)
	}

	// ── Tributação municipal ────────────────────────────────────────────────
	section("TRIBUTAÇÃO DO ISSQN")
	aliq := "-"
	if p.AliquotaISS > 0 {
		aliq = brNumber(p.AliquotaISS) + "%"
	}
	row2("Tributação do ISSQN", dash(p.TribISSQNTexto), "Retenção do ISSQN", dash(p.ISSRetidoTexto))
	row2("Alíquota aplicada", aliq, "Município de incidência", municipioFmt(p.PrestadorMunicipioIBGE))

	// ── Valores ─────────────────────────────────────────────────────────────
	section("VALOR TOTAL DA NFS-e")
	row2("Valor do serviço", money(p.ValorServico), "Desconto incondicionado", money(p.DescontoIncondicionado))
	row2("Desconto condicionado", money(p.DescontoCondicionado), "Valor líquido", money(p.ValorLiquido))

	// Destaque do valor líquido
	pdf.Ln(1)
	setFill(clSlate100)
	setText(clSlate900)
	pdf.SetFont("Helvetica", "B", 11)
	liquido := p.ValorLiquido
	if liquido == 0 {
		liquido = p.ValorServico
	}
	pdf.CellFormat(contentW, 9, tr("  VALOR LÍQUIDO DA NFS-e: "+money(liquido)), "0", 1, "L", true, 0, "")

	// ── Link consulta pública ───────────────────────────────────────────────
	if len(p.NumeroNFSe) == 50 {
		pdf.Ln(3)
		setText(clSlate500)
		pdf.SetFont("Helvetica", "I", 7.5)
		consultaURL := "https://www.nfse.gov.br/consultapublica?chaveAcesso=" + p.NumeroNFSe
		pdf.MultiCell(contentW, 4.5,
			tr("A autenticidade desta NFS-e pode ser verificada no portal nacional da NFS-e pela chave de acesso:\n"+consultaURL),
			"0", "L", false)
	}

	// ── Footer ──────────────────────────────────────────────────────────────
	pdf.Ln(4)
	setDraw(clSlate200)
	pdf.Line(14, pdf.GetY(), pageW-14, pdf.GetY())
	pdf.Ln(2)
	setText(clSlate400)
	pdf.SetFont("Helvetica", "I", 6.5)
	pdf.MultiCell(contentW, 3.6,
		tr("Documento auxiliar gerado pelo NotaFácil MEI · ScantelburyDevs. "+
			"Gerado em "+time.Now().In(brLocation()).Format("02/01/2006 15:04:05")+" (horário de Brasília). "+
			"Este documento não substitui a NFS-e oficial; consulte sempre o portal nacional pela chave de acesso."),
		"0", "L", false)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("pdf output: %w", err)
	}
	return buf.Bytes(), nil
}

// brNumber formats a float with Brazilian conventions: comma decimal separator
// and dot thousands separator (e.g. 1234.5 → "1.234,50").
func brNumber(v float64) string {
	s := fmt.Sprintf("%.2f", v) // "1234.56"
	intPart, decPart := s, "00"
	if i := len(s) - 3; i >= 0 && s[i] == '.' {
		intPart, decPart = s[:i], s[i+1:]
	}
	neg := false
	if len(intPart) > 0 && intPart[0] == '-' {
		neg = true
		intPart = intPart[1:]
	}
	// insere separador de milhar
	var out []byte
	for i, c := range []byte(intPart) {
		if i > 0 && (len(intPart)-i)%3 == 0 {
			out = append(out, '.')
		}
		out = append(out, c)
	}
	res := string(out) + "," + decPart
	if neg {
		res = "-" + res
	}
	return res
}

// competenciaFmt converts "AAAA-MM" to "MM/AAAA"; returns "-" when empty.
func competenciaFmt(comp string) string {
	if len(comp) == 7 && comp[4] == '-' {
		return comp[5:] + "/" + comp[:4]
	}
	if comp == "" {
		return "-"
	}
	return comp
}

// dhEmiFmt parses an ISO datetime and renders it as "02/01/2006 15:04:05".
func dhEmiFmt(iso string) string {
	if iso == "" {
		return "-"
	}
	for _, layout := range []string{"2006-01-02T15:04:05Z07:00", "2006-01-02T15:04:05", "2006-01-02T15:04:05-07:00"} {
		if t, err := time.Parse(layout, iso); err == nil {
			return t.In(brLocation()).Format("02/01/2006 15:04:05")
		}
	}
	return iso
}

// municipioFmt renders an IBGE municipality code as "<UF> · cód. IBGE <code>".
// We only resolve the UF (from the 2-digit state prefix); the full municipality
// name would require a DB lookup against municipios_nfse.
func municipioFmt(ibge string) string {
	if len(ibge) < 2 {
		return "-"
	}
	uf := ufFromIBGE(ibge[:2])
	if uf == "" {
		return "cód. IBGE " + ibge
	}
	return uf + " · cód. IBGE " + ibge
}

// ufFromIBGE maps the 2-digit IBGE state prefix to its UF.
func ufFromIBGE(prefix string) string {
	m := map[string]string{
		"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
		"21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
		"31": "MG", "32": "ES", "33": "RJ", "35": "SP",
		"41": "PR", "42": "SC", "43": "RS",
		"50": "MS", "51": "MT", "52": "GO", "53": "DF",
	}
	return m[prefix]
}

// formatDoc formats CPF (11 digits) or CNPJ (14 digits) with punctuation.
// Accepts raw numeric strings; returns "-" when empty, unchanged otherwise.
func formatDoc(doc string) string {
	switch len(doc) {
	case 0:
		return "-"
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
