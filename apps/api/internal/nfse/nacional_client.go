package nfse

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"time"
)

// NFS-e Nacional (SEFIN) wire format.
//
// Reverse-engineered from the live OpenAPI spec at
// https://sefin.nfse.gov.br/SefinNacional//swagger/docs/v1 (2026-05-21).
//
// The previous adapter targeted https://www.nfse.gov.br/m/app/api/recepcionar-lote-rps/v1/envio
// which returns 404 — that endpoint never existed under that path in production.
// The correct call is:
//
//	POST https://sefin.nfse.gov.br/SefinNacional/nfse
//	Content-Type: application/json
//	mTLS with ICP-Brasil A1 client cert
//	Body: {"dpsXmlGZipB64": "<base64( gzip( signed DPS XML ) )>"}
//
// Response 201: {"chaveAcesso": "...", "idDps": "...", "nfseXmlGZipB64": "...",
//   "tipoAmbiente": 1|2, "dataHoraProcessamento": "...", "alertas": [...] }
//
// Response 400/403/500: {"erros": [{"codigo": "...", "descricao": "..."}, ...]}

// nfsePostRequest is the JSON body envelope expected by POST /SefinNacional/nfse.
type nfsePostRequest struct {
	DPSXMLGZipB64 string `json:"dpsXmlGZipB64"`
}

// MensagemProcessamento mirrors the schema's MensagemProcessamento — used for
// both `alertas` (success path) and `erros` (failure path).
type MensagemProcessamento struct {
	Codigo      string `json:"codigo"`
	Descricao   string `json:"descricao"`
	Complemento string `json:"complemento,omitempty"`
}

// NFSeNacionalSuccess is the 201 Created response body.
type NFSeNacionalSuccess struct {
	TipoAmbiente          int                     `json:"tipoAmbiente"`
	VersaoAplicativo      string                  `json:"versaoAplicativo"`
	DataHoraProcessamento string                  `json:"dataHoraProcessamento"`
	IDDps                 string                  `json:"idDps"`
	ChaveAcesso           string                  `json:"chaveAcesso"`
	NFSeXMLGZipB64        string                  `json:"nfseXmlGZipB64"`
	Alertas               []MensagemProcessamento `json:"alertas,omitempty"`
}

// NFSeNacionalError is the 4xx/5xx response body.
//
// Receita uses both "erros" (plural — DPS POST /nfse) and "erro" (singular —
// evento POST /nfse/{ca}/eventos) in different endpoints. We accept both and
// expose them via Errors().
type NFSeNacionalError struct {
	TipoAmbiente          int                     `json:"tipoAmbiente"`
	VersaoAplicativo      string                  `json:"versaoAplicativo"`
	DataHoraProcessamento string                  `json:"dataHoraProcessamento"`
	IDDps                 string                  `json:"idDPS"`
	Erros                 []MensagemProcessamento `json:"erros"`
	Erro                  []MensagemProcessamento `json:"erro"`
	// Tentativa do POST em que a rejeição veio (1 = primeira). Rejeição depois
	// de um reenvio pode ser a própria DPS já processada (#278).
	Tentativa int `json:"-"`
}

// Errors returns the combined list from `erros` + `erro`.
func (e *NFSeNacionalError) Errors() []MensagemProcessamento {
	if e == nil {
		return nil
	}
	out := make([]MensagemProcessamento, 0, len(e.Erros)+len(e.Erro))
	out = append(out, e.Erros...)
	out = append(out, e.Erro...)
	return out
}

// FirstError returns the first error codigo:descricao (with complemento
// appended when present) or empty strings.
func (e *NFSeNacionalError) FirstError() (codigo, descricao string) {
	msgs := e.Errors()
	if len(msgs) == 0 {
		return "", ""
	}
	codigo = msgs[0].Codigo
	descricao = msgs[0].Descricao
	if msgs[0].Complemento != "" {
		descricao += " — " + msgs[0].Complemento
	}
	return codigo, descricao
}

