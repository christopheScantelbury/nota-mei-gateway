package document

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"strconv"
	"strings"

	"github.com/go-pdf/fpdf"
	qrcode "github.com/skip2/go-qrcode"
)

// DANFSE no leiaute oficial (#276), gerado a partir do XML OFICIAL da NFS-e
// (raiz <NFSe>, #275) — não da DPS. Segue os blocos do DANFSe v1.0 do Emissor
// Nacional: chave + QR code, emitente, tomador, intermediário, serviço,
// tributação municipal, tributação federal, valor total, totais aproximados
// dos tributos e informações complementares. Usado quando o DANFSE do ADN
// (adn.nfse.gov.br/danfse) não está disponível.

// ─── XML da NFS-e (nomes locais; namespace ignorado) ────────────────────────

type nfseXMLDoc struct {
	Inf nfseInf `xml:"infNFSe"`
}

type nfseInf struct {
	ID            string `xml:"Id,attr"`
	XLocEmi       string `xml:"xLocEmi"`
	XLocPrestacao string `xml:"xLocPrestacao"`
	NNFSe         string `xml:"nNFSe"`
	CLocIncid     string `xml:"cLocIncid"`
	XLocIncid     string `xml:"xLocIncid"`
	XTribNac      string `xml:"xTribNac"`
	XTribMun      string `xml:"xTribMun"`
	XNBS          string `xml:"xNBS"`
	AmbGer        string `xml:"ambGer"`
	CStat         string `xml:"cStat"`
	DhProc        string `xml:"dhProc"`
	Emit          struct {
		CNPJ  string `xml:"CNPJ"`
		CPF   string `xml:"CPF"`
		IM    string `xml:"IM"`
		XNome string `xml:"xNome"`
		XFant string `xml:"xFant"`
		Ender struct {
			XLgr    string `xml:"xLgr"`
			Nro     string `xml:"nro"`
			XCpl    string `xml:"xCpl"`
			XBairro string `xml:"xBairro"`
			CMun    string `xml:"cMun"`
			UF      string `xml:"UF"`
			CEP     string `xml:"CEP"`
		} `xml:"enderNac"`
		Fone  string `xml:"fone"`
		Email string `xml:"email"`
	} `xml:"emit"`
	Valores struct {
		VCalcDR    string `xml:"vCalcDR"`
		VCalcBM    string `xml:"vCalcBM"`
		VBC        string `xml:"vBC"`
		PAliqAplic string `xml:"pAliqAplic"`
		VISSQN     string `xml:"vISSQN"`
		VTotalRet  string `xml:"vTotalRet"`
		VLiq       string `xml:"vLiq"`
	} `xml:"valores"`
	XOutInf string `xml:"xOutInf"`
	DPS     struct {
		Inf nfseDPSInf `xml:"infDPS"`
	} `xml:"DPS"`
}

type nfsePessoa struct {
	CNPJ  string `xml:"CNPJ"`
	CPF   string `xml:"CPF"`
	NIF   string `xml:"NIF"`
	IM    string `xml:"IM"`
	XNome string `xml:"xNome"`
	End   struct {
		EndNac struct {
			CMun string `xml:"cMun"`
			CEP  string `xml:"CEP"`
		} `xml:"endNac"`
		XLgr    string `xml:"xLgr"`
		Nro     string `xml:"nro"`
		XCpl    string `xml:"xCpl"`
		XBairro string `xml:"xBairro"`
	} `xml:"end"`
	Fone  string `xml:"fone"`
	Email string `xml:"email"`
}

