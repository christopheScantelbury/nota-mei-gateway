package document

import (
	"encoding/xml"
	"fmt"
	"strings"
)

// ExtractDPSFields parses a DPS XML document (the DF-e we generated and sent to
// the Receita) and fills the rich fields of p that are not available as plain
// columns in the notas_fiscais table — service description, código de
// tributação, ISS rate/retention, prestador/tomador address & e-mail, regime
// tributário, etc.
//
// It is best-effort: on any parse error it leaves p untouched and returns the
// error so the caller can decide whether to log it. A nil/empty xmlData is a
// no-op (no error) so notas without a stored DPS still render the basic PDF.
func ExtractDPSFields(xmlData []byte, p *ComprovanteParams) error {
	if len(xmlData) == 0 {
		return nil
	}

	var dps DPS
	if err := xml.Unmarshal(xmlData, &dps); err != nil {
		return fmt.Errorf("parse DPS xml: %w", err)
	}
	inf := dps.InfDPS

	// ── Identificação ───────────────────────────────────────────────────────
	p.SerieDPS = inf.Serie
	p.DhEmiDPS = inf.DhEmi

	// ── Prestador ───────────────────────────────────────────────────────────
	p.PrestadorIM = inf.Prest.IM
	p.PrestadorEmail = inf.Prest.Email
	if inf.Prest.End != nil {
		p.PrestadorEndereco = formatEndereco(inf.Prest.End)
		if inf.Prest.End.EndNac != nil {
			p.PrestadorMunicipioIBGE = inf.Prest.End.EndNac.CMun
			p.PrestadorCEP = formatCEP(inf.Prest.End.EndNac.CEP)
		}
	}
	p.RegimeTributario = regimeText(inf.Prest.RegTrib.OpSimpNac)

	// ── Tomador ─────────────────────────────────────────────────────────────
	if inf.Toma != nil {
		p.TomadorEmail = inf.Toma.Email
		p.TomadorIM = inf.Toma.IM
		if inf.Toma.End != nil {
			p.TomadorEndereco = formatEndereco(inf.Toma.End)
			if inf.Toma.End.EndNac != nil {
				p.TomadorMunicipioIBGE = inf.Toma.End.EndNac.CMun
				p.TomadorCEP = formatCEP(inf.Toma.End.EndNac.CEP)
			}
		}
	}

	// ── Serviço ─────────────────────────────────────────────────────────────
	p.CodTributacaoNacional = inf.Serv.CServ.CTribNac
	p.DescricaoServico = inf.Serv.CServ.XDescServ
	p.CodNBS = inf.Serv.CServ.CNBS
	p.LocalPrestacaoIBGE = inf.Serv.LocPrest.CLocPrestacao

	// ── Tributação / valores ────────────────────────────────────────────────
	p.TribISSQNTexto = tribISSQNText(inf.Valores.Trib.TribMun.TribISSQN)
	p.ISSRetidoTexto = retISSQNText(inf.Valores.Trib.TribMun.TpRetISSQN)
	p.AliquotaISS = inf.Valores.Trib.TribMun.PAliq

	if inf.Valores.VDescCondIncond != nil {
		p.DescontoIncondicionado = inf.Valores.VDescCondIncond.VDescIncond
		p.DescontoCondicionado = inf.Valores.VDescCondIncond.VDescCond
	}

	// Valor líquido = serviço − descontos − ISS retido (quando retido).
	liquido := inf.Valores.VServPrest.VServ - p.DescontoIncondicionado - p.DescontoCondicionado
	if liquido < 0 {
		liquido = inf.Valores.VServPrest.VServ
	}
	p.ValorLiquido = liquido

	return nil
}

func formatEndereco(e *DPSEndereco) string {
	parts := []string{}
	if e.XLgr != "" {
		parts = append(parts, e.XLgr)
	}
	if e.Nro != "" {
		parts = append(parts, e.Nro)
	}
	if e.XCpl != "" {
		parts = append(parts, e.XCpl)
	}
	if e.XBairro != "" {
		parts = append(parts, e.XBairro)
	}
	return strings.Join(parts, ", ")
}

func formatCEP(cep string) string {
	if len(cep) == 8 {
		return cep[:5] + "-" + cep[5:]
	}
	return cep
}

func regimeText(opSimpNac int) string {
	switch opSimpNac {
	case OpSimpNacMEI:
		return "Optante - Microempreendedor Individual (MEI)"
	case OpSimpNacMEEPP:
		return "Optante - ME/EPP (Simples Nacional)"
	case OpSimpNacNaoOptante:
		return "Não optante pelo Simples Nacional"
	}
	return "-"
}

func tribISSQNText(t int) string {
	switch t {
	case TribISSQNTributavel:
		return "Operação Tributável"
	case TribISSQNImunidade:
		return "Imunidade"
	case TribISSQNExportacao:
		return "Exportação de Serviço"
	case TribISSQNNaoIncidencia:
		return "Não Incidência"
	}
	return "-"
}

func retISSQNText(t int) string {
	switch t {
	case TpRetISSQNNaoRetido:
		return "Não Retido"
	case TpRetISSQNRetidoTomador:
		return "Retido pelo Tomador"
	case TpRetISSQNRetidoIntermediario:
		return "Retido pelo Intermediário"
	}
	return "-"
}