// EnviarNFSeNacional submits a signed DPS XML to the production NFS-e Nacional
// endpoint and waits for the synchronous response. Used by both the MEI and the
// ME/EPP emission paths after migration 2026-05-21.
//
// The XML body is gzip-compressed and base64-encoded, then wrapped in the
// {"dpsXmlGZipB64": ...} JSON envelope expected by /SefinNacional/nfse.
//
// On a 2xx response the parsed NFSeNacionalSuccess is returned (caller can then
// gunzip+decode nfseXmlGZipB64 to obtain the authorised NFS-e XML). On a 4xx
// the returned error wraps a *NFSeNacionalError so callers can extract the
// codigo/descricao for the response payload. 5xx and network errors are
// retried with the same backoff schedule as the legacy adapter.
func (a *Adapter) EnviarNFSeNacional(
	ctx context.Context,
	signedDPSXML []byte,
	cert *tls.Certificate,
) (*NFSeNacionalSuccess, *NFSeNacionalError, error) {
	gz, err := gzipBytes(signedDPSXML)
	if err != nil {
		return nil, nil, fmt.Errorf("gzip dps: %w", err)
	}
	bodyJSON, err := json.Marshal(nfsePostRequest{
		DPSXMLGZipB64: base64.StdEncoding.EncodeToString(gz),
	})
	if err != nil {
		return nil, nil, fmt.Errorf("marshal request: %w", err)
	}

	url := a.baseURL + "/nfse"

	var (
		success   *NFSeNacionalSuccess
		failure   *NFSeNacionalError
		tentativa int
	)
	err = withRetry(ctx, backoffDelays, func() error {
		tentativa++
		resp, doErr := a.doJSON(ctx, http.MethodPost, url, bodyJSON, cert)
		if doErr != nil {
			return doErr
		}
		defer func() { _ = resp.Body.Close() }()

		body, readErr := io.ReadAll(io.LimitReader(resp.Body, 4*1024*1024))
		if readErr != nil {
			return readErr
		}

		switch {
		case resp.StatusCode >= 500:
			return transientErr{code: resp.StatusCode, body: body}
		case resp.StatusCode == http.StatusCreated || resp.StatusCode == http.StatusOK:
			s := &NFSeNacionalSuccess{}
			if err := json.Unmarshal(body, s); err != nil {
				return fmt.Errorf("parse success: %w (body=%.200s)", err, body)
			}
			success = s
			return nil
		case resp.StatusCode >= 400:
			f := &NFSeNacionalError{}
			// Some 4xx (auth) return text/HTML — capture verbatim.
			if jsonErr := json.Unmarshal(body, f); jsonErr != nil || len(f.Errors()) == 0 {
				return fmt.Errorf("sefin client error %d: %.500s", resp.StatusCode, body)
			}
			f.Tentativa = tentativa
			failure = f
			return nil // not retryable
		default:
			return fmt.Errorf("sefin unexpected status %d: %.200s", resp.StatusCode, body)
		}
	})
	if err != nil {
		return nil, failure, fmt.Errorf("envio nfse-nacional: %w", err)
	}
	if failure != nil && dpsPodeTerSidoProcessada(failure) {
		// #278: a resposta de uma tentativa anterior se perdeu e a Receita já
		// gerou a NFS-e desta DPS — não é rejeição.
		return a.recuperarDPSProcessada(ctx, signedDPSXML, failure, cert)
	}
	return success, failure, nil
}

// CodigoDPSJaExiste: SEFIN — "conjunto de série, número, município e CNPJ/CPF
// desta DPS já existe em uma NFS-e gerada a partir de uma DPS enviada anteriormente".
const CodigoDPSJaExiste = "E0014"

// dpsPodeTerSidoProcessada: E0014, ou qualquer rejeição que só veio depois de
// um reenvio (a 1ª tentativa pode ter chegado à Receita).
func dpsPodeTerSidoProcessada(f *NFSeNacionalError) bool {
	if f.Tentativa > 1 {
		return true
	}
	for _, m := range f.Errors() {
		if m.Codigo == CodigoDPSJaExiste {
			return true
		}
	}
	return false
}

var dhEmiRe = regexp.MustCompile(`<(?:\w+:)?dhEmi>([^<]+)</(?:\w+:)?dhEmi>`)

// dhEmiDe devolve o primeiro <dhEmi> do documento (no XML da NFS-e é o da DPS
// embutida em <infNFSe>; o infNFSe em si usa dhProc).
func dhEmiDe(doc []byte) string {
	m := dhEmiRe.FindSubmatch(doc)
	if m == nil {
		return ""
	}
	return string(m[1])
}

// dpsRecovery é o que recuperarDPSProcessada precisa da SEFIN (fake nos testes).
type dpsRecovery interface {
	ConsultarDPSPorID(ctx context.Context, idDPS string, cert *tls.Certificate) (*NFSeNacionalSuccess, error)
	ConsultarNFSe(ctx context.Context, chaveAcesso string, cert *tls.Certificate) ([]byte, error)
}

