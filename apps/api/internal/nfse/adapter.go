// Package nfse implements the HTTP mTLS adapter for the NFS-e Nacional API.
package nfse

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Adapter is the HTTP mTLS client for the Receita Federal NFS-e Nacional API.
type Adapter struct {
	baseURL string
}

// NewAdapter returns an Adapter pointing at the given base URL
// (e.g. https://www.nfse.gov.br/m/app/api/recepcionar-lote-rps/v1).
func NewAdapter(baseURL string) *Adapter {
	return &Adapter{baseURL: baseURL}
}

// Enviar sends an RPS XML envelope to POST /envio and parses the response.
// cert is the MEI's A1 TLS certificate used for mutual TLS authentication.
func (a *Adapter) Enviar(ctx context.Context, xmlBody []byte, cert *tls.Certificate) (*EnvioResponse, error) {
	resp, err := a.do(ctx, http.MethodPost, a.baseURL+"/envio", xmlBody, cert)
	if err != nil {
		return nil, fmt.Errorf("envio request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read envio response: %w", err)
	}

	if resp.StatusCode >= 500 {
		return nil, fmt.Errorf("receita federal server error %d: %s", resp.StatusCode, body)
	}

	return parseEnvioResponse(body)
}

// Consultar queries the status of an RPS batch by protocol number.
// Calls GET /consulta?cnpj=&protocolo=&ambiente=.
func (a *Adapter) Consultar(ctx context.Context, cnpj, protocolo string, cert *tls.Certificate) (*ConsultaResponse, error) {
	url := fmt.Sprintf("%s/consulta?cnpj=%s&protocolo=%s", a.baseURL, cnpj, protocolo)
	resp, err := a.do(ctx, http.MethodGet, url, nil, cert)
	if err != nil {
		return nil, fmt.Errorf("consulta request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read consulta response: %w", err)
	}

	if resp.StatusCode >= 500 {
		return nil, fmt.Errorf("receita federal server error %d: %s", resp.StatusCode, body)
	}

	return parseConsultaResponse(body)
}

// Cancelar sends a cancellation XML envelope to POST /cancelamento.
func (a *Adapter) Cancelar(ctx context.Context, xmlBody []byte, cert *tls.Certificate) (*CancelamentoResponse, error) {
	resp, err := a.do(ctx, http.MethodPost, a.baseURL+"/cancelamento", xmlBody, cert)
	if err != nil {
		return nil, fmt.Errorf("cancelamento request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read cancelamento response: %w", err)
	}

	if resp.StatusCode >= 500 {
		return nil, fmt.Errorf("receita federal server error %d: %s", resp.StatusCode, body)
	}

	return parseCancelamentoResponse(body)
}

// do executes an HTTP request with mTLS using the provided certificate.
func (a *Adapter) do(ctx context.Context, method, url string, body []byte, cert *tls.Certificate) (*http.Response, error) {
	tlsCfg := &tls.Config{
		Certificates: []tls.Certificate{*cert},
		MinVersion:   tls.VersionTLS12,
	}
	transport := &http.Transport{
		TLSClientConfig: tlsCfg,
	}
	client := &http.Client{
		Transport: transport,
		Timeout:   30 * time.Second,
	}

	var bodyReader io.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/xml; charset=utf-8")
	}
	req.Header.Set("Accept", "application/xml")

	return client.Do(req)
}

// ─── XML response types ────────────────────────────────────────────────────

// rececionarLoteRpsResposta is returned by POST /recepcionar-lote-rps (async batch).
type rececionarLoteRpsResposta struct {
	XMLName              xml.Name             `xml:"RececionarLoteRpsResposta"`
	Protocolo            string               `xml:"Protocolo"`
	ListaMensagemRetorno listaMensagemRetorno `xml:"ListaMensagemRetorno"`
}

// gerarNfseResposta is returned by synchronous single-RPS endpoints.
type gerarNfseResposta struct {
	XMLName               xml.Name              `xml:"GerarNfseResposta"`
	ListaNfse             *listaNfse            `xml:"ListaNfse"`
	ListaMensagemRetorno  listaMensagemRetorno  `xml:"ListaMensagemRetorno"`
}

type listaNfse struct {
	CompNfse []compNfse `xml:"CompNfse"`
}

