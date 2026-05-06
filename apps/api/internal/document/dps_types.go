// Package document — DPS (Declaração de Prestação de Serviços) XML types.
//
// DPS is the federal document for ME/EPP companies in the NFS-e Nacional system.
// Unlike the RPS (used by MEI with the ABRASF municipal schema), the DPS is sent
// directly to the ADN (Ambiente de Dados Nacional) via SEFIN Nacional.
//
// Reference: NT 004 v2.0 — gov.br/nfse → Acesso à informação → Notas Técnicas
//
// ⚠️  Namespace: The xmlns value below MUST match the XSD official exactly.
//
//	Download the schema from gov.br/nfse → Integrar ao sistema → Schemas
//	and verify before connecting to the ADN production environment.
//	A wrong namespace causes silent rejection with no error from the ADN.
package document

import "encoding/xml"

// DPSSefinNS is the XML namespace for the NFS-e Nacional DPS schema.
// Source: NT 004 v2.0 / gov.br/nfse official XSD.
const DPSSefinNS = "http://www.sped.fazenda.gov.br/nfse"

// DPS is the root element of a Declaração de Prestação de Serviços envelope.
// It wraps infDPS (the signed payload) and the XMLDSig Signature block.
type DPS struct {
	XMLName xml.Name `xml:"DPS"`
	Xmlns   string   `xml:"xmlns,attr"`
	InfDPS  InfDPS   `xml:"infDPS"`
	// Signature is injected by XMLDSigSigner.Sign — omit when marshalling unsigned.
	// The string field avoids xml.Marshal escaping the inner XML.
	// Signer inserts the raw <Signature>...</Signature> block via byte manipulation.
}

// InfDPS is the signed payload inside a DPS.
// The Id attribute value must be unique per empresa: format "DPS{serie}{nDPS}",
// e.g. "DPS1000001" for serie=1, nDPS=000001.
type InfDPS struct {
	ID       string `xml:"Id,attr"` // "DPS{serie}{nDPS}" — used as XMLDSig reference
	TpAmb    int    `xml:"tpAmb"`   // 1=produção, 2=homologação
	DhEmi    string `xml:"dhEmi"`   // ISO 8601 with explicit -HH:MM offset, e.g. 2026-06-01T10:00:00-04:00
	VerAplic string `xml:"verAplic"`
	Serie    string `xml:"serie"`
	NDPS     string `xml:"nDPS"`
	DCompet  string `xml:"dCompet"` // AAAA-MM-DD (primeiro dia do mês de competência)

	Emit    DPSEmit    `xml:"emit"`
	Toma    DPSTomador `xml:"toma"`
	Serv    DPSServico `xml:"serv"`
	Valores DPSValores `xml:"valores"`
}

// ── Emitente ──────────────────────────────────────────────────────────────────

// DPSEmit identifies the service provider (prestador).
type DPSEmit struct {
	CNPJ     string              `xml:"CNPJ"`
	RegTrib  DPSRegimeTributario `xml:"regTrib"`
	XNome    string              `xml:"xNome"`
	EnderNac DPSEnderNac         `xml:"enderNac"`
	Email    string              `xml:"email,omitempty"`
	// IM (Inscrição Municipal) must be omitted entirely when not present — never send empty tag.
	IM string `xml:"IM,omitempty"`
}

// DPSRegimeTributario holds the tax regime for the emitente.
// Values per NT 004 v2.0 Chapter 12:
//
//	opSimpNac: 1=Optante SN, 2=Não optante
//	cRegTrib:  1=Simples Nacional, 3=Regime Normal (LP/LR), 4=MEI (SIMEI)
//	cRegEspTrib: 0 or omit when none
type DPSRegimeTributario struct {
	OpSimpNac   int    `xml:"opSimpNac"`
	CNAE        string `xml:"CNAE"`
	CRegTrib    int    `xml:"cRegTrib"`
	CRegEspTrib int    `xml:"cRegEspTrib,omitempty"`
}

// ── Tomador ───────────────────────────────────────────────────────────────────

// DPSTomador identifies the service recipient.
// Use CNPJ for PJ or CPF for PF — only one should be non-empty.
type DPSTomador struct {
	CNPJ     string       `xml:"CNPJ,omitempty"`
	CPF      string       `xml:"CPF,omitempty"`
	XNome    string       `xml:"xNome"`
	EnderNac *DPSEnderNac `xml:"enderNac,omitempty"`
	Email    string       `xml:"email,omitempty"`
}

