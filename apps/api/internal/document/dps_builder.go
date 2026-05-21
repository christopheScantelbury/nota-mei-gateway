// Package document — DPS builder for NFS-e Nacional v1.01.
//
// Builds DPS XML envelopes against the official XSD bundle dated 2026-02-09
// (docs/nfse-schemas/Schemas/1.01/). The previous builder targeted an
// outdated draft and was rejected by Receita Federal with E1235.
//
// Endpoint:
//   POST https://sefin.nfse.gov.br/SefinNacional/nfse
//   Production-restricted (homologação):
//     https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/nfse
//
// Authentication: mTLS with ICP-Brasil A1 cert (mandatory).
package document

import (
	"encoding/xml"
	"fmt"
	"math"
	"strings"
	"sync/atomic"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
)

// tpAmbOverride is set by SetTpAmb at startup. Default behaviour (nil) is
// homologação (2) so production builds without an explicit setting fail safe.
var tpAmbOverride atomic.Pointer[int]

// SetTpAmb pins the <tpAmb> tag emitted by every DPS build. Call once at
// startup with 1 (production) or 2 (production-restricted/homologação).
func SetTpAmb(v int) {
	if v != 1 && v != 2 {
		return
	}
	tpAmbOverride.Store(&v)
}

func currentTpAmb() int {
	if v := tpAmbOverride.Load(); v != nil {
		return *v
	}
	return 2
}

// ── Errors ────────────────────────────────────────────────────────────────────

// ErrValidation signals a client-side validation failure that should be
// surfaced as HTTP 422 with a field-specific message.
type ErrValidation struct {
	Field   string
	Message string
}

func (e *ErrValidation) Error() string { return e.Field + ": " + e.Message }

// ── Result ────────────────────────────────────────────────────────────────────

// DPSBuildResult is what the builder returns to the handler.
type DPSBuildResult struct {
	XML          []byte
	ValorISS     float64
	ValorLiquido float64
	ISSRetido    bool
}

// DPSBuilder assembles DPS XML envelopes for MEI / ME / EPP / LP / LR.
type DPSBuilder struct{}

// NewDPSBuilder creates a DPSBuilder.
func NewDPSBuilder() *DPSBuilder { return &DPSBuilder{} }

