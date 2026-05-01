package document

import (
	"encoding/xml"
	"fmt"
	"strings"
	"time"
)

// Builder assembles RPS XML envelopes for NFS-e emission and cancellation.
type Builder struct{}

// EmissaoRequest is the API-level request to emit an NFS-e.
type EmissaoRequest struct {
	Servico     ServicoRequest `json:"servico"`
	Tomador     TomadorRequest `json:"tomador"`
	Competencia string         `json:"competencia"` // YYYY-MM
	WebhookURL  string         `json:"webhook_url,omitempty"`
}

// ServicoRequest holds the service details from the JSON request.
type ServicoRequest struct {
	CodigoNBS     string  `json:"codigo_nbs"`
	Discriminacao string  `json:"discriminacao"`
	Valor         float64 `json:"valor"`
	AliquotaISS   float64 `json:"aliquota_iss"` // percentage e.g. 2.0 = 2%
}

// TomadorRequest holds the service recipient details.
type TomadorRequest struct {
	Tipo          string `json:"tipo"`      // PF | PJ
	Documento     string `json:"documento"` // CPF or CNPJ digits only
	RazaoSocial   string `json:"razao_social"`
	Email         string `json:"email,omitempty"`
	MunicipioIBGE string `json:"municipio_ibge,omitempty"`
}

// NewBuilder creates a document Builder.
func NewBuilder() *Builder { return &Builder{} }

// Build constructs the RPS XML envelope from the emission request.
// cnpj is the MEI's CNPJ (digits only); municipio is the IBGE code.
// numeroRPS must be unique and monotonically increasing per MEI.
func (b *Builder) Build(req EmissaoRequest, cnpj, municipio string, numeroRPS int64) ([]byte, error) {
	competenciaDate, err := parseCompetencia(req.Competencia)
	if err != nil {
		return nil, fmt.Errorf("competencia inválida: %w", err)
	}

	aliquota := req.Servico.AliquotaISS / 100
	valorISS := req.Servico.Valor * aliquota
	codigoNBS := strings.ReplaceAll(req.Servico.CodigoNBS, ".", "")

	doc := GerarNfseEnvio{
		XMLNS: abrasf,
		Rps: RPSWrap{
			Inf: InfDeclaracaoPrestacaoServico{
				Rps: RPSIdentificacao{
					IdentificacaoRps: IdentificacaoRps{
						Numero: fmt.Sprintf("%d", numeroRPS),
						Serie:  "1",
						Tipo:   "1",
					},
					DataEmissao: time.Now().UTC().Format("2006-01-02T15:04:05"),
					Status:      "1",
				},
				Competencia: competenciaDate.Format("2006-01-02"),
				Servico: Servico{
					Valores: Valores{
						ValorServicos:    fmt2dec(req.Servico.Valor),
						AliquotaISS:      fmt2dec(aliquota),
						ValorIss:         fmt2dec(valorISS),
						BaseCalculo:      fmt2dec(req.Servico.Valor),
						ValorLiquidoNfse: fmt2dec(req.Servico.Valor - valorISS),
					},
					CodigoNbs:        codigoNBS,
					Discriminacao:    req.Servico.Discriminacao,
					CodigoMunicipio:  municipio,
					ExigibilidadeISS: "1",
				},
				Prestador: Prestador{
					CpfCnpj: CpfCnpj{Cnpj: cnpj},
				},
				Tomador:                buildTomador(req.Tomador),
				OptanteSimplesNacional: "1", // MEI is always Simples Nacional
				IncentivoFiscal:        "2",
			},
		},
	}

	out, err := xml.MarshalIndent(doc, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal RPS: %w", err)
	}
	return append([]byte(xml.Header), out...), nil
}

// BuildCancelamento builds the XML envelope to cancel an issued NFS-e.
func (b *Builder) BuildCancelamento(numeroNfse, cnpj, municipio string) ([]byte, error) {
	doc := CancelarNfseEnvio{
		XMLNS: abrasf,
		Pedido: PedidoCancelamento{
			InfPedidoCancelamento: InfPedidoCancelamento{
				IdentificacaoNfse: IdentificacaoNfse{
					Numero:           numeroNfse,
					CpfCnpjPrestador: CpfCnpj{Cnpj: cnpj},
					CodigoMunicipio:  municipio,
				},
				CodigoCancelamento: "1",
			},
		},
	}
	out, err := xml.MarshalIndent(doc, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal cancelamento: %w", err)
	}
	return append([]byte(xml.Header), out...), nil
}

func buildTomador(t TomadorRequest) Tomador {
	doc := strings.NewReplacer(".", "", "-", "", "/", "").Replace(t.Documento)
	cpfCnpj := CpfCnpj{}
	if t.Tipo == "PF" || len(doc) == 11 {
		cpfCnpj.Cpf = doc
	} else {
		cpfCnpj.Cnpj = doc
	}
	tomador := Tomador{
		IdentificacaoTomador: IdentificacaoTomador{CpfCnpj: cpfCnpj},
		RazaoSocial:          t.RazaoSocial,
	}
	if t.Email != "" {
		tomador.Contato = &Contato{Email: t.Email}
	}
	return tomador
}

func parseCompetencia(s string) (time.Time, error) {
	return time.Parse("2006-01", s)
}

func fmt2dec(v float64) string {
	return fmt.Sprintf("%.2f", v)
}