type nfseDPSInf struct {
	TpAmb   string `xml:"tpAmb"`
	DhEmi   string `xml:"dhEmi"`
	Serie   string `xml:"serie"`
	NDPS    string `xml:"nDPS"`
	DCompet string `xml:"dCompet"`
	Prest   struct {
		nfsePessoa
		RegTrib struct {
			OpSimpNac   string `xml:"opSimpNac"`
			RegApTribSN string `xml:"regApTribSN"`
			RegEspTrib  string `xml:"regEspTrib"`
		} `xml:"regTrib"`
	} `xml:"prest"`
	Toma   *nfsePessoa `xml:"toma"`
	Interm *nfsePessoa `xml:"interm"`
	Serv   struct {
		LocPrest struct {
			CLocPrestacao  string `xml:"cLocPrestacao"`
			CPaisPrestacao string `xml:"cPaisPrestacao"`
		} `xml:"locPrest"`
		CServ struct {
			CTribNac  string `xml:"cTribNac"`
			CTribMun  string `xml:"cTribMun"`
			XDescServ string `xml:"xDescServ"`
			CNBS      string `xml:"cNBS"`
		} `xml:"cServ"`
		InfoCompl struct {
			XInfComp string `xml:"xInfComp"`
		} `xml:"infoCompl"`
	} `xml:"serv"`
	Valores struct {
		VServPrest struct {
			VServ string `xml:"vServ"`
		} `xml:"vServPrest"`
		VDesc struct {
			VDescIncond string `xml:"vDescIncond"`
			VDescCond   string `xml:"vDescCond"`
		} `xml:"vDescCondIncond"`
		VDedRed struct {
			VDR string `xml:"vDR"`
		} `xml:"vDedRed"`
		Trib struct {
			TribMun struct {
				TribISSQN   string `xml:"tribISSQN"`
				CPaisResult string `xml:"cPaisResult"`
				TpImunidade string `xml:"tpImunidade"`
				ExigSusp    struct {
					TpSusp    string `xml:"tpSusp"`
					NProcesso string `xml:"nProcesso"`
				} `xml:"exigSusp"`
				BM struct {
					NBM string `xml:"nBM"`
				} `xml:"BM"`
				TpRetISSQN string `xml:"tpRetISSQN"`
				PAliq      string `xml:"pAliq"`
			} `xml:"tribMun"`
			TribFed struct {
				PisCofins struct {
					VPis           string `xml:"vPis"`
					VCofins        string `xml:"vCofins"`
					TpRetPisCofins string `xml:"tpRetPisCofins"`
				} `xml:"piscofins"`
				VRetCP   string `xml:"vRetCP"`
				VRetIRRF string `xml:"vRetIRRF"`
				VRetCSLL string `xml:"vRetCSLL"`
			} `xml:"tribFed"`
			TotTrib struct {
				VTotTrib struct {
					Fed string `xml:"vTotTribFed"`
					Est string `xml:"vTotTribEst"`
					Mun string `xml:"vTotTribMun"`
				} `xml:"vTotTrib"`
				PTotTrib struct {
					Fed string `xml:"pTotTribFed"`
					Est string `xml:"pTotTribEst"`
					Mun string `xml:"pTotTribMun"`
				} `xml:"pTotTrib"`
				IndTotTrib string `xml:"indTotTrib"`
				PTotTribSN string `xml:"pTotTribSN"`
			} `xml:"totTrib"`
		} `xml:"trib"`
	} `xml:"valores"`
}

// DANFSEOpcoes ajusta a geração.
type DANFSEOpcoes struct {
	Cancelada bool
	// NomeMunicipio resolve um código IBGE em "Nome - UF" (opcional).
	NomeMunicipio func(ibge string) string
}

// ChaveDaNFSe devolve a chave de acesso (50 dígitos) a partir do Id "NFS…".
func ChaveDaNFSe(id string) string { return strings.TrimPrefix(id, "NFS") }

