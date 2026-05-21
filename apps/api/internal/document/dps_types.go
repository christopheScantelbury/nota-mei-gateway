// Package document — DPS (Declaração de Prestação de Serviços) XML types.
//
// DPS v1.01 — matches the official NFS-e Nacional XSD bundle dated 2026-02-09,
// archived in docs/nfse-schemas/Schemas/1.01/. The previous version of this
// file targeted an earlier draft of the spec and was rejected by Receita
// Federal with codigo E1235 ("Falha no esquema XML do DF-e") due to:
//
//   - root prestador block was named <emit> (schema uses <prest>)
//   - tomador address inside <enderNac> (schema uses <end>/<endNac>)
//   - missing required <cLocEmi>, <regEspTrib>
//   - hallucinated <CNAE>, <cRegTrib> children of <regTrib> (not in schema)
//   - <opSimpNac> wrong enum (1=NÃO optante, 2=MEI, 3=ME/EPP)
//   - <cMunIni>/<cMunFim> in serv.locPrest (schema uses <cLocPrestacao>)
//   - <cNBS> mandatory but schema requires <cTribNac> (LC116/2003 6-digit code)
//   - tribMun.tribISSQN.indISSRet (schema: tpRetISSQN at tribMun level)
//   - missing required <totTrib>
//
// Order of XML elements MUST match the XSD <xs:sequence> exactly — the
// validator enforces strict sequence and rejects any permutation.
package document

import "encoding/xml"

// DPSSefinNS is the XML namespace declared by the official XSD.
const DPSSefinNS = "http://www.sped.fazenda.gov.br/nfse"

// ── Root DPS envelope ─────────────────────────────────────────────────────────

// DPS is the root <DPS> element. It carries one <infDPS> child and the
// XMLDSig <Signature> block (injected by the signer).
type DPS struct {
	XMLName xml.Name `xml:"DPS"`
	Xmlns   string   `xml:"xmlns,attr"`
	InfDPS  InfDPS   `xml:"infDPS"`
}

// InfDPS — TCInfDPS in the XSD. Sequence is enforced; do not reorder fields.
type InfDPS struct {
	ID string `xml:"Id,attr"` // TSIdDPS, "DPS" + 8 digits — used as XMLDSig reference

	TpAmb     int    `xml:"tpAmb"`     // 1=produção 2=homologação
	DhEmi     string `xml:"dhEmi"`     // AAAA-MM-DDThh:mm:ss±HH:MM (TSDateTimeUTC)
	VerAplic  string `xml:"verAplic"`  // TSVerAplic
	Serie     string `xml:"serie"`     // TSSerieDPS
	NDPS      string `xml:"nDPS"`      // TSNumDPS
	DCompet   string `xml:"dCompet"`   // AAAA-MM-DD (TSData)
	TpEmit    int    `xml:"tpEmit"`    // 1=Prestador 2=Tomador 3=Intermediário
	CLocEmi   string `xml:"cLocEmi"`   // IBGE 7 dígitos do município de emissão

	Prest   InfoPrestador `xml:"prest"`
	Toma    *InfoPessoa   `xml:"toma,omitempty"`
	Serv    DPSServ       `xml:"serv"`
	Valores InfoValores   `xml:"valores"`
}

// ── Prestador (emit) ──────────────────────────────────────────────────────────

// InfoPrestador — TCInfoPrestador. Choice: CNPJ XOR CPF XOR NIF XOR cNaoNIF
// (we always send CNPJ since MEI/ME/EPP/LP/LR are all PJ).
type InfoPrestador struct {
	CNPJ    string     `xml:"CNPJ"`
	IM      string     `xml:"IM,omitempty"`
	XNome   string     `xml:"xNome,omitempty"`
	End     *DPSEndereco  `xml:"end,omitempty"`
	Email   string     `xml:"email,omitempty"`
	RegTrib RegimeTrib `xml:"regTrib"` // mandatory
}

// RegimeTrib — TCRegTrib. opSimpNac and regEspTrib are required.
//   opSimpNac:  1=NÃO Optante | 2=Optante MEI | 3=Optante ME/EPP
//   regEspTrib: 0=Nenhum | 1=Ato Cooperado | 2=Estimativa | 3=ME Municipal
//               | 4=Notário | 5=Profissional Autônomo | 6=Sociedade Prof
//               | 9=Outros
type RegimeTrib struct {
	OpSimpNac   int  `xml:"opSimpNac"`
	RegApTribSN *int `xml:"regApTribSN,omitempty"` // só para opSimpNac=3
	RegEspTrib  int  `xml:"regEspTrib"`
}

// ── Tomador / Intermediário (TCInfoPessoa) ────────────────────────────────────

// InfoPessoa — TCInfoPessoa. Choice: CNPJ XOR CPF XOR NIF XOR cNaoNIF.
type InfoPessoa struct {
	CNPJ    string    `xml:"CNPJ,omitempty"`
	CPF     string    `xml:"CPF,omitempty"`
	NIF     string    `xml:"NIF,omitempty"`
	CNaoNIF *int      `xml:"cNaoNIF,omitempty"`
	IM      string    `xml:"IM,omitempty"`
	XNome   string    `xml:"xNome"` // required
	End     *DPSEndereco `xml:"end,omitempty"`
	Email   string    `xml:"email,omitempty"`
}

// ── Endereço (TCEndereco) ─────────────────────────────────────────────────────

// Endereco — TCEndereco. Choice: endNac XOR endExt.
// xLgr, nro, xBairro são obrigatórios.
type DPSEndereco struct {
	EndNac  *EnderNac `xml:"endNac,omitempty"`
	XLgr    string    `xml:"xLgr"`
	Nro     string    `xml:"nro"`
	XCpl    string    `xml:"xCpl,omitempty"`
	XBairro string    `xml:"xBairro"`
}