type compNfse struct {
	Nfse nfseXML `xml:"Nfse"`
}

type nfseXML struct {
	InfNfse infNfse `xml:"InfNfse"`
}

type infNfse struct {
	Numero            string `xml:"Numero"`
	CodigoVerificacao string `xml:"CodigoVerificacao"`
}

type listaMensagemRetorno struct {
	Mensagens []mensagemRetorno `xml:"MensagemRetorno"`
}

type mensagemRetorno struct {
	Codigo    string `xml:"Codigo"`
	Descricao string `xml:"Descricao"`
}

type consultarLoteRpsResposta struct {
	XMLName              xml.Name             `xml:"ConsultarLoteRpsResposta"`
	Protocolo            string               `xml:"Protocolo"`
	Situacao             string               `xml:"Situacao"`
	ListaNfse            *listaNfse           `xml:"ListaNfse"`
	ListaMensagemRetorno listaMensagemRetorno `xml:"ListaMensagemRetorno"`
}

type cancelarNfseResposta struct {
	XMLName              xml.Name             `xml:"CancelarNfseResposta"`
	Sucesso              string               `xml:"Sucesso"`
	ListaMensagemRetorno listaMensagemRetorno `xml:"ListaMensagemRetorno"`
}

// ─── Response parsers ──────────────────────────────────────────────────────

func parseEnvioResponse(body []byte) (*EnvioResponse, error) {
	r := &EnvioResponse{}

	// Try async batch format first (RececionarLoteRpsResposta).
	var batch rececionarLoteRpsResposta
	if err := xml.Unmarshal(body, &batch); err == nil && batch.Protocolo != "" {
		r.Protocolo = batch.Protocolo
		for _, m := range batch.ListaMensagemRetorno.Mensagens {
			r.Erros = append(r.Erros, Erro{Codigo: m.Codigo, Descricao: m.Descricao})
		}
		return r, nil
	}

	// Fall back to synchronous format (GerarNfseResposta).
	var sync gerarNfseResposta
	if err := xml.Unmarshal(body, &sync); err != nil {
		return nil, fmt.Errorf("parse envio XML: %w (body: %.200s)", err, body)
	}

	for _, m := range sync.ListaMensagemRetorno.Mensagens {
		r.Erros = append(r.Erros, Erro{Codigo: m.Codigo, Descricao: m.Descricao})
	}
	if sync.ListaNfse != nil && len(sync.ListaNfse.CompNfse) > 0 {
		inf := sync.ListaNfse.CompNfse[0].Nfse.InfNfse
		r.NumeroNFSe = inf.Numero
		r.CodVerificacao = inf.CodigoVerificacao
	}

	return r, nil
}

func parseConsultaResponse(body []byte) (*ConsultaResponse, error) {
	var raw consultarLoteRpsResposta
	if err := xml.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("parse consulta XML: %w (body: %.200s)", err, body)
	}

	r := &ConsultaResponse{}

	// Situacao: 1=não recebido, 2=aguardando, 3=erro, 4=sucesso
	switch raw.Situacao {
	case "4":
		r.Status = "AUTORIZADA"
	case "3":
		r.Status = "REJEITADA"
	default:
		r.Status = "PROCESSANDO"
	}

	for _, m := range raw.ListaMensagemRetorno.Mensagens {
		r.Erros = append(r.Erros, Erro{Codigo: m.Codigo, Descricao: m.Descricao})
	}

	if raw.ListaNfse != nil && len(raw.ListaNfse.CompNfse) > 0 {
		inf := raw.ListaNfse.CompNfse[0].Nfse.InfNfse
		r.NumeroNFSe = inf.Numero
		r.CodVerificacao = inf.CodigoVerificacao
	}

	return r, nil
}

func parseCancelamentoResponse(body []byte) (*CancelamentoResponse, error) {
	var raw cancelarNfseResposta
	if err := xml.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("parse cancelamento XML: %w (body: %.200s)", err, body)
	}

	r := &CancelamentoResponse{OK: raw.Sucesso == "true"}
	for _, m := range raw.ListaMensagemRetorno.Mensagens {
		r.Erros = append(r.Erros, Erro{Codigo: m.Codigo, Descricao: m.Descricao})
	}
	return r, nil
}