func (a *Adapter) recuperarDPSProcessada(ctx context.Context, signedDPSXML []byte, failure *NFSeNacionalError, cert *tls.Certificate) (*NFSeNacionalSuccess, *NFSeNacionalError, error) {
	return recuperarDPSProcessada(ctx, a, signedDPSXML, failure, cert)
}

// recuperarDPSProcessada consulta GET /dps/{id}. Se a NFS-e existir E for desta
// DPS (mesmo dhEmi — o número pode ter sido usado por outra emissão, e aí a
// rejeição é verdadeira), devolve como sucesso, já com o XML oficial. Sem
// resposta conclusiva, devolve erro transitório: a nota fica PROCESSANDO e o
// DPSReconciler resolve depois — nunca REJEITADA por engano.
func recuperarDPSProcessada(ctx context.Context, sefin dpsRecovery, signedDPSXML []byte, failure *NFSeNacionalError, cert *tls.Certificate) (*NFSeNacionalSuccess, *NFSeNacionalError, error) {
	codigo, _ := failure.FirstError()
	idDPS := extractIDDPS(string(signedDPSXML))
	if idDPS == "" {
		return nil, failure, nil
	}
	res, err := sefin.ConsultarDPSPorID(ctx, idDPS, cert)
	if errors.Is(err, ErrDPSNaoEncontrada) {
		return nil, failure, nil // rejeição verdadeira
	}
	if err != nil {
		return nil, nil, fmt.Errorf("envio nfse-nacional: rejeição %s após reenvio e a consulta da DPS falhou: %w", codigo, err)
	}
	doc, err := sefin.ConsultarNFSe(ctx, res.ChaveAcesso, cert)
	if err != nil {
		return nil, nil, fmt.Errorf("envio nfse-nacional: rejeição %s, a NFS-e %s existe mas o XML não veio: %w", codigo, res.ChaveAcesso, err)
	}
	if nossa := dhEmiDe(signedDPSXML); nossa == "" || nossa != dhEmiDe(doc) {
		return nil, failure, nil // outra DPS com o mesmo número gerou a NFS-e
	}
	if gz, gzErr := gzipBytes(doc); gzErr == nil {
		res.NFSeXMLGZipB64 = base64.StdEncoding.EncodeToString(gz)
	}
	return res, nil, nil
}

// DecodeNFSeXML decompresses the nfseXmlGZipB64 returned by EnviarNFSeNacional
// into the raw authorised NFS-e XML.
func DecodeNFSeXML(nfseXMLGZipB64 string) ([]byte, error) {
	gz, err := base64.StdEncoding.DecodeString(nfseXMLGZipB64)
	if err != nil {
		return nil, fmt.Errorf("base64 decode: %w", err)
	}
	r, err := gzip.NewReader(bytes.NewReader(gz))
	if err != nil {
		return nil, fmt.Errorf("gzip reader: %w", err)
	}
	defer func() { _ = r.Close() }()
	return io.ReadAll(io.LimitReader(r, 16*1024*1024))
}

// CancelarNFSeNacional sends an event (cancelamento) request to
// POST /nfse/{chaveAcesso}/eventos with the same gzip+base64+JSON wrapping.
func (a *Adapter) CancelarNFSeNacional(
	ctx context.Context,
	chaveAcesso string,
	signedEventoXML []byte,
	cert *tls.Certificate,
) (*NFSeNacionalSuccess, *NFSeNacionalError, error) {
	gz, err := gzipBytes(signedEventoXML)
	if err != nil {
		return nil, nil, fmt.Errorf("gzip evento: %w", err)
	}
	bodyJSON, err := json.Marshal(map[string]string{
		"pedidoRegistroEventoXmlGZipB64": base64.StdEncoding.EncodeToString(gz),
	})
	if err != nil {
		return nil, nil, fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/nfse/%s/eventos", a.baseURL, chaveAcesso)

	var (
		success *NFSeNacionalSuccess
		failure *NFSeNacionalError
	)
	err = withRetry(ctx, backoffDelays, func() error {
		resp, doErr := a.doJSON(ctx, http.MethodPost, url, bodyJSON, cert)
		if doErr != nil {
			return doErr
		}
		defer func() { _ = resp.Body.Close() }()

		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4*1024*1024))

		switch {
		case resp.StatusCode >= 500:
			return transientErr{code: resp.StatusCode, body: body}
		case resp.StatusCode == http.StatusCreated || resp.StatusCode == http.StatusOK:
			s := &NFSeNacionalSuccess{}
			if err := json.Unmarshal(body, s); err != nil {
				return fmt.Errorf("parse success: %w", err)
			}
			success = s
			return nil
		case resp.StatusCode >= 400:
			f := &NFSeNacionalError{}
			if jsonErr := json.Unmarshal(body, f); jsonErr != nil || len(f.Errors()) == 0 {
				return fmt.Errorf("sefin client error %d: %.500s", resp.StatusCode, body)
			}
			failure = f
			return nil
		default:
			return fmt.Errorf("sefin unexpected status %d: %.200s", resp.StatusCode, body)
		}
	})
	if err != nil {
		return nil, failure, fmt.Errorf("evento cancelamento: %w", err)
	}
	return success, failure, nil
}

