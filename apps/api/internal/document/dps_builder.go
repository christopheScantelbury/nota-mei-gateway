// Package document — DPS builder for ME/EPP companies.
//
// DPSBuilder assembles DPS XML envelopes for NFS-e emission for ME/EPP
// companies (Simples Nacional and Lucro Presumido) according to NT 004 v2.0.
//
// # Endpoint SEFIN Nacional
//
//	Homologação: https://hom.nfse.gov.br/SefinNacional/nfse/v1/envioLoteDps
//	Produção:    https://nfse.gov.br/SefinNacional/nfse/v1/envioLoteDps
//
// Confirm the exact URL with the MOC (Manual Integrado do SN NFS-e) at
// gov.br/nfse before connecting to production.
package document

import (
	"encoding/xml"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
)

// DPSBuilder assembles DPS XML envelopes for ME/EPP companies.
type DPSBuilder struct{}

// NewDPSBuilder creates a DPSBuilder.
func NewDPSBuilder() *DPSBuilder { return &DPSBuilder{} }

// DPSBuildResult contains the generated XML bytes and the computed tax values,
// used to populate the API response.
type DPSBuildResult struct {
	XML          []byte
	ValorISS     float64
	ValorLiquido float64
	ISSRetido    bool
}

// Build constructs the DPS XML envelope from the emission request.
//
// empresa.Tipo must be "ME" or "EPP".
// empresa.RegimeTributario must be "SIMPLES_NACIONAL" or "LUCRO_PRESUMIDO".
// numeroRPS is repurposed as the DPS sequential number (same atomic counter).
func (b *DPSBuilder) Build(req EmissaoRequest, empresa *auth.Empresa, numeroDPS int64) (*DPSBuildResult, error) {
	// ── 1. Parse competência ─────────────────────────────────────────────────
	competenciaDate, err := parseCompetencia(req.Competencia)
	if err != nil {
		return nil, fmt.Errorf("competencia inválida: %w", err)
	}

	// ── 2. Resolve ISS retention rules ───────────────────────────────────────
	issRetido, err := resolveISSRetido(req, empresa)
	if err != nil {
		return nil, err
	}

	// ── 3. Calculate values ──────────────────────────────────────────────────
	aliquota := req.Servico.AliquotaISS
	if aliquota <= 0 {
		aliquota = DefaultAliquotaISS
	}
	valorISS := roundHalfUp(req.Servico.Valor * aliquota / 100)
	valorLiquido := req.Servico.Valor
	if issRetido {
		valorLiquido = req.Servico.Valor - valorISS
	}

	// ── 4. Resolve regime tributário ─────────────────────────────────────────
	regTrib := resolveRegimeTributario(empresa)

	// ── 5. Build infDPS Id ───────────────────────────────────────────────────
	// Format: "DPS{serie}{nDPS:06d}" — unique per empresa, no special chars.
	infID := fmt.Sprintf("DPS%s%06d", DPSSerie, numeroDPS)

	// ── 6. Resolve ISS indISSRet + vISSRet ──────────────────────────────────
	indISSRet := IndISSNaoRetido
	var vISSRet float64
	if issRetido {
		indISSRet = IndISSRetido
		vISSRet = valorISS
	}

	// ── 7. Build DPS struct ──────────────────────────────────────────────────
	doc := DPS{
		Xmlns: DPSSefinNS,
		InfDPS: InfDPS{
			ID:       infID,
			TpAmb:    resolveTpAmb(empresa),
			DhEmi:    time.Now().In(fusoManaus()).Format("2006-01-02T15:04:05-07:00"),
			VerAplic: DPSVerAplic,
			Serie:    DPSSerie,
			NDPS:     fmt.Sprintf("%06d", numeroDPS),
			DCompet:  competenciaDate.Format("2006-01-02"),

			Emit: DPSEmit{
				CNPJ:    empresa.CNPJ,
				RegTrib: regTrib,
				XNome:   empresa.RazaoSocial,
				EnderNac: DPSEnderNac{
					CMun: empresa.MunicipioIBGE,
					CEP:  sanitizeCEP(req.Emit.CEP),
				},
				Email: empresa.Email,
				// IM omitted entirely when not filled — never send empty tag.
				IM: resolveIM(empresa),
			},

			Toma: buildDPSTomador(req.Tomador),

			Serv: DPSServico{
				LocPrest: DPSLocPrest{
					CMunIni: empresa.MunicipioIBGE,
					CMunFim: empresa.MunicipioIBGE,
				},
				CServ: DPSCServ{
					CNBS:      req.Servico.CodigoNBS, // keep dots: "01.01.01.10"
					XDescServ: req.Servico.Discriminacao,
				},
			},

			Valores: DPSValores{
				VServPrest: DPSVServPrest{
					VReceb: req.Servico.Valor,
				},
				Trib: DPSTrib{
					TribMun: DPSTribMun{
						TribISSQN: DPSTribISSQN{
							CLocIncid: empresa.MunicipioIBGE,
							PAliq:     aliquota,
							IndISSRet: indISSRet,
							VISSRet:   vISSRet,
						},
						CNatOp:     CNatOpMunicipio,
						IndIncFisc: IndIncFiscTributavel,
					},
				},
			},
		},
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

// resolveISSRetido determines whether ISS is withheld by the tomador.
//
//   - Simples Nacional: always false — prestador recolhe via DAS.
//   - Lucro Presumido: req.IssRetido must be explicitly set (nil → validation error).
//   - Tomador órgão público in LP always forces retention (Art. 6 LC 116/2003).
func resolveISSRetido(req EmissaoRequest, empresa *auth.Empresa) (bool, error) {
	switch empresa.RegimeTributario {
	case "SIMPLES_NACIONAL":
		// SN: ISS never withheld at source — prestador recolhe via DAS.
		return false, nil

	case "LUCRO_PRESUMIDO", "LUCRO_REAL":
		if req.IssRetido == nil {
			return false, &ErrValidation{
				Field:   "iss_retido",
				Message: "obrigatório para Lucro Presumido — informe se o ISS será retido pelo tomador",
			}
		}
		// Art. 6 LC 116/2003: tomador órgão público always retains.
		if req.Tomador.TipoOrgao == "ORGAO_PUBLICO" {
			return true, nil
		}
		return *req.IssRetido, nil

	default:
		return false, nil
	}
}

// resolveRegimeTributario maps empresa.RegimeTributario to DPS tax regime fields.
func resolveRegimeTributario(empresa *auth.Empresa) DPSRegimeTributario {
	switch empresa.RegimeTributario {
	case "SIMPLES_NACIONAL":
		return DPSRegimeTributario{
			OpSimpNac: OpSimpNacSim,
			CNAE:      empresa.CNAE,
			CRegTrib:  CRegTribSN,
		}
	case "LUCRO_PRESUMIDO", "LUCRO_REAL":
		return DPSRegimeTributario{
			OpSimpNac: OpSimpNacNao,
			CNAE:      empresa.CNAE,
			CRegTrib:  CRegTribNormal,
		}
	default:
		return DPSRegimeTributario{
			OpSimpNac: OpSimpNacSim,
			CNAE:      empresa.CNAE,
			CRegTrib:  CRegTribSN,
		}
	}
}

// resolveTpAmb returns 1 (produção) or 2 (homologação) based on the APP_ENV.
// The builder receives the empresa but uses the global app environment setting.
// In production builds this is always 1; in dev/staging always 2.
func resolveTpAmb(_ *auth.Empresa) int {
	// TODO: wire APP_ENV from config.Config when integrating into main.go.
	// For now default to 2 (homologação) for safety — override via WithTpAmb option.
	return 2
}

// resolveIM returns the Inscrição Municipal when set, empty string otherwise.
// The `xml:"IM,omitempty"` tag on DPSEmit ensures the tag is omitted when empty.
func resolveIM(empresa *auth.Empresa) string {
	if empresa.InscricaoMunicipal != nil {
		return *empresa.InscricaoMunicipal
	}
	return ""
}

// buildDPSTomador converts a TomadorRequest into a DPSTomador.
func buildDPSTomador(t TomadorRequest) DPSTomador {
	doc := strings.NewReplacer(".", "", "-", "", "/", "").Replace(t.Documento)
	tomador := DPSTomador{
		XNome: t.RazaoSocial,
		Email: t.Email,
	}
	if t.Tipo == "PF" || len(doc) == 11 {
		tomador.CPF = doc
	} else {
		tomador.CNPJ = doc
	}
	if t.MunicipioIBGE != "" {
		tomador.EnderNac = &DPSEnderNac{
			CMun: t.MunicipioIBGE,
			CEP:  sanitizeCEP(t.CEP),
		}
	}
	return tomador
}

// fusoManaus returns the *time.Location for UTC-4 (America/Manaus — no DST).
// The DPS dhEmi field must carry the explicit -04:00 offset.
func fusoManaus() *time.Location {
	loc, err := time.LoadLocation("America/Manaus")
	if err != nil {
		// Fallback: fixed -4h offset when timezone database is unavailable.
		return time.FixedZone("UTC-4", -4*60*60)
	}
	return loc
}

// sanitizeCEP strips non-digits from a CEP string.
func sanitizeCEP(cep string) string {
	return strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, cep)
}

// roundHalfUp rounds a float64 to 2 decimal places using "round half up" (banker's rounding).
// Formula: math.Round(v * 100) / 100
// Example: roundHalfUp(70.005) = 70.01; roundHalfUp(70.004) = 70.00
func roundHalfUp(v float64) float64 {
	return math.Round(v*100) / 100
}

// ErrValidation is a typed validation error returned by the DPS builder.
// The handler maps this to a 422 VALIDATION_ERROR response.
type ErrValidation struct {
	Field   string
	Message string
}

func (e *ErrValidation) Error() string {
	return fmt.Sprintf("validation error: %s — %s", e.Field, e.Message)
}