// GerarDANFSE monta o PDF a partir do XML oficial da NFS-e.
func GerarDANFSE(nfseXML []byte, op DANFSEOpcoes) ([]byte, error) {
	var doc nfseXMLDoc
	if err := xml.Unmarshal(nfseXML, &doc); err != nil {
		return nil, fmt.Errorf("danfse: xml da nfse: %w", err)
	}
	n := doc.Inf
	if n.ID == "" {
		return nil, fmt.Errorf("danfse: xml sem infNFSe/@Id (não é uma NFS-e)")
	}
	d := n.DPS.Inf
	chave := ChaveDaNFSe(n.ID)

	mun := func(ibge string) string {
		if ibge == "" {
			return "-"
		}
		if op.NomeMunicipio != nil {
			if s := op.NomeMunicipio(ibge); s != "" {
				return s
			}
		}
		if ibge == d.Serv.LocPrest.CLocPrestacao && n.XLocPrestacao != "" {
			return n.XLocPrestacao
		}
		if ibge == n.CLocIncid && n.XLocIncid != "" {
			return n.XLocIncid
		}
		return municipioFmt(ibge)
	}

	pdf := fpdf.New("P", "mm", "A4", "")
	const mg = 8.0
	pdf.SetMargins(mg, mg, mg)
	pdf.SetAutoPageBreak(true, mg)
	pdf.AddPage()
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	pageW, pageH := pdf.GetPageSize()
	W := pageW - 2*mg

	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.2)
	pdf.SetTextColor(0, 0, 0)

	// fit corta o texto para caber na largura (fonte já definida).
	fit := func(s string, w float64) string {
		s = tr(s)
		if pdf.GetStringWidth(s) <= w {
			return s
		}
		ell := tr("…")
		for len(s) > 0 && pdf.GetStringWidth(s+ell) > w {
			s = s[:len(s)-1]
		}
		return s + ell
	}

	type campo struct {
		label, valor string
		w            float64 // fração da largura
	}
	const hCampo = 8.2
	// linha de campos com rótulo pequeno em cima e valor embaixo.
	linha := func(cs ...campo) {
		y := pdf.GetY()
		x := mg
		for _, c := range cs {
			w := W * c.w
			pdf.Rect(x, y, w, hCampo, "D")
			pdf.SetXY(x+0.8, y+0.6)
			pdf.SetFont("Helvetica", "B", 5.6)
			pdf.CellFormat(w-1.6, 2.8, fit(c.label, w-1.6), "", 0, "L", false, 0, "")
			pdf.SetXY(x+0.8, y+3.6)
			pdf.SetFont("Helvetica", "", 7.6)
			if c.label != "" {
				pdf.CellFormat(w-1.6, 4, fit(dashIfEmpty(c.valor), w-1.6), "", 0, "L", false, 0, "")
			}
			x += w
		}
		pdf.SetXY(mg, y+hCampo)
	}
	secao := func(titulo string) {
		y := pdf.GetY()
		pdf.SetFillColor(225, 225, 225)
		pdf.Rect(mg, y, W, 4.6, "FD")
		pdf.SetXY(mg+1, y+0.4)
		pdf.SetFont("Helvetica", "B", 7)
		pdf.CellFormat(W-2, 3.8, tr(titulo), "", 0, "L", false, 0, "")
		pdf.SetXY(mg, y+4.6)
	}
	texto := func(s string) {
		y := pdf.GetY()
		pdf.SetXY(mg+0.8, y+0.8)
		pdf.SetFont("Helvetica", "", 7.6)
		pdf.MultiCell(W-1.6, 3.6, tr(dashIfEmpty(s)), "", "L", false)
		h := pdf.GetY() - y + 0.8
		pdf.Rect(mg, y, W, h, "D")
		pdf.SetXY(mg, y+h)
	}

	// ── Cabeçalho ───────────────────────────────────────────────────────────
	y0 := pdf.GetY()
	pdf.Rect(mg, y0, W, 14, "D")
	pdf.SetXY(mg+2, y0+1.5)
	pdf.SetFont("Helvetica", "B", 15)
	pdf.CellFormat(70, 6.5, tr("DANFSe v1.0"), "", 2, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 8)
	pdf.CellFormat(70, 4, tr("Documento Auxiliar da NFS-e"), "", 0, "L", false, 0, "")
	pdf.SetXY(mg+W/2, y0+2)
	pdf.SetFont("Helvetica", "B", 9)
	pdf.CellFormat(W/2-2, 4.5, fit(n.XLocEmi, W/2-2), "", 2, "R", false, 0, "")
	pdf.SetFont("Helvetica", "", 7)
	amb := "Ambiente de produção"
	// tpAmb da DPS é o ambiente (2 = produção restrita). ambGer da NFS-e é quem
	// gerou (1 = prefeitura, 2 = Sefin Nacional) — não é ambiente.
	if d.TpAmb == "2" {
		amb = "PRODUÇÃO RESTRITA — NFS-e SEM VALIDADE JURÍDICA"
	}
	pdf.CellFormat(W/2-2, 4, tr("Município emissor · "+amb), "", 0, "R", false, 0, "")
	pdf.SetXY(mg, y0+14)

	// ── Chave de acesso + QR code ───────────────────────────────────────────
	const qrW = 26.0
	yChave := pdf.GetY()
	urlConsulta := "https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=" + chave
	{
		left := W - qrW
		pdf.Rect(mg, yChave, left, hCampo, "D")
		pdf.SetXY(mg+0.8, yChave+0.6)
		pdf.SetFont("Helvetica", "B", 5.6)
		pdf.CellFormat(left-1.6, 2.8, tr("CHAVE DE ACESSO DA NFS-e"), "", 0, "L", false, 0, "")
		pdf.SetXY(mg+0.8, yChave+3.4)
		pdf.SetFont("Courier", "B", 9.5)
		pdf.CellFormat(left-1.6, 4.4, chave, "", 0, "L", false, 0, "")
		pdf.SetXY(mg, yChave+hCampo)
		f := (W - qrW) / W
		linha(
			campo{"NÚMERO DA NFS-e", n.NNFSe, f / 3},
			campo{"COMPETÊNCIA DA NFS-e", dataBR(d.DCompet), f / 3},
			campo{"DATA E HORA DA EMISSÃO DA NFS-e", dhEmiFmt(n.DhProc), f / 3},
		)
		linha(
			campo{"NÚMERO DA DPS", d.NDPS, f / 3},
			campo{"SÉRIE DA DPS", d.Serie, f / 3},
			campo{"DATA E HORA DA EMISSÃO DA DPS", dhEmiFmt(d.DhEmi), f / 3},
		)
		hBloco := pdf.GetY() - yChave
		pdf.Rect(mg+W-qrW, yChave, qrW, hBloco, "D")
		if png, err := qrcode.Encode(urlConsulta, qrcode.Medium, 256); err == nil {
			opt := fpdf.ImageOptions{ImageType: "PNG"}
			pdf.RegisterImageOptionsReader("qr", opt, bytes.NewReader(png))
			s := hBloco - 2
			pdf.ImageOptions("qr", mg+W-qrW+(qrW-s)/2, yChave+1, s, s, false, opt, 0, "")
		}
		pdf.SetXY(mg, yChave+hBloco)
		pdf.SetFont("Helvetica", "", 5.6)
		pdf.MultiCell(W, 2.6, tr("A autenticidade desta NFS-e pode ser verificada pela leitura do código QR ou pela consulta da chave de acesso no Portal Nacional da NFS-e (www.nfse.gov.br)."), "LRB", "C", false)
	}

	// ── Emitente ────────────────────────────────────────────────────────────
	e := n.Emit
	secao("EMITENTE DA NFS-e — PRESTADOR DO SERVIÇO")
	linha(
		campo{"CNPJ / CPF / NIF", formatDoc(firstNonEmpty(e.CNPJ, e.CPF)), 0.34},
		campo{"INSCRIÇÃO MUNICIPAL", firstNonEmpty(e.IM, d.Prest.IM), 0.33},
		campo{"TELEFONE", firstNonEmpty(e.Fone, d.Prest.Fone), 0.33},
	)
	linha(
		campo{"NOME / NOME EMPRESARIAL", firstNonEmpty(e.XNome, d.Prest.XNome), 0.67},
		campo{"E-MAIL", firstNonEmpty(e.Email, d.Prest.Email), 0.33},
	)
	munEmit := mun(e.Ender.CMun)
	if e.Ender.UF != "" && !strings.Contains(munEmit, e.Ender.UF) {
		munEmit += " - " + e.Ender.UF
	}
	linha(
		campo{"ENDEREÇO", joinNonEmpty(", ", e.Ender.XLgr, e.Ender.Nro, e.Ender.XCpl, e.Ender.XBairro), 0.55},
		campo{"MUNICÍPIO", munEmit, 0.3},
		campo{"CEP", cepDANFSE(e.Ender.CEP), 0.15},
	)
	rt := d.Prest.RegTrib
	linha(
		campo{"SIMPLES NACIONAL NA DATA DE COMPETÊNCIA", opSimpNacTexto(rt.OpSimpNac), 0.45},
		campo{"REGIME DE APURAÇÃO TRIBUTÁRIA PELO SN", regApTribSNTexto(rt.RegApTribSN), 0.55},
	)

	// ── Tomador / intermediário ─────────────────────────────────────────────
	pessoa := func(titulo string, p *nfsePessoa, ausente string) {
		secao(titulo)
		if p == nil || (p.XNome == "" && p.CNPJ == "" && p.CPF == "" && p.NIF == "") {
			texto(ausente)
			return
		}
		linha(
			campo{"CNPJ / CPF / NIF", formatDoc(firstNonEmpty(p.CNPJ, p.CPF, p.NIF)), 0.34},
			campo{"INSCRIÇÃO MUNICIPAL", p.IM, 0.33},
			campo{"TELEFONE", p.Fone, 0.33},
		)
		linha(
			campo{"NOME / NOME EMPRESARIAL", p.XNome, 0.67},
			campo{"E-MAIL", p.Email, 0.33},
		)
		linha(
			campo{"ENDEREÇO", joinNonEmpty(", ", p.End.XLgr, p.End.Nro, p.End.XCpl, p.End.XBairro), 0.55},
			campo{"MUNICÍPIO", mun(p.End.EndNac.CMun), 0.3},
			campo{"CEP", cepDANFSE(p.End.EndNac.CEP), 0.15},
		)
	}
	pessoa("TOMADOR DO SERVIÇO", d.Toma, "TOMADOR NÃO IDENTIFICADO NA NFS-e")
	pessoa("INTERMEDIÁRIO DO SERVIÇO", d.Interm, "INTERMEDIÁRIO DO SERVIÇO NÃO IDENTIFICADO NA NFS-e")

	// ── Serviço ─────────────────────────────────────────────────────────────
	s := d.Serv
	secao("SERVIÇO PRESTADO")
	linha(
		campo{"CÓDIGO DE TRIBUTAÇÃO NACIONAL", joinNonEmpty(" - ", formatCTribNac(s.CServ.CTribNac), n.XTribNac), 0.7},
		campo{"CÓDIGO DE TRIBUTAÇÃO MUNICIPAL", joinNonEmpty(" - ", s.CServ.CTribMun, n.XTribMun), 0.3},
	)
	linha(
		campo{"LOCAL DA PRESTAÇÃO", firstNonEmpty(n.XLocPrestacao, mun(s.LocPrest.CLocPrestacao)), 0.4},
		campo{"PAÍS DA PRESTAÇÃO", paisTexto(s.LocPrest.CPaisPrestacao), 0.25},
		campo{"CÓDIGO NBS", joinNonEmpty(" - ", s.CServ.CNBS, n.XNBS), 0.35},
	)
	pdf.SetFont("Helvetica", "B", 5.6)
	{
		y := pdf.GetY()
		pdf.SetXY(mg+0.8, y+0.6)
		pdf.CellFormat(W-1.6, 2.8, tr("DESCRIÇÃO DO SERVIÇO"), "", 0, "L", false, 0, "")
		pdf.SetXY(mg+0.8, y+3.6)
		pdf.SetFont("Helvetica", "", 7.6)
		pdf.MultiCell(W-1.6, 3.6, tr(dashIfEmpty(s.CServ.XDescServ)), "", "L", false)
		h := pdf.GetY() - y + 0.8
		pdf.Rect(mg, y, W, h, "D")
		pdf.SetXY(mg, y+h)
	}

	// ── Tributação municipal ────────────────────────────────────────────────
	v := d.Valores
	tm := v.Trib.TribMun
	secao("TRIBUTAÇÃO MUNICIPAL")
	suspensao := "Não"
	if tm.ExigSusp.TpSusp != "" {
		suspensao = "Sim"
	}
	linha(
		campo{"TRIBUTAÇÃO DO ISSQN", tribISSQNTexto(tm.TribISSQN), 0.25},
		campo{"PAÍS RESULTADO DA PRESTAÇÃO", paisTexto(tm.CPaisResult), 0.25},
		campo{"MUNICÍPIO DE INCIDÊNCIA DO ISSQN", firstNonEmpty(n.XLocIncid, mun(n.CLocIncid)), 0.25},
		campo{"REGIME ESPECIAL DE TRIBUTAÇÃO", regEspTribTexto(rt.RegEspTrib), 0.25},
	)
	linha(
		campo{"TIPO DE IMUNIDADE", tm.TpImunidade, 0.25},
		campo{"SUSPENSÃO DA EXIGIBILIDADE DO ISSQN", suspensao, 0.25},
		campo{"NÚMERO PROCESSO SUSPENSÃO", tm.ExigSusp.NProcesso, 0.25},
		campo{"BENEFÍCIO MUNICIPAL", tm.BM.NBM, 0.25},
	)
	linha(
		campo{"VALOR DO SERVIÇO", moeda(v.VServPrest.VServ), 0.25},
		campo{"DESCONTO INCONDICIONADO", moeda(v.VDesc.VDescIncond), 0.25},
		campo{"TOTAL DEDUÇÕES / REDUÇÕES", moeda(firstNonEmpty(n.Valores.VCalcDR, v.VDedRed.VDR)), 0.25},
		campo{"CÁLCULO DO BM", moeda(n.Valores.VCalcBM), 0.25},
	)
	linha(
		campo{"BC ISSQN", moeda(n.Valores.VBC), 0.25},
		campo{"ALÍQUOTA APLICADA", percent(firstNonEmpty(n.Valores.PAliqAplic, tm.PAliq)), 0.25},
		campo{"RETENÇÃO DO ISSQN", retISSQNTexto(tm.TpRetISSQN), 0.25},
		campo{"ISSQN APURADO", moeda(n.Valores.VISSQN), 0.25},
	)

	// ── Tributação federal ──────────────────────────────────────────────────
	tf := v.Trib.TribFed
	secao("TRIBUTAÇÃO FEDERAL")
	pisRetido := tf.PisCofins.TpRetPisCofins == "1"
	pis, cofins := tf.PisCofins.VPis, tf.PisCofins.VCofins
	linha(
		campo{"IRRF", moeda(tf.VRetIRRF), 0.2},
		campo{"CONTRIB. PREVIDENCIÁRIA - RETIDA", moeda(tf.VRetCP), 0.2},
		campo{"CONTRIBUIÇÕES SOCIAIS - RETIDAS", moeda(tf.VRetCSLL), 0.2},
		campo{"PIS - DÉBITO APUR. PRÓPRIA", moeda(cond(!pisRetido, pis)), 0.2},
		campo{"COFINS - DÉBITO APUR. PRÓPRIA", moeda(cond(!pisRetido, cofins)), 0.2},
	)

	// ── Valor total ─────────────────────────────────────────────────────────
	secao("VALOR TOTAL DA NFS-e")
	issRetido := ""
	if tm.TpRetISSQN == "2" || tm.TpRetISSQN == "3" {
		issRetido = n.Valores.VISSQN
	}
	retFed := soma(tf.VRetIRRF, tf.VRetCP, tf.VRetCSLL, cond(pisRetido, pis), cond(pisRetido, cofins))
	linha(
		campo{"VALOR DO SERVIÇO", moeda(v.VServPrest.VServ), 0.25},
		campo{"DESCONTO CONDICIONADO", moeda(v.VDesc.VDescCond), 0.25},
		campo{"DESCONTO INCONDICIONADO", moeda(v.VDesc.VDescIncond), 0.25},
		campo{"ISSQN RETIDO", moeda(issRetido), 0.25},
	)
	linha(
		campo{"TOTAL DAS RETENÇÕES FEDERAIS", moeda(retFed), 0.25},
		campo{"PIS/COFINS - DÉBITO APUR. PRÓPRIA", moeda(soma(cond(!pisRetido, pis), cond(!pisRetido, cofins))), 0.25},
		campo{"", "", 0.25},
		campo{"VALOR LÍQUIDO DA NFS-e", moeda(n.Valores.VLiq), 0.25},
	)

	// ── Totais aproximados ──────────────────────────────────────────────────
	tt := v.Trib.TotTrib
	secao("TOTAIS APROXIMADOS DOS TRIBUTOS")
	switch {
	case tt.PTotTribSN != "":
		linha(campo{"ALÍQUOTA DO SIMPLES NACIONAL (PERCENTUAL APROXIMADO DO TOTAL DOS TRIBUTOS)", percent(tt.PTotTribSN), 1})
	case tt.VTotTrib.Fed != "" || tt.VTotTrib.Est != "" || tt.VTotTrib.Mun != "":
		linha(
			campo{"FEDERAIS", moeda(tt.VTotTrib.Fed), 1.0 / 3},
			campo{"ESTADUAIS", moeda(tt.VTotTrib.Est), 1.0 / 3},
			campo{"MUNICIPAIS", moeda(tt.VTotTrib.Mun), 1.0 / 3},
		)
	case tt.PTotTrib.Fed != "" || tt.PTotTrib.Est != "" || tt.PTotTrib.Mun != "":
		linha(
			campo{"FEDERAIS", percent(tt.PTotTrib.Fed), 1.0 / 3},
			campo{"ESTADUAIS", percent(tt.PTotTrib.Est), 1.0 / 3},
			campo{"MUNICIPAIS", percent(tt.PTotTrib.Mun), 1.0 / 3},
		)
	default:
		texto("Não informado")
	}

	// ── Informações complementares ──────────────────────────────────────────
	secao("INFORMAÇÕES COMPLEMENTARES")
	compl := joinNonEmpty("\n", s.InfoCompl.XInfComp, n.XOutInf)
	if op.Cancelada {
		compl = joinNonEmpty("\n", "NFS-e CANCELADA.", compl)
	}
	texto(compl)

	// ── Marca d'água de cancelada ───────────────────────────────────────────
	if op.Cancelada {
		pdf.SetAlpha(0.18, "Normal")
		pdf.SetTextColor(200, 0, 0)
		pdf.SetFont("Helvetica", "B", 78)
		pdf.TransformBegin()
		pdf.TransformRotate(35, pageW/2, pageH/2)
		pdf.Text(pageW/2-pdf.GetStringWidth("CANCELADA")/2, pageH/2, "CANCELADA")
		pdf.TransformEnd()
		pdf.SetAlpha(1, "Normal")
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("danfse: gerar pdf: %w", err)
	}
	return buf.Bytes(), nil
}