// DPSEnderNac holds domestic address info (IBGE municipality code + CEP).
type DPSEnderNac struct {
	CMun string `xml:"cMun"` // IBGE 7-digit code
	CEP  string `xml:"CEP"`  // 8 digits, no hyphen
}

// ── Serviço ───────────────────────────────────────────────────────────────────

// DPSServico describes the service being invoiced.
type DPSServico struct {
	LocPrest DPSLocPrest `xml:"locPrest"`
	CServ    DPSCServ    `xml:"cServ"`
}

// DPSLocPrest holds the service location (start and end municipality).
type DPSLocPrest struct {
	CMunIni string `xml:"cMunIni"` // IBGE where service started
	CMunFim string `xml:"cMunFim"` // IBGE where service ended
}

// DPSCServ identifies the type of service by NBS code.
type DPSCServ struct {
	CNBS      string `xml:"cNBS"`      // Nomenclatura Brasileira de Serviços, e.g. "01.01.01.10"
	XDescServ string `xml:"xDescServ"` // service description
}

// ── Valores e Tributação ─────────────────────────────────────────────────────

// DPSValores holds the monetary values and tax breakdown.
type DPSValores struct {
	VServPrest DPSVServPrest `xml:"vServPrest"`
	Trib       DPSTrib       `xml:"trib"`
}

// DPSVServPrest holds the gross service value received.
type DPSVServPrest struct {
	VReceb float64 `xml:"vReceb"` // valor bruto recebido pelo prestador
}

// DPSTrib holds the tax breakdown.
type DPSTrib struct {
	TribMun DPSTribMun `xml:"tribMun"`
}

// DPSTribMun holds the municipal tax (ISS) breakdown.
// Values per NT 004 v2.0 Chapter 12:
//
//	cNatOp:    1=Tributação no município, 2=Tributação fora do município
//	indIncFisc: 1=Tributável, 3=Imune, 4=Isento
type DPSTribMun struct {
	TribISSQN  DPSTribISSQN `xml:"tribISSQN"`
	CNatOp     int          `xml:"cNatOp"`     // 1=tributação no município
	IndIncFisc int          `xml:"indIncFisc"` // 1=tributável
}

// DPSTribISSQN holds the ISS calculation fields.
// Values per NT 004 v2.0 Chapter 12:
//
//	indISSRet: 1=ISS retido pelo tomador, 2=ISS não retido (prestador recolhe)
//	vISSRet:   only when indISSRet=1 — must be omitted when indISSRet=2
type DPSTribISSQN struct {
	CLocIncid string  `xml:"cLocIncid"`          // IBGE code of the ISS incidence municipality
	PAliq     float64 `xml:"pAliq"`              // ISS rate in percentage, e.g. 2.00
	IndISSRet int     `xml:"indISSRet"`          // 1=retido, 2=não retido
	VISSRet   float64 `xml:"vISSRet,omitempty"`  // withheld ISS value; omit when not retained
	ExigSusp  string  `xml:"exigSusp,omitempty"` // suspension code; omit when not applicable
}

// ── Value-table constants (NT 004 v2.0, Cap. 12) ─────────────────────────────

const (
	// OpSimpNacSim = 1: optante pelo Simples Nacional (SN / MEI-SIMEI).
	OpSimpNacSim = 1
	// OpSimpNacNao = 2: não optante (Lucro Presumido, Lucro Real).
	OpSimpNacNao = 2

	// CRegTribSN = 1: Simples Nacional.
	CRegTribSN = 1
	// CRegTribNormal = 3: Regime Normal (Lucro Presumido / Lucro Real).
	CRegTribNormal = 3
	// CRegTribMEI = 4: MEI (SIMEI).
	CRegTribMEI = 4

	// IndISSRetido = 1: ISS retido pelo tomador.
	IndISSRetido = 1
	// IndISSNaoRetido = 2: ISS não retido (prestador recolhe via DAS ou DARF).
	IndISSNaoRetido = 2

	// CNatOpMunicipio = 1: tributação no município.
	CNatOpMunicipio = 1
	// CNatOpForaMunicipio = 2: tributação fora do município.
	CNatOpForaMunicipio = 2

	// IndIncFiscTributavel = 1: tributável.
	IndIncFiscTributavel = 1
	// IndIncFiscImune = 3: imune.
	IndIncFiscImune = 3
	// IndIncFiscIsento = 4: isento.
	IndIncFiscIsento = 4

	// DPSVerAplic is the application version declared in the DPS envelope.
	DPSVerAplic = "1.0.0"

	// DPSSerie is the default series for DPS documents.
	DPSSerie = "1"
)
