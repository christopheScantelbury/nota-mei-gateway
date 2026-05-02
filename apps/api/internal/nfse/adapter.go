// Package nfse implements the HTTP mTLS adapter for the NFS-e Nacional API.
package nfse

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"time"
)

// backoffDelays defines the wait times between retry attempts: 1s, 4s, 16s.
var backoffDelays = []time.Duration{1 * time.Second, 4 * time.Second, 16 * time.Second}

// transientErr wraps 5xx HTTP responses — safe to retry.
type transientErr struct {
	code int
	body []byte
}

func (e transientErr) Error() string {
	return fmt.Sprintf("receita federal server error %d: %.200s", e.code, e.body)
}

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
// Retries up to 3 times on 5xx or network errors with exponential backoff (1s/4s/16s ±10%).
func (a *Adapter) Enviar(ctx context.Context, xmlBody []byte, cert *tls.Certificate) (*EnvioResponse, error) {
	var result *EnvioResponse
	err := withRetry(ctx, backoffDelays, func() error {
		resp, err := a.do(ctx, http.MethodPost, a.baseURL+"/envio", xmlBody, cert)
		if err != nil {
			return err // network/timeout — transient
		}
		defer func() { _ = resp.Body.Close() }()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		if resp.StatusCode >= 500 {
			return transientErr{code: resp.StatusCode, body: body}
		}
		if resp.StatusCode >= 400 {
			return fmt.Errorf("receita federal client error %d: %.200s", resp.StatusCode, body)
		}
		result, err = parseEnvioResponse(body)
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("envio: %w", err)
	}
	return result, nil
}

// Consultar queries the status of an RPS batch by protocol number.
// Retries up to 3 times on 5xx or network errors with exponential backoff (1s/4s/16s ±10%).
func (a *Adapter) Consultar(ctx context.Context, cnpj, protocolo string, cert *tls.Certificate) (*ConsultaResponse, error) {
	url := fmt.Sprintf("%s/consulta?cnpj=%s&protocolo=%s", a.baseURL, cnpj, protocolo)
	var result *ConsultaResponse
	err := withRetry(ctx, backoffDelays, func() error {
		resp, err := a.do(ctx, http.MethodGet, url, nil, cert)
		if err != nil {
			return err
		}
		defer func() { _ = resp.Body.Close() }()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		if resp.StatusCode >= 500 {
			return transientErr{code: resp.StatusCode, body: body}
		}
		if resp.StatusCode >= 400 {
			return fmt.Errorf("receita federal client error %d: %.200s", resp.StatusCode, body)
		}
		result, err = parseConsultaResponse(body)
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("consulta: %w", err)
	}
	return result, nil
}

// Cancelar sends a cancellation XML envelope to POST /cancelamento.
// Retries up to 3 times on 5xx or network errors with exponential backoff (1s/4s/16s ±10%).
func (a *Adapter) Cancelar(ctx context.Context, xmlBody []byte, cert *tls.Certificate) (*CancelamentoResponse, error) {
	var result *CancelamentoResponse
	err := withRetry(ctx, backoffDelays, func() error {
		resp, err := a.do(ctx, http.MethodPost, a.baseURL+"/cancelamento", xmlBody, cert)
		if err != nil {
			return err
		}
		defer func() { _ = resp.Body.Close() }()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		if resp.StatusCode >= 500 {
			return transientErr{code: resp.StatusCode, body: body}
		}
		if resp.StatusCode >= 400 {
			return fmt.Errorf("receita federal client error %d: %.200s", resp.StatusCode, body)
		}
		result, err = parseCancelamentoResponse(body)
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("cancelamento: %w", err)
	}
	return result, nil
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

// ─── Retry helpers ─────────────────────────────────────────────────────────

// withRetry calls fn up to len(delays)+1 times. Between attempts it sleeps for
// the next delay ±10% jitter. Only transient errors are retried; permanent
// errors (4xx, context cancellation) return immediately.
func withRetry(ctx context.Context, delays []time.Duration, fn func() error) error {
	var err error
	for attempt := 0; attempt <= len(delays); attempt++ {
		err = fn()
		if err == nil {
			return nil
		}
		if !isTransient(err) {
			return err
		}
		if attempt < len(delays) {
			d := delays[attempt]
			// ±10% jitter
			jitter := time.Duration(float64(d) * (0.9 + 0.2*rand.Float64()))
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(jitter):
			}
		}
	}
	return err
}

// isTransient returns true for errors that are safe to retry:
// network errors (timeout, connection refused) and 5xx HTTP responses.
func isTransient(err error) bool {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}
	var te transientErr
	if errors.As(err, &te) {
		return true
	}
	var netErr net.Error
	return errors.As(err, &netErr)
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
	XMLName              xml.Name             `xml:"GerarNfseResposta"`
	ListaNfse            *listaNfse           `xml:"ListaNfse"`
	ListaMensagemRetorno listaMensagemRetorno `xml:"ListaMensagemRetorno"`
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
			r.Erros = append(r.Erros, Erro(m))
		}
		return r, nil
	}

	// Fall back to synchronous format (GerarNfseResposta).
	var sync gerarNfseResposta
	if err := xml.Unmarshal(body, &sync); err != nil {
		return nil, fmt.Errorf("parse envio XML: %w (body: %.200s)", err, body)
	}

	for _, m := range sync.ListaMensagemRetorno.Mensagens {
		r.Erros = append(r.Erros, Erro(m))
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
		r.Erros = append(r.Erros, Erro(m))
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
		r.Erros = append(r.Erros, Erro(m))
	}
	return r, nil
}