// ─── formatação ─────────────────────────────────────────────────────────────

func dashIfEmpty(s string) string {
	if strings.TrimSpace(s) == "" {
		return "-"
	}
	return s
}

func firstNonEmpty(vs ...string) string {
	for _, v := range vs {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func joinNonEmpty(sep string, vs ...string) string {
	var out []string
	for _, v := range vs {
		if strings.TrimSpace(v) != "" {
			out = append(out, strings.TrimSpace(v))
		}
	}
	return strings.Join(out, sep)
}

func cond(ok bool, v string) string {
	if ok {
		return v
	}
	return ""
}

func parseValor(s string) (float64, bool) {
	if strings.TrimSpace(s) == "" {
		return 0, false
	}
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	return f, err == nil
}

func moeda(s string) string {
	if f, ok := parseValor(s); ok {
		return "R$ " + brNumber(f)
	}
	return "-"
}

func percent(s string) string {
	if f, ok := parseValor(s); ok {
		return strings.TrimSuffix(strings.TrimSuffix(brNumber(f), "0"), ",0") + "%"
	}
	return "-"
}

func soma(vs ...string) string {
	var t float64
	any := false
	for _, v := range vs {
		if f, ok := parseValor(v); ok {
			t += f
			any = true
		}
	}
	if !any {
		return ""
	}
	return strconv.FormatFloat(t, 'f', 2, 64)
}

// cepDANFSE formata o CEP; a Receita às vezes devolve sem o zero à esquerda.
func cepDANFSE(c string) string {
	if c != "" && len(c) < 8 {
		c = strings.Repeat("0", 8-len(c)) + c
	}
	return formatCEP(c)
}

// dataBR: "2026-11-04" → "04/11/2026".
func dataBR(s string) string {
	if len(s) == 10 && s[4] == '-' && s[7] == '-' {
		return s[8:10] + "/" + s[5:7] + "/" + s[0:4]
	}
	return dashIfEmpty(s)
}

// formatCTribNac: "010701" → "01.07.01".
func formatCTribNac(c string) string {
	if len(c) == 6 {
		return c[0:2] + "." + c[2:4] + "." + c[4:6]
	}
	return c
}

func paisTexto(c string) string {
	switch c {
	case "":
		return "-"
	case "BR":
		return "Brasil"
	}
	return c
}

func opSimpNacTexto(c string) string {
	switch c {
	case "1":
		return "Não Optante"
	case "2":
		return "Optante - Microempreendedor Individual (MEI)"
	case "3":
		return "Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)"
	}
	return "-"
}

func regApTribSNTexto(c string) string {
	switch c {
	case "1":
		return "Tributos federais e municipal pelo Simples Nacional"
	case "2":
		return "Federais pelo SN e ISSQN pela NFS-e conforme legislação municipal"
	case "3":
		return "Federais e municipal pela NFS-e conforme respectivas legislações"
	}
	return "-"
}

func regEspTribTexto(c string) string {
	switch c {
	case "", "0":
		return "Nenhum"
	case "1":
		return "Ato Cooperado (Cooperativa)"
	case "2":
		return "Estimativa"
	case "3":
		return "Microempresa Municipal"
	case "4":
		return "Notário ou Registrador"
	case "5":
		return "Profissional Autônomo"
	case "6":
		return "Sociedade de Profissionais"
	}
	return c
}

func tribISSQNTexto(c string) string {
	if i, err := strconv.Atoi(c); err == nil {
		return tribISSQNText(i)
	}
	return "-"
}

func retISSQNTexto(c string) string {
	if i, err := strconv.Atoi(c); err == nil {
		return retISSQNText(i)
	}
	return "-"
}
