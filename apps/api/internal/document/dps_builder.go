// Package document — DPS builder for NFS-e Nacional v1.01.
//
// Builds DPS XML envelopes against the official XSD bundle dated 2026-02-09
// (docs/nfse-schemas/Schemas/1.01/). The previous builder targeted an
// outdated draft and was rejected by Receita Federal with E1235.
//
// Endpoint:
//
//	POST https://sefin.nfse.gov.br/SefinNacional/nfse
//	Production-restricted (homologação):
//	  https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/nfse
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
//
//	"LUCRO_PRESUMIDO" | "LUCRO_REAL".
//
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
	// ME/EPP do Simples com ISS fora do DAS (retido pelo tomador ou
	// regApTribSN 2/3): a alíquota vai na DPS e tem que ser a do município —
	// não dá para chutar o padrão (#279).
	if aliquota <= 0 && empresa.RegimeTributario == "SIMPLES_NACIONAL" &&
		(issRetido || regApTribSNEmpresa(empresa) != RegApTribSNTudoPeloSN) {
		return nil, &ErrValidation{
			Field:   "servico.aliquota_iss",
			Message: "obrigatória quando o ISS é retido pelo tomador ou apurado fora do Simples — informe a alíquota do município (ex.: 2.0)",
		}
	}
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

	tomador := buildDPSTomador(req.Tomador)

	// Grupo IBS/CBS (#296) — só quando há classificação, na nota ou no padrão
	// da empresa. Os chamadores já validaram com ValidateIBSCBS antes de
	// alocar o número da DPS; aqui é a última barreira.
	ibscbs, err := buildIBSCBS(req.Servico.IBSCBS, empresa)
	if err != nil {
		return nil, err
	}

	// Substituição (opcional) — quando este DPS substitui uma nota já autorizada.
	var subst *Substituicao
	if req.Subst != nil {
		chave := stripNonDigits(req.Subst.ChaveSubstituida)
		if len(chave) != 50 {
			return nil, &ErrValidation{
				Field:   "subst.chave_substituida",
				Message: "chave da NFS-e substituída deve ter 50 dígitos",
			}
		}
		subst = &Substituicao{
			ChSubstda: chave,
			CMotivo:   req.Subst.CodigoMotivo,
			XMotivo:   strings.TrimSpace(req.Subst.DescricaoMotivo),
		}
	}

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
		Subst:    subst,

		Prest: InfoPrestador{
			CNPJ: empresa.CNPJ,
			IM:   derefStr(empresa.InscricaoMunicipal),
			// xNome and email are omitted when tpEmit=1 (próprio prestador
			// emite a DPS) — Receita rejeita com E0121 porque o dado já está
			// no cadastro associado ao CNPJ + cert.
			RegTrib: RegimeTrib{
				OpSimpNac:   opSimpNac,
				RegApTribSN: regApTribSNFor(opSimpNac, regApTribSNEmpresa(empresa)),
				RegEspTrib:  regEspTrib,
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
					// MEI (E0600) e ME/EPP com ISS pelo SN sem retenção (E0625)
					// não informam pAliq — zero faz o omitempty omitir a tag.
					PAliq: pAliqFor(opSimpNac, regApTribSNEmpresa(empresa), tpRetISSQN, aliquota),
				},
				TotTrib: buildTotTrib(opSimpNac),
			},
		},

		IBSCBS: ibscbs,
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

// regApTribSNEmpresa devolve o regime de apuração do SN configurado na empresa
// (#279): 1, 2 ou 3; qualquer outro valor (inclusive não configurado) vira 1.
func regApTribSNEmpresa(empresa *auth.Empresa) int {
	if empresa != nil {
		switch empresa.RegApTribSN {
		case RegApTribSNTudoPeloSN, RegApTribSNISSQNForaDoSN, RegApTribSNTudoForaDoSN:
			return empresa.RegApTribSN
		}
	}
	return RegApTribSNTudoPeloSN
}

// regApTribSNFor devolve o regime de apuração do SN exigido para ME/EPP
// optante (opSimpNac=3). Sem ele a SEFIN rejeita com E0166. Vem da empresa
// (#279): 1 = tudo pelo SN (quem não estourou sublimite), 2/3 = acima do
// sublimite. MEI e não optante não informam o campo (nil → omitido).
func regApTribSNFor(opSimpNac, regApTribSN int) *int {
	if opSimpNac != OpSimpNacMEEPP {
		return nil
	}
	v := regApTribSN
	if v < RegApTribSNTudoPeloSN || v > RegApTribSNTudoForaDoSN {
		v = RegApTribSNTudoPeloSN
	}
	return &v
}