// Build constructs the DPS XML envelope from the emission request.
//
// empresa.Tipo must be "MEI" | "ME" | "EPP".
// empresa.RegimeTributario must be "SIMPLES_MEI" | "SIMPLES_NACIONAL" |
//   "LUCRO_PRESUMIDO" | "LUCRO_REAL".
// numeroDPS is the atomic counter allocated upstream — reused as <nDPS>.
func (b *DPSBuilder) Build(req EmissaoRequest, empresa *auth.Empresa, numeroDPS int64) (*DPSBuildResult, error) {
	if empresa == nil {
		return nil, fmt.Errorf("empresa is nil")
	}

	// 1. Parse competência
	competenciaDate, err := parseCompetencia(req.Competencia)
	if err != nil {
		return nil, fmt.Errorf("competencia inválida: %w", err)
	}

	// 2. Resolve ISS retention
	issRetido, err := resolveISSRetido(req, empresa)
	if err != nil {
		return nil, err
	}

	// 3. Resolve alíquota + cálculo ISS
	aliquota := req.Servico.AliquotaISS
	if aliquota <= 0 {
		aliquota = DefaultAliquotaISS
	}
	valorServ := req.Servico.Valor
	valorISS := roundHalfUp(valorServ * aliquota / 100)
	valorLiquido := valorServ
	if issRetido {
		valorLiquido = valorServ - valorISS
	}

	// 4. Map regime tributário → (opSimpNac, regEspTrib)
	opSimpNac, regEspTrib := resolveRegime(empresa.RegimeTributario, empresa.Tipo)

	// 5. cTribNac obrigatório (LC116/2003 — 6 dígitos).
	//    Cliente pode passar via req.Servico.CodigoTribNac; senão derivamos
	//    do NBS truncando ou usamos um default.
	cTribNac := resolveCTribNac(req.Servico)
	if cTribNac == "" {
		return nil, &ErrValidation{
			Field:   "servico.codigo_tributacao_nacional",
			Message: "obrigatório — código LC 116/2003 com 6 dígitos (ItemSubitemDesdobro)",
		}
	}

	// 6. Build InfDPS Id (TSIdDPS).
	//
	// Schema-mandated format (45 chars total — pattern "DPS[0-9]{42}"):
	//   "DPS" + cMun(7) + tpInscFed(1) + inscFed(14) + serie(5) + nDPS(15)
	//
	// tpInscFed: 1 = CPF, 2 = CNPJ. Prestador é sempre PJ no Nota Fácil
	// (MEI/ME/EPP/LP/LR) então usamos sempre CNPJ.
	infID := buildInfDPSId(empresa.MunicipioIBGE, empresa.CNPJ, DPSSerie, numeroDPS)
	tpRetISSQN := TpRetISSQNNaoRetido
	if issRetido {
		tpRetISSQN = TpRetISSQNRetidoTomador
	}

	prestEmail := strings.TrimSpace(empresa.Email)
	if prestEmail == "" {
		prestEmail = ""
	}

	tomador := buildDPSTomador(req.Tomador)

	inf := InfDPS{
		ID:       infID,
		TpAmb:    currentTpAmb(),
		DhEmi:    time.Now().In(fusoManaus()).Format("2006-01-02T15:04:05-07:00"),
		VerAplic: DPSVerAplic,
		Serie:    DPSSerie,
		NDPS:     fmt.Sprintf("%d", numeroDPS),
		DCompet:  competenciaDate.Format("2006-01-02"),
		TpEmit:   TpEmitPrestador,
		CLocEmi:  empresa.MunicipioIBGE,

		Prest: InfoPrestador{
			CNPJ:  empresa.CNPJ,
			IM:    derefStr(empresa.InscricaoMunicipal),
			XNome: empresa.RazaoSocial,
			Email: prestEmail,
			RegTrib: RegimeTrib{
				OpSimpNac:  opSimpNac,
				RegEspTrib: regEspTrib,
			},
		},

		Toma: tomador,

		Serv: DPSServ{
			LocPrest: LocPrest{
				CLocPrestacao: empresa.MunicipioIBGE,
			},
			CServ: CServ{
				CTribNac:  cTribNac,
				XDescServ: strings.TrimSpace(req.Servico.Discriminacao),
				// cNBS é opcional na schema (TSCodNBS exige 9 dígitos).
				// Nossa base armazena códigos NBS de 8 dígitos (XX.XX.XX.XX
				// sem o dígito verificador final). Omitimos quando o cliente
				// não fornece um código de 9 dígitos.
				CNBS: normalizeCNBS(req.Servico.CodigoNBS),
			},
		},

		Valores: InfoValores{
			VServPrest: VServPrest{
				VServ: valorServ,
			},
			Trib: InfoTributacao{
				TribMun: TribMunicipal{
					TribISSQN:  TribISSQNTributavel,
					TpRetISSQN: tpRetISSQN,
					// MEI cannot inform pAliq (E0600 — alíquota é fixa via DAS).
					// We zero it for MEI so the omitempty xml tag drops the element.
					PAliq: pAliqFor(opSimpNac, aliquota),
				},
				TotTrib: buildTotTrib(opSimpNac),
			},
		},
	}

	doc := DPS{
		Xmlns:  DPSSefinNS,
		Versao: DPSVersao,
		InfDPS: inf,
	}

	out, err := xml.MarshalIndent(doc, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal DPS: %w", err)
	}

	return &DPSBuildResult{
		XML:          append([]byte(xml.Header), out...),
		ValorISS:     valorISS,
		ValorLiquido: valorLiquido,
		ISSRetido:    issRetido,
	}, nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// resolveRegime maps empresa.RegimeTributario × empresa.Tipo to the schema enums.
func resolveRegime(regime, tipo string) (opSimpNac, regEspTrib int) {
	switch regime {
	case "SIMPLES_MEI":
		return OpSimpNacMEI, RegEspTribNenhum
	case "SIMPLES_NACIONAL":
		return OpSimpNacMEEPP, RegEspTribNenhum
	case "LUCRO_PRESUMIDO", "LUCRO_REAL":
		return OpSimpNacNaoOptante, RegEspTribNenhum
	default:
		// Conservative default: ME/EPP optante SN.
		return OpSimpNacMEEPP, RegEspTribNenhum
	}
}

// resolveISSRetido determines whether ISS is withheld at source.
//   - Simples Nacional / MEI: ISS never withheld at source (DAS already recolhe).
//   - Lucro Presumido / Real: req.IssRetido must be informed.
//   - Tomador órgão público em LP/LR: força retenção (Art. 6 LC 116/2003).
func resolveISSRetido(req EmissaoRequest, empresa *auth.Empresa) (bool, error) {
	switch empresa.RegimeTributario {
	case "SIMPLES_MEI", "SIMPLES_NACIONAL":
		return false, nil
	case "LUCRO_PRESUMIDO", "LUCRO_REAL":
		if req.Tomador.TipoOrgao == "ORGAO_PUBLICO" {
			return true, nil
		}
		if req.IssRetido == nil {
			return false, &ErrValidation{
				Field:   "iss_retido",
				Message: "obrigatório para Lucro Presumido/Real — informe se o ISS será retido pelo tomador",
			}
		}
		return *req.IssRetido, nil
	default:
		return false, nil
	}
}

// resolveCTribNac decides the LC116/2003 6-digit code.
//
//	Priority: req.Servico.CodigoTribNac (explicit) → derived from NBS prefix.
//
// NBS codes (XX.XX.XX.XX) and LC116/2003 codes (XX.XX) overlap on the first
// two groups for most services, so when the client only provides the NBS we
// derive the LC code by taking the first 2 groups + zero-padded desdobro.
func resolveCTribNac(s ServicoRequest) string {
	if v := strings.TrimSpace(s.CodigoTribNac); v != "" {
		return v
	}
	nbs := stripDots(s.CodigoNBS)
	if len(nbs) >= 6 {
		// Reuse the first 6 digits of the NBS — for many services NBS first 6
		// align with the LC code (e.g. NBS 01010210 → LC 010102). The validator
		// will reject mismatches, surfacing the right code via the error msg.
		return nbs[:6]
	}
	return ""
}

// buildDPSTomador converts the API request tomador into the DPS InfoPessoa block.
// Returns nil when the tomador is empty (allowed — toma is optional in the schema).
func buildDPSTomador(t TomadorRequest) *InfoPessoa {
	doc := stripNonDigits(t.Documento)
	if doc == "" && strings.TrimSpace(t.RazaoSocial) == "" {
		return nil
	}
	p := &InfoPessoa{
		XNome: strings.TrimSpace(t.RazaoSocial),
		Email: strings.TrimSpace(t.Email),
	}
	switch t.Tipo {
	case "PJ":
		p.CNPJ = doc
	case "PF":
		p.CPF = doc
	default:
		if len(doc) == 14 {
			p.CNPJ = doc
		} else {
			p.CPF = doc
		}
	}
	return p
}

// buildTotTrib produces the minimum-valid <totTrib> block.
//
//   - MEI (opSimpNac=2): Receita Federal rejected pTotTribSN with code E0710
//     "Para MEI o valor percentual aproximado do total dos tributos da
//     alíquota do Simples Nacional (%) não pode ser informado." MEI pays a
//     fixed DAS amount, not the percent-based SN aliquot. Emit indTotTrib=0.
//   - ME/EPP optante SN (opSimpNac=3): pTotTribSN com 5% (anexos III/V).
//   - Demais regimes (LP/LR): indTotTrib=0 (Decreto 8.264/2014).
func buildTotTrib(opSimpNac int) TribTotal {
	if opSimpNac == OpSimpNacMEEPP {
		p := 5.0 // ME/EPP optante SN: anexos III/V (~5%).
		return TribTotal{PTotTribSN: &p}
	}
	z := IndTotTribNaoInforma
	return TribTotal{IndTotTrib: &z}
}

// roundHalfUp rounds a value to 2 decimals using HALF_UP (banker's rounding
// would underreport ISS on .005 boundaries — Receita expects HALF_UP).
func roundHalfUp(v float64) float64 {
	return math.Floor(v*100+0.5) / 100
}

// buildInfDPSId assembles the 45-char TSIdDPS string demanded by the XSD.
//
//	"DPS" + cMun(7) + tpInscFed(1) + inscFed(14, zero-padded if CPF)
//	    + serie(5)  + nDPS(15)
//
// Only CNPJ is supported here (tpInscFed=2) because the prestador is always
// a juridical person in Nota Fácil — MEI/ME/EPP/LP/LR all have CNPJ.
func buildInfDPSId(cMun, cnpj, serie string, nDPS int64) string {
	const tpInscFed = "2" // 2 = CNPJ
	mun := padLeft(stripNonDigits(cMun), 7)
	doc := padLeft(stripNonDigits(cnpj), 14)
	ser := padLeft(stripNonDigits(serie), 5)
	num := padLeft(fmt.Sprintf("%d", nDPS), 15)
	return "DPS" + mun + tpInscFed + doc + ser + num
}

// padLeft left-pads s with "0" up to width n. Strings longer than n are returned unchanged.
func padLeft(s string, n int) string {
	if len(s) >= n {
		return s
	}
	return strings.Repeat("0", n-len(s)) + s
}

// pAliqFor returns the ISS aliquot for non-MEI regimes; for MEI it returns 0
// so the omitempty struct tag drops the element entirely (E0600).
func pAliqFor(opSimpNac int, aliquota float64) float64 {
	if opSimpNac == OpSimpNacMEI {
		return 0
	}
	return aliquota
}

// normalizeCNBS returns the NBS code only when it matches the 9-digit XSD
// pattern (TSCodNBS = "[0-9]{9}"). Otherwise returns empty so the field is
// omitted from the XML (it's optional in the schema).
func normalizeCNBS(s string) string {
	digits := stripDots(stripNonDigits(s))
	if len(digits) == 9 {
		return digits
	}
	return ""
}

// derefStr returns *s trimmed, or "" when s is nil.
func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return strings.TrimSpace(*s)
}

// stripDots removes dot separators from codes like "01.01.01.10".
func stripDots(s string) string {
	return strings.ReplaceAll(strings.TrimSpace(s), ".", "")
}

// stripNonDigits keeps only ASCII digits.
func stripNonDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// parseCompetencia is defined in builder.go (legacy RPS file) and reused here.

// fusoManaus returns America/Manaus (UTC-4, no DST). Fixed-zone fallback
// avoids depending on the runtime image having a tz database.
func fusoManaus() *time.Location {
	if loc, err := time.LoadLocation("America/Manaus"); err == nil {
		return loc
	}
	return time.FixedZone("BRT-4", -4*60*60)
}
