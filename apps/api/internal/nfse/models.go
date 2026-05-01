// Package nfse implements the HTTP mTLS adapter for the NFS-e Nacional API.
package nfse

// EnvioResponse is the parsed response from POST /nfse/servico/pr/envio.
type EnvioResponse struct {
	Protocolo    string
	NumeroNFSe   string
	CodVerificacao string
	Erros        []Erro
}

// ConsultaResponse is the parsed response from GET /nfse/servico/pr/consulta.
type ConsultaResponse struct {
	Status         string // PROCESSANDO | AUTORIZADA | REJEITADA
	NumeroNFSe     string
	CodVerificacao string
	XMLRetorno     string
	Erros          []Erro
}

// CancelamentoResponse is the parsed response from POST /nfse/servico/pr/cancelamento.
type CancelamentoResponse struct {
	OK    bool
	Erros []Erro
}

// Erro represents a rejection code from the Receita Federal.
type Erro struct {
	Codigo    string
	Descricao string
}
