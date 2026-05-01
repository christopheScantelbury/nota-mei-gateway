// Package document builds and signs RPS (Recibo Provisório de Serviços) XML
// according to the NFS-e Nacional v1.2 / ABRASF schema.
package document

import "encoding/xml"

const abrasf = "http://www.abrasf.org.br/ABRASF/arquivos/nfse.xsd"

// GerarNfseEnvio is the root element sent to POST /nfse/servico/pr/envio.
type GerarNfseEnvio struct {
	XMLName xml.Name `xml:"GerarNfseEnvio"`
	XMLNS   string   `xml:"xmlns,attr"`
	Rps     RPSWrap  `xml:"Rps"`
}

// RPSWrap wraps the declaration.
type RPSWrap struct {
	Inf InfDeclaracaoPrestacaoServico `xml:"InfDeclaracaoPrestacaoServico"`
}

// InfDeclaracaoPrestacaoServico is the main body of the RPS.
type InfDeclaracaoPrestacaoServico struct {
	Rps                    RPSIdentificacao `xml:"Rps"`
	Competencia            string           `xml:"Competencia"`
	Servico                Servico          `xml:"Servico"`
	Prestador              Prestador        `xml:"Prestador"`
	Tomador                Tomador          `xml:"Tomador"`
	OptanteSimplesNacional string           `xml:"OptanteSimplesNacional"`
	IncentivoFiscal        string           `xml:"IncentivoFiscal"`
}

// RPSIdentificacao identifies the RPS document.
type RPSIdentificacao struct {
	IdentificacaoRps IdentificacaoRps `xml:"IdentificacaoRps"`
	DataEmissao      string           `xml:"DataEmissao"`
	Status           string           `xml:"Status"`
}

// IdentificacaoRps holds the RPS number, series and type.
type IdentificacaoRps struct {
	Numero string `xml:"Numero"`
	Serie  string `xml:"Serie"`
	Tipo   string `xml:"Tipo"`
}

// Servico describes the service being invoiced.
type Servico struct {
	Valores          Valores `xml:"Valores"`
	CodigoNbs        string  `xml:"CodigoNbs"`
	Discriminacao    string  `xml:"Discriminacao"`
	CodigoMunicipio  string  `xml:"CodigoMunicipio"`
	ExigibilidadeISS string  `xml:"ExigibilidadeISS"`
}

// Valores holds monetary values for the service.
type Valores struct {
	ValorServicos    string `xml:"ValorServicos"`
	ValorDeducoes    string `xml:"ValorDeducoes,omitempty"`
	AliquotaISS      string `xml:"AliquotaISS"`
	ValorIss         string `xml:"ValorIss,omitempty"`
	BaseCalculo      string `xml:"BaseCalculo,omitempty"`
	ValorLiquidoNfse string `xml:"ValorLiquidoNfse,omitempty"`
}

// Prestador identifies the MEI providing the service.
type Prestador struct {
	CpfCnpj            CpfCnpj `xml:"CpfCnpj"`
	InscricaoMunicipal string  `xml:"InscricaoMunicipal,omitempty"`
}

// Tomador identifies the service recipient.
type Tomador struct {
	IdentificacaoTomador IdentificacaoTomador `xml:"IdentificacaoTomador"`
	RazaoSocial          string               `xml:"RazaoSocial"`
	Endereco             *Endereco            `xml:"Endereco,omitempty"`
	Contato              *Contato             `xml:"Contato,omitempty"`
}

// IdentificacaoTomador holds the tomador's document (CPF or CNPJ).
type IdentificacaoTomador struct {
	CpfCnpj CpfCnpj `xml:"CpfCnpj"`
}

// CpfCnpj carries either a CPF or CNPJ; only one should be non-empty.
type CpfCnpj struct {
	Cpf  string `xml:"Cpf,omitempty"`
	Cnpj string `xml:"Cnpj,omitempty"`
}

// Endereco holds address information (optional for tomador).
type Endereco struct {
	Logradouro      string `xml:"Logradouro,omitempty"`
	Numero          string `xml:"Numero,omitempty"`
	Complemento     string `xml:"Complemento,omitempty"`
	Bairro          string `xml:"Bairro,omitempty"`
	CodigoMunicipio string `xml:"CodigoMunicipio,omitempty"`
	Uf              string `xml:"Uf,omitempty"`
	Cep             string `xml:"Cep,omitempty"`
}

// Contato holds optional contact info for the tomador.
type Contato struct {
	Email    string `xml:"Email,omitempty"`
	Telefone string `xml:"Telefone,omitempty"`
}

// CancelarNfseEnvio is the root element for cancellation requests.
type CancelarNfseEnvio struct {
	XMLName xml.Name           `xml:"CancelarNfseEnvio"`
	XMLNS   string             `xml:"xmlns,attr"`
	Pedido  PedidoCancelamento `xml:"Pedido"`
}

// PedidoCancelamento carries the cancellation details.
type PedidoCancelamento struct {
	InfPedidoCancelamento InfPedidoCancelamento `xml:"InfPedidoCancelamento"`
}

// InfPedidoCancelamento identifies the NFS-e to cancel.
type InfPedidoCancelamento struct {
	IdentificacaoNfse  IdentificacaoNfse `xml:"IdentificacaoNfse"`
	CodigoCancelamento string            `xml:"CodigoCancelamento"`
}

// IdentificacaoNfse holds the issued NFS-e number and prestador info.
type IdentificacaoNfse struct {
	Numero           string  `xml:"Numero"`
	CpfCnpjPrestador CpfCnpj `xml:"CpfCnpjPrestador"`
	CodigoMunicipio  string  `xml:"CodigoMunicipio"`
}