// EnderNac — TCEnderNac (apenas endereços nacionais).
type EnderNac struct {
	CMun string `xml:"cMun"` // IBGE 7
	CEP  string `xml:"CEP"`  // 8 dígitos sem hífen
}

// ── Serviço (TCServ) ──────────────────────────────────────────────────────────

// Servico — TCServ. locPrest e cServ são obrigatórios.
type DPSServ struct {
	LocPrest LocPrest `xml:"locPrest"`
	CServ    CServ    `xml:"cServ"`
}

// LocPrest — TCLocPrest. Choice: cLocPrestacao XOR cPaisPrestacao.
type LocPrest struct {
	CLocPrestacao  string `xml:"cLocPrestacao,omitempty"`
	CPaisPrestacao string `xml:"cPaisPrestacao,omitempty"`
}

// CServ — TCCServ. Order: cTribNac (req), cTribMun (opt), xDescServ (req),
// cNBS (opt), cIntContrib (opt).
type CServ struct {
	CTribNac    string `xml:"cTribNac"` // 6 dígitos LC116/2003 — ItemSubitemDesdobro
	CTribMun    string `xml:"cTribMun,omitempty"`
	XDescServ   string `xml:"xDescServ"`
	CNBS        string `xml:"cNBS,omitempty"` // 8 dígitos NBS v2
	CIntContrib string `xml:"cIntContrib,omitempty"`
}

// ── Valores (TCInfoValores) ───────────────────────────────────────────────────

// InfoValores — TCInfoValores. vServPrest e trib são obrigatórios.
type InfoValores struct {
	VServPrest      VServPrest      `xml:"vServPrest"`
	VDescCondIncond *VDescCondIncon `xml:"vDescCondIncond,omitempty"`
	Trib            InfoTributacao  `xml:"trib"`
}

// VServPrest — TCVServPrest. vReceb optional, vServ required.
type VServPrest struct {
	VReceb float64 `xml:"vReceb,omitempty"`
	VServ  float64 `xml:"vServ"`
}

// VDescCondIncon — TCVDescCondIncond. Both optional.
type VDescCondIncon struct {
	VDescIncond float64 `xml:"vDescIncond,omitempty"`
	VDescCond   float64 `xml:"vDescCond,omitempty"`
}

// InfoTributacao — TCInfoTributacao. tribMun e totTrib são obrigatórios.
type InfoTributacao struct {
	TribMun TribMunicipal `xml:"tribMun"`
	TotTrib TribTotal     `xml:"totTrib"`
}

// TribMunicipal — TCTribMunicipal.
//   tribISSQN: 1=Tributável | 2=Imunidade | 3=Exportação | 4=Não Incidência
//   tpRetISSQN: 1=Não Retido | 2=Retido pelo Tomador | 3=Retido pelo Intermediário
type TribMunicipal struct {
	TribISSQN  int     `xml:"tribISSQN"`
	TpRetISSQN int     `xml:"tpRetISSQN"`
	PAliq      float64 `xml:"pAliq,omitempty"`
}

// TribTotal — TCTribTotal. Choice (one of):
//   vTotTrib   (monet, fed+est+mun)
//   pTotTrib   (percent, fed+est+mun)
//   indTotTrib (=0, não informa)
//   pTotTribSN (% aproximado do SN)
//
// Para MEI/SN simples, usar pTotTribSN.
type TribTotal struct {
	VTotTrib   *TribTotalMonet   `xml:"vTotTrib,omitempty"`
	PTotTrib   *TribTotalPercent `xml:"pTotTrib,omitempty"`
	IndTotTrib *int              `xml:"indTotTrib,omitempty"`
	PTotTribSN *float64          `xml:"pTotTribSN,omitempty"`
}

// TribTotalMonet — TCTribTotalMonet.
type TribTotalMonet struct {
	VTotTribFed float64 `xml:"vTotTribFed"`
	VTotTribEst float64 `xml:"vTotTribEst"`
	VTotTribMun float64 `xml:"vTotTribMun"`
}

// TribTotalPercent — TCTribTotalPercent.
type TribTotalPercent struct {
	PTotTribFed float64 `xml:"pTotTribFed"`
	PTotTribEst float64 `xml:"pTotTribEst"`
	PTotTribMun float64 `xml:"pTotTribMun"`
}

// ── Enum constants ────────────────────────────────────────────────────────────

const (
	// opSimpNac
	OpSimpNacNaoOptante = 1
	OpSimpNacMEI        = 2
	OpSimpNacMEEPP      = 3

	// regEspTrib
	RegEspTribNenhum            = 0
	RegEspTribAtoCooperado      = 1
	RegEspTribEstimativa        = 2
	RegEspTribMEMunicipal       = 3
	RegEspTribNotario           = 4
	RegEspTribProfissAutonomo   = 5
	RegEspTribSociedadeProfis   = 6
	RegEspTribOutros            = 9

	// tpEmit
	TpEmitPrestador     = 1
	TpEmitTomador       = 2
	TpEmitIntermediario = 3

	// tribISSQN
	TribISSQNTributavel    = 1
	TribISSQNImunidade     = 2
	TribISSQNExportacao    = 3
	TribISSQNNaoIncidencia = 4

	// tpRetISSQN
	TpRetISSQNNaoRetido           = 1
	TpRetISSQNRetidoTomador       = 2
	TpRetISSQNRetidoIntermediario = 3

	// indTotTrib (único valor válido — Decreto 8.264/2014)
	IndTotTribNaoInforma = 0

	// Application version declared in <verAplic>.
	DPSVerAplic = "NotaFacilGateway-1.01"

	// Default série DPS.
	DPSSerie = "00001"
)
