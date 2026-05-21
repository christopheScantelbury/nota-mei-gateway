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
// Id é obrigatório (TSIdPedRegEvt: "PRE" + chave(50) + tipoEvento(6) = 59 chars).
type InfPedReg struct {
	ID         string              `xml:"Id,attr"`
	TpAmb      int                 `xml:"tpAmb"`
	VerAplic   string              `xml:"verAplic"`
	DhEvento   string              `xml:"dhEvento"`
	CNPJAutor  string              `xml:"CNPJAutor,omitempty"`
	CPFAutor   string              `xml:"CPFAutor,omitempty"`
	ChNFSe     string              `xml:"chNFSe"`
	E101101    *EventoCancelamento `xml:"e101101,omitempty"`
	E105102    *EventoSubstituicao `xml:"e105102,omitempty"`
}

// EventoCancelamento — TE101101 (cancelamento sem substituição).
type EventoCancelamento struct {
	XDesc   string `xml:"xDesc"`   // fixed value "Cancelamento de NFS-e"
	CMotivo int    `xml:"cMotivo"` // 1=Erro na Emissão | 2=Serviço não Prestado | 9=Outros
	XMotivo string `xml:"xMotivo"` // 15-255 chars descrição
}

// EventoSubstituicao — TE105102 (cancelamento por substituição).
// Sent against the ORIGINAL chave to mark it cancelled in favour of a new
// DPS that already carries the <subst><chSubstda>{original}</subst> block.
type EventoSubstituicao struct {
	XDesc        string `xml:"xDesc"`               // fixed value "Cancelamento de NFS-e por Substituição"
	CMotivo      string `xml:"cMotivo"`             // 01..05 | 99 per TSCodJustSubst
	XMotivo      string `xml:"xMotivo,omitempty"`   // 15-255 chars
	ChSubstituta string `xml:"chSubstituta"`        // 50-digit chave da NFS-e substituta
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

// SubstituicaoParams holds the input for BuildSubstituicaoEvent.
type SubstituicaoParams struct {
	ChaveOriginal   string // 50-digit chave da NFS-e a ser cancelada por substituição
	ChaveSubstituta string // 50-digit chave da nova NFS-e que substitui a original
	CNPJPrestador   string
	CodigoMotivo    string // TSCodJustSubst: 01..05 | 99
	DescricaoMotivo string // opcional 15-255 chars
}

// BuildSubstituicaoEvent assembles a signed-ready pedRegEvento with the
// e105102 (cancelamento por substituição) event. POSTed to
// /SefinNacional/nfse/{chaveOriginal}/eventos via adapter.CancelarNFSeNacional.
//
// The TWO chaves MUST differ and must each be exactly 50 digits.
func BuildSubstituicaoEvent(p SubstituicaoParams) ([]byte, error) {
	original := stripNonDigits(p.ChaveOriginal)
	substituta := stripNonDigits(p.ChaveSubstituta)
	if len(original) != 50 {
		return nil, fmt.Errorf("substituição: chave_original deve ter 50 dígitos (recebi %d)", len(original))
	}
	if len(substituta) != 50 {
		return nil, fmt.Errorf("substituição: chave_substituta deve ter 50 dígitos (recebi %d)", len(substituta))
	}
	if original == substituta {
		return nil, fmt.Errorf("substituição: chave_original e chave_substituta não podem ser iguais")
	}
	cnpj := stripNonDigits(p.CNPJPrestador)
	if len(cnpj) != 14 {
		return nil, fmt.Errorf("substituição: CNPJ inválido")
	}
	if p.CodigoMotivo == "" {
		return nil, fmt.Errorf("substituição: cMotivo é obrigatório")
	}
	xMotivo := strings.TrimSpace(p.DescricaoMotivo)
	// xMotivo é OPCIONAL no e105102, mas se informado deve seguir TSMotivo (15-255).
	if xMotivo != "" && (len(xMotivo) < MinXMotivoLen || len(xMotivo) > MaxXMotivoLen) {
		return nil, fmt.Errorf("substituição: xMotivo deve ter entre %d e %d caracteres ou estar vazio",
			MinXMotivoLen, MaxXMotivoLen)
	}

	const tipoEventoSubstituicao = "105102"
	infPedRegID := "PRE" + original + tipoEventoSubstituicao

	doc := PedRegEvento{
		Xmlns:  DPSSefinNS,
		Versao: DPSVersao,
		InfPedReg: InfPedReg{
			ID:        infPedRegID,
			TpAmb:     currentTpAmb(),
			VerAplic:  DPSVerAplic,
			DhEvento:  time.Now().In(fusoManaus()).Format("2006-01-02T15:04:05-07:00"),
			CNPJAutor: cnpj,
			ChNFSe:    original,
			E105102: &EventoSubstituicao{
				XDesc:        "Cancelamento de NFS-e por Substituição",
				CMotivo:      p.CodigoMotivo,
				XMotivo:      xMotivo,
				ChSubstituta: substituta,
			},
		},
	}

	out, err := xml.MarshalIndent(doc, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal pedRegEvento substituição: %w", err)
	}
	return append([]byte(xml.Header), out...), nil
}
