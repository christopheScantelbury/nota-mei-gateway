// Package document — Pedido de Registro de Evento (cancelamento) builder.
//
// Per pedRegEvento_v1.01.xsd / tiposEventos_v1.01.xsd, NFS-e Nacional handles
// cancellation as an "evento" rather than a separate API call shape. The
// emitter POSTs a pedRegEvento with a TE101101 cancellation child to
//
//	POST https://sefin.nfse.gov.br/SefinNacional/nfse/{chaveAcesso}/eventos
//
// gzip+base64+JSON wrapping — same wire format as DPS emission — handled by
// adapter.CancelarNFSeNacional.
package document

import (
	"encoding/xml"
	"fmt"
	"strings"
	"time"
)

// ── XML types per pedRegEvento_v1.01.xsd ──────────────────────────────────────

// PedRegEvento is the root <pedRegEvento> element.
type PedRegEvento struct {
	XMLName   xml.Name  `xml:"pedRegEvento"`
	Xmlns     string    `xml:"xmlns,attr"`
	Versao    string    `xml:"versao,attr"`
	InfPedReg InfPedReg `xml:"infPedReg"`
}

// InfPedReg — TCInfPedReg. Sequence:
//
//	tpAmb, verAplic, dhEvento, (CNPJAutor | CPFAutor), chNFSe, <evento>
//
// We always send CNPJAutor (prestador = MEI/ME/EPP/LP/LR are PJ).
type InfPedReg struct {
	// Id attribute is not in the schema for infPedReg, but XMLDSig needs a
	// reference target. We add one anyway so the signer can wire URI="#..."
	// — the validator ignores unknown attributes.
	ID         string             `xml:"Id,attr,omitempty"`
	TpAmb      int                `xml:"tpAmb"`
	VerAplic   string             `xml:"verAplic"`
	DhEvento   string             `xml:"dhEvento"`
	CNPJAutor  string             `xml:"CNPJAutor,omitempty"`
	CPFAutor   string             `xml:"CPFAutor,omitempty"`
	ChNFSe     string             `xml:"chNFSe"`
	E101101    *EventoCancelamento `xml:"e101101,omitempty"`
}

// EventoCancelamento — TE101101 (cancelamento sem substituição).
type EventoCancelamento struct {
	XDesc   string `xml:"xDesc"`   // fixed value "Cancelamento de NFS-e"
	CMotivo int    `xml:"cMotivo"` // 1=Erro na Emissão | 2=Serviço não Prestado | 9=Outros
	XMotivo string `xml:"xMotivo"` // 15-255 chars descrição
}

// Cancellation justification codes per TSCodJustCanc.
const (
	CMotivoCancErroEmissao   = 1
	CMotivoCancNaoPrestado   = 2
	CMotivoCancOutros        = 9
	XDescCancelamentoPadrao  = "Cancelamento de NFS-e"
	MinXMotivoLen            = 15
	MaxXMotivoLen            = 255
)

// ── Builder ───────────────────────────────────────────────────────────────────

// CancelamentoParams holds the input for BuildCancelamentoEvent.
type CancelamentoParams struct {
	ChaveAcesso     string // 50-digit chave de acesso da NFS-e a cancelar
	CNPJPrestador   string // CNPJ que figura como prestador na NFS-e
	CodigoJustif    int    // CMotivoCancErroEmissao / NaoPrestado / Outros
	DescricaoMotivo string // 15-255 chars
}

// BuildCancelamentoEvent assembles a signed-ready pedRegEvento XML for the
// e101101 cancellation event. Caller must sign + send via
// adapter.CancelarNFSeNacional(chaveAcesso, signedXML, cert).
func BuildCancelamentoEvent(p CancelamentoParams) ([]byte, error) {
	chave := stripNonDigits(p.ChaveAcesso)
	if len(chave) != 50 {
		return nil, fmt.Errorf("cancelamento: chave_acesso deve ter 50 dígitos (recebi %d)", len(chave))
	}
	cnpj := stripNonDigits(p.CNPJPrestador)
	if len(cnpj) != 14 {
		return nil, fmt.Errorf("cancelamento: CNPJ inválido")
	}
	motivo := strings.TrimSpace(p.DescricaoMotivo)
	if len(motivo) < MinXMotivoLen || len(motivo) > MaxXMotivoLen {
		return nil, fmt.Errorf("cancelamento: xMotivo deve ter entre %d e %d caracteres (recebi %d)",
			MinXMotivoLen, MaxXMotivoLen, len(motivo))
	}
	if p.CodigoJustif != CMotivoCancErroEmissao &&
		p.CodigoJustif != CMotivoCancNaoPrestado &&
		p.CodigoJustif != CMotivoCancOutros {
		return nil, fmt.Errorf("cancelamento: cMotivo inválido %d (use 1/2/9)", p.CodigoJustif)
	}

	// TSIdPedRegEvt: "PRE" + chaveAcesso(50) + tipoEvento(6) = 59 chars.
	// For cancellation the tipo is "101101".
	const tipoEventoCancelamento = "101101"
	infPedRegID := "PRE" + chave + tipoEventoCancelamento

	doc := PedRegEvento{
		Xmlns:  DPSSefinNS,
		Versao: DPSVersao,
		InfPedReg: InfPedReg{
			ID:        infPedRegID,
			TpAmb:     currentTpAmb(),
			VerAplic:  DPSVerAplic,
			DhEvento:  time.Now().In(fusoManaus()).Format("2006-01-02T15:04:05-07:00"),
			CNPJAutor: cnpj,
			ChNFSe:    chave,
			E101101: &EventoCancelamento{
				XDesc:   XDescCancelamentoPadrao,
				CMotivo: p.CodigoJustif,
				XMotivo: motivo,
			},
		},
	}

	out, err := xml.MarshalIndent(doc, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal pedRegEvento: %w", err)
	}
	return append([]byte(xml.Header), out...), nil
}
