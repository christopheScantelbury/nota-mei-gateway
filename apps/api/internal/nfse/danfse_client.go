package nfse

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// DANFSE — Documento Auxiliar da NFS-e
//
// The Ambiente de Dados Nacional (ADN) hosts the DANFSE PDF rendering
// service at https://adn.nfse.gov.br/danfse/. Docs require mTLS at
// /danfse/docs/index.html. The actual PDF endpoint follows the chave
// de acesso pattern documented in the swagger.
//
// Production base:        https://adn.nfse.gov.br/danfse
// Produção restrita:      https://adn.producaorestrita.nfse.gov.br/danfse
//
// The Go API can reach ADN with the same mTLS + renegotiation handshake
// used for SefinNacional emission.

// ADNBaseURL points at the Ambiente de Dados Nacional. It mirrors
// RECEITA_API_URL: production overrides homologação at startup.
//
// We derive it from the SefinNacional baseURL (replacing the path) so
// callers only need to configure one env var.
func (a *Adapter) adnBaseURL() string {
	// baseURL example: https://sefin.nfse.gov.br/SefinNacional
	// ADN equivalent:  https://adn.nfse.gov.br/danfse
	// Production restrita:
	//   sefin: https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional
	//   adn:   https://adn.producaorestrita.nfse.gov.br/danfse
	switch {
	case strings.Contains(a.baseURL, "sefin.nfse.gov.br"):
		return "https://adn.nfse.gov.br/danfse"
	case strings.Contains(a.baseURL, "sefin.producaorestrita.nfse.gov.br"):
		return "https://adn.producaorestrita.nfse.gov.br/danfse"
	default:
		// Fallback for tests / dev — same host with /danfse path.
		return strings.TrimRight(a.baseURL, "/") + "/danfse"
	}
}

// ProbeADN tries a list of candidate ADN paths and returns the HTTP status +
// body preview for each. Used to discover the correct DANFSE endpoint without
// blind iteration on the production deploy cycle.
//
// Returns a map of "URL → status:body_preview" for every probed URL.
func (a *Adapter) ProbeADN(ctx context.Context, chaveAcesso string, cert *tls.Certificate) (map[string]string, error) {
	if cert == nil {
		return nil, fmt.Errorf("probe: certificate is required (mTLS)")
	}
	base := a.adnBaseURL() // e.g. https://adn.nfse.gov.br/danfse
	root := strings.TrimSuffix(base, "/danfse")

	urls := []string{
		root + "/contribuintes/swagger/v1/swagger.json",
	}

	tlsCfg := &tls.Config{
		Certificates:  []tls.Certificate{*cert},
		MinVersion:    tls.VersionTLS12,
		Renegotiation: tls.RenegotiateOnceAsClient,
	}
	client := &http.Client{
		Transport: &http.Transport{TLSClientConfig: tlsCfg},
		Timeout:   12 * time.Second,
	}

	results := make(map[string]string, len(urls))
	for _, url := range urls {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			results[url] = "build_request_error: " + err.Error()
			continue
		}
		req.Header.Set("Accept", "application/pdf, application/json, text/html")
		resp, err := client.Do(req)
		if err != nil {
			results[url] = "http_error: " + err.Error()
			continue
		}
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 200*1024))
		_ = resp.Body.Close()
		results[url] = fmt.Sprintf("HTTP %d  ct=%s  body=%.200000s",
			resp.StatusCode, resp.Header.Get("Content-Type"), strings.TrimSpace(string(body)))
		time.Sleep(3 * time.Second) // ADN rate limit is tight
	}
	return results, nil
}

// FetchDANFSE retrieves the DANFSE PDF for the given chave de acesso.
//
// Endpoint: GET {adn}/{chaveAcesso} — returns application/pdf binary.
// Accept header advertises both PDF and JSON so the server may return a
// structured error when the chave is unknown.
//
// Returns the PDF bytes on 200, or an error describing the HTTP failure.
// The caller is expected to forward the bytes to the client with the
// `application/pdf` Content-Type already set.
func (a *Adapter) FetchDANFSE(ctx context.Context, chaveAcesso string, cert *tls.Certificate) ([]byte, error) {
	if cert == nil {
		return nil, fmt.Errorf("danfse: certificate is required (mTLS)")
	}
	if len(chaveAcesso) != 50 {
		return nil, fmt.Errorf("danfse: chave_acesso deve ter 50 dígitos (recebi %d)", len(chaveAcesso))
	}

	url := a.adnBaseURL() + "/" + chaveAcesso

	tlsCfg := &tls.Config{
		Certificates:  []tls.Certificate{*cert},
		MinVersion:    tls.VersionTLS12,
		Renegotiation: tls.RenegotiateOnceAsClient,
	}
	client := &http.Client{
		Transport: &http.Transport{TLSClientConfig: tlsCfg},
		Timeout:   30 * time.Second,
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("danfse: new request: %w", err)
	}
	req.Header.Set("Accept", "application/pdf, application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("danfse: http do: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 8*1024*1024))

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("danfse: HTTP %d: %.300s", resp.StatusCode, body)
	}
	if !strings.HasPrefix(resp.Header.Get("Content-Type"), "application/pdf") {
		// Service returned JSON or HTML when we expected a PDF — surface verbatim
		// so the caller can log / show the error.
		return nil, fmt.Errorf("danfse: unexpected content-type %q: %.300s",
			resp.Header.Get("Content-Type"), body)
	}
	return body, nil
}