// resolveISSRetido determines whether ISS is withheld at source.
//   - MEI: nunca retido (ISS fixo no DAS).
//   - ME/EPP do Simples: retido só quando o pedido diz (iss_retido=true) —
//     tomador PJ/órgão público pode reter (#279). Padrão: não retido.
//   - Lucro Presumido / Real: req.IssRetido must be informed.
//   - Tomador órgão público em LP/LR: força retenção (Art. 6 LC 116/2003).
func resolveISSRetido(req EmissaoRequest, empresa *auth.Empresa) (bool, error) {
	switch empresa.RegimeTributario {
	case "SIMPLES_MEI":
		return false, nil
	case "SIMPLES_NACIONAL":
		return req.IssRetido != nil && *req.IssRetido, nil
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
	// <end> só com endereço completo — o handler já validou os obrigatórios
	// (validateEmissaoRequest); cMun/CEP soltos sem logradouro violam o XSD.
	if e := t.ResolvedEndereco(); e != nil {
		p.End = &DPSEndereco{
			EndNac:  &EnderNac{CMun: e.MunicipioIBGE, CEP: e.CEP},
			XLgr:    e.Logradouro,
			Nro:     e.Numero,
			XCpl:    e.Complemento,
			XBairro: e.Bairro,
		}
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

// ── IBS/CBS (#296) ────────────────────────────────────────────────────────────

// Campos de erro da classificação de IBS/CBS. Erro de quem chama a API aponta
// o campo do request; erro do cadastro aponta "empresa.ibs_cbs" — nunca o
// nome da coluna do banco.
const (
	campoIBSCBSRequest = "servico.ibs_cbs"
	campoIBSCBSEmpresa = "empresa.ibs_cbs"
)

// ErrConfigEmpresa sinaliza que o cadastro da empresa impede a emissão — não
// é um erro do pedido. O handler responde 422 com um código próprio para o
// integrador não procurar o problema no corpo que enviou.
type ErrConfigEmpresa struct {
	Field   string
	Message string
}

func (e *ErrConfigEmpresa) Error() string { return e.Field + ": " + e.Message }

// ValidateIBSCBS confere a classificação de IBS/CBS que a nota vai levar
// (request campo a campo sobre o padrão da empresa) sem montar a DPS. Chamar
// ANTES de consumir cota e de alocar o número da DPS: classificação inválida
// não pode queimar número nem contar no limite do plano.
//
// Devolve *ErrValidation quando o problema está no request e
// *ErrConfigEmpresa quando está no padrão cadastrado na empresa.
func ValidateIBSCBS(req EmissaoRequest, empresa *auth.Empresa) error {
	if empresa == nil {
		return fmt.Errorf("empresa is nil")
	}
	_, err := buildIBSCBS(req.Servico.IBSCBS, empresa)
	return err
}

// buildIBSCBS monta o grupo <IBSCBS> da DPS (TCRTCInfoIBSCBS).
//
// Precedência, campo a campo: o que veio em servico.ibs_cbs, senão o padrão
// da empresa. Depois da fusão:
//
//   - Nenhum dos três códigos → nil: o grupo é omitido e a DPS sai como
//     sempre saiu. O envio depende de haver classificação, não do regime
//     tributário: não está confirmado em fonte oficial quem do Simples/MEI é
//     obrigado.
//   - CST, cClassTrib e cIndOp informados e no padrão do XSD → grupo mínimo
//     válido no leiaute v1.01: finNFSe=0, [indFinal], cIndOp, indDest=0 e
//     valores/trib/gIBSCBS com CST e cClassTrib.
//   - Parcial ou fora do padrão → erro. Enviar assim renderia E1235 (falha de
//     esquema) na Sefin; omitir o grupo em silêncio deixaria a empresa
//     achando que está declarando IBS/CBS.
//
// O emissor NÃO calcula IBS nem CBS: nenhum valor ou alíquota vai aqui. A
// Sefin Nacional calcula na autorização e devolve no grupo IBSCBS da NFS-e.
//
// regApIBSCBSSN e cAtvSN (Simples Nacional, NT SE/CGNFS-e nº 009, leiaute
// V1.04.01) não existem no XSD v1.01 e por isso NÃO são enviados — nem lidos
// aqui. Ficam só no cadastro da empresa até o XSD novo entrar no repositório.
func buildIBSCBS(nota *IBSCBSRequest, empresa *auth.Empresa) (*InfoIBSCBS, error) {
	if nota == nil {
		nota = &IBSCBSRequest{}
	}
	campos := []struct {
		json, nome        string // campo do request e nome no leiaute
		daNota, daEmpresa string
		digitos           int
	}{
		{"cst", "CST", nota.CST, empresa.IBSCBSCST, 3},
		{"codigo_classificacao_tributaria", "cClassTrib", nota.CodigoClassificacaoTributaria, empresa.IBSCBSCClassTrib, 6},
		{"codigo_indicador_operacao", "cIndOp", nota.CodigoIndicadorOperacao, empresa.IBSCBSCIndOp, 6},
	}

	valores := make([]string, len(campos))
	algumDaNota, algum := false, false
	for i, c := range campos {
		v := strings.TrimSpace(c.daNota)
		if v != "" {
			algumDaNota = true
			if !soDigitos(v, c.digitos) {
				return nil, &ErrValidation{
					Field:   campoIBSCBSRequest + "." + c.json,
					Message: fmt.Sprintf("%s deve ter exatamente %d dígitos", c.nome, c.digitos),
				}
			}
		} else if v = strings.TrimSpace(c.daEmpresa); v != "" && !soDigitos(v, c.digitos) {
			return nil, &ErrConfigEmpresa{
				Field: campoIBSCBSEmpresa,
				Message: fmt.Sprintf(
					"a classificação padrão de IBS/CBS cadastrada na empresa está inválida: %s deve ter exatamente %d dígitos — corrija o cadastro da empresa antes de emitir",
					c.nome, c.digitos),
			}
		}
		valores[i] = v
		algum = algum || v != ""
	}

	if !algum {
		// indFinal só existe dentro do grupo: sem classificação não há onde
		// declarar o consumo pessoal, e ignorar o campo em silêncio esconderia
		// isso de quem enviou.
		if nota.ConsumoPessoal != nil {
			return nil, &ErrValidation{
				Field:   campoIBSCBSRequest + ".consumo_pessoal",
				Message: "só pode ser informado junto da classificação de IBS/CBS — envie cst, codigo_classificacao_tributaria e codigo_indicador_operacao, ou cadastre o padrão na empresa",
			}
		}
		return nil, nil
	}

	for i, c := range campos {
		if valores[i] != "" {
			continue
		}
		// Falta um código. Se a nota trouxe algum, é ela que está incompleta
		// (a empresa não tem padrão para completar); senão é o cadastro.
		if algumDaNota {
			return nil, &ErrValidation{
				Field:   campoIBSCBSRequest + "." + c.json,
				Message: fmt.Sprintf("obrigatório: %s não foi informado e a empresa não tem padrão cadastrado — CST, cClassTrib e cIndOp vão sempre juntos", c.nome),
			}
		}
		return nil, &ErrConfigEmpresa{
			Field: campoIBSCBSEmpresa,
			Message: fmt.Sprintf(
				"a classificação padrão de IBS/CBS cadastrada na empresa está incompleta: falta %s — CST, cClassTrib e cIndOp vão sempre juntos; complete o cadastro da empresa antes de emitir",
				c.nome),
		}
	}

	grupo := &InfoIBSCBS{
		FinNFSe: FinNFSeRegular,
		CIndOp:  valores[2],
		// Destinatário = tomador identificado na nota. Destinatário diferente
		// (indDest=1 + <dest>) depende de campo novo na API pública.
		//
		// A VALIDAR em produção restrita (#296): DPS sem <toma> — só acontece
		// em recorrência gravada sem tomador — também sai com indDest=0. A
		// regra da Sefin para "destinatário é o tomador" sem tomador
		// identificado não foi confirmada; o comportamento fica como está até
		// haver resposta da Sefin.
		IndDest: IndDestProprioTomador,
		Valores: InfoValoresIBSCBS{
			Trib: InfoTributosIBSCBS{
				GIBSCBS: InfoTributosSitClas{
					CST:        valores[0],
					CClassTrib: valores[1],
				},
			},
		},
	}
	if nota.ConsumoPessoal != nil {
		grupo.IndFinal = IndFinalNao
		if *nota.ConsumoPessoal {
			grupo.IndFinal = IndFinalSim
		}
	}
	return grupo, nil
}

// soDigitos diz se s tem exatamente n caracteres, todos dígitos ASCII.
func soDigitos(s string, n int) bool {
	return len(s) == n && stripNonDigits(s) == s
}

// roundHalfUp rounds a value to 2 decimals using HALF_UP (banker's rounding
// would underreport ISS on .005 boundaries — Receita expects HALF_UP).
func roundHalfUp(v float64) float64 {
	return math.Floor(v*100+0.5) / 100
}

// IDDPS devolve o Id (TSIdDPS) da DPS emitida pelo NotaFácil para o município,
// CNPJ e número informados — o mesmo valor que Build grava em infDPS/@Id.
// Usado para consultar a DPS na SEFIN (GET /dps/{id}) quando o XML enviado
// não está no banco.
func IDDPS(cMun, cnpj string, nDPS int64) string {
	return buildInfDPSId(cMun, cnpj, DPSSerie, nDPS)
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

// pAliqFor devolve a alíquota do ISS a informar na DPS, ou 0 quando a SEFIN
// proíbe o campo (o omitempty então omite <pAliq>):
//   - MEI (opSimpNac=2): alíquota fixa via DAS — E0600.
//   - ME/EPP do SN (opSimpNac=3) com ISS apurado pelo SN (regApTribSN=1) e
//     sem retenção (tpRetISSQN=1) — E0625. Com retenção a alíquota é exigida.
func pAliqFor(opSimpNac, regApTribSN, tpRetISSQN int, aliquota float64) float64 {
	switch opSimpNac {
	case OpSimpNacMEI:
		return 0
	case OpSimpNacMEEPP:
		if r := regApTribSNFor(opSimpNac, regApTribSN); r != nil && *r == RegApTribSNTudoPeloSN && tpRetISSQN == TpRetISSQNNaoRetido {
			return 0
		}
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