// gzipBytes compresses data with gzip default compression and returns the bytes.
func gzipBytes(data []byte) ([]byte, error) {
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)
	if _, err := w.Write(data); err != nil {
		_ = w.Close()
		return nil, err
	}
	if err := w.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// doJSON is the JSON-specific sibling of `do`: same mTLS dialer but with
// application/json Content-Type and Accept headers expected by SEFIN.
func (a *Adapter) doJSON(ctx context.Context, method, url string, body []byte, cert *tls.Certificate) (*http.Response, error) {
	tlsCfg := &tls.Config{
		Certificates: []tls.Certificate{*cert},
		MinVersion:   tls.VersionTLS12,
		// SEFIN Nacional initiates a TLS renegotiation to request the client cert.
		// Go disables renegotiation by default; enabling RenegotiateOnceAsClient
		// is the documented workaround for IIS/.NET servers that don't request
		// the cert in the initial ClientHello. Without this we get
		//   "local error: tls: no renegotiation"
		// on every emission attempt.
		Renegotiation: tls.RenegotiateOnceAsClient,
	}
	transport := &http.Transport{TLSClientConfig: tlsCfg}
	client := &http.Client{Transport: transport, Timeout: 30 * time.Second}

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	return client.Do(req)
}

// ErrDPSNaoEncontrada indica que a SEFIN Nacional respondeu 404 para o id da
// DPS: a Receita não tem NFS-e gerada a partir daquela DPS (nunca chegou ou
// foi rejeitada) — é seguro emitir de novo.
var ErrDPSNaoEncontrada = errors.New("dps não encontrada na SEFIN Nacional")

// ConsultarDPSPorID recupera a chave de acesso da NFS-e gerada a partir de uma
// DPS (GET /SefinNacional/dps/{idDps}). Usado para reconciliar notas cujo
// POST /nfse caiu em timeout/5xx: a Receita pode ter autorizado mesmo sem
// a resposta chegar até nós.
//
// Retorna ErrDPSNaoEncontrada no 404. 5xx e erros de rede são retentados.
func (a *Adapter) ConsultarDPSPorID(ctx context.Context, idDPS string, cert *tls.Certificate) (*NFSeNacionalSuccess, error) {
	url := a.baseURL + "/dps/" + idDPS
	var out *NFSeNacionalSuccess
	err := withRetry(ctx, backoffDelays, func() error {
		resp, err := a.doJSON(ctx, http.MethodGet, url, nil, cert)
		if err != nil {
			return err
		}
		defer func() { _ = resp.Body.Close() }()
		body, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
		if err != nil {
			return err
		}
		out, err = parseConsultaDPSResponse(resp.StatusCode, body)
		return err
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

// parseConsultaDPSResponse mapeia a resposta de GET /dps/{id}. Separado do
// transporte para ser testável sem mTLS.
func parseConsultaDPSResponse(status int, body []byte) (*NFSeNacionalSuccess, error) {
	switch {
	case status >= 500:
		return nil, transientErr{code: status, body: body}
	case status == http.StatusNotFound:
		// 404 de página HTML vem de proxy/rota, não da API: não dá pra afirmar
		// que a DPS não existe (reemitir poderia duplicar a NFS-e).
		if bytes.Contains(bytes.ToLower(body), []byte("<html")) {
			return nil, fmt.Errorf("consulta dps: 404 não-JSON: %.200s", body)
		}
		return nil, ErrDPSNaoEncontrada
	case status == http.StatusOK:
		s := &NFSeNacionalSuccess{}
		if err := json.Unmarshal(body, s); err != nil {
			return nil, fmt.Errorf("parse consulta dps: %w (body=%.200s)", err, body)
		}
		if s.ChaveAcesso == "" {
			return nil, fmt.Errorf("consulta dps sem chaveAcesso (body=%.200s)", body)
		}
		return s, nil
	default:
		return nil, fmt.Errorf("consulta dps: status %d: %.300s", status, body)
	}
}
