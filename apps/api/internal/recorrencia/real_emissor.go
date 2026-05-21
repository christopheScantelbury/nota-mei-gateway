package recorrencia

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"time"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/document"
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/nfse"
	"github.com/google/uuid"
)

// CertLoader retrieves the parsed TLS certificate for a stored ARN.
// Satisfied by *cert.Provider in production.
type CertLoader interface {
	GetCert(ctx context.Context, secretARN string) (*tls.Certificate, error)
}

// NFSeAdapter is the minimal subset of *nfse.Adapter required to send a DPS.
type NFSeAdapter interface {
	EnviarNFSeNacional(
		ctx context.Context,
		signedDPSXML []byte,
		cert *tls.Certificate,
	) (*nfse.NFSeNacionalSuccess, *nfse.NFSeNacionalError, error)
}

// XMLSigner mirrors document.Signer — exposed here to keep the dependency surface narrow.
type XMLSigner interface {
	Sign(ctx context.Context, xmlDoc []byte, cert *tls.Certificate) ([]byte, error)
}

// RealEmissor is a NotaEmissor that runs the full DPS emission pipeline.
//
// It deliberately reuses the same building blocks the HTTP handler uses
// (DPSBuilder, XMLDSigSigner, EnviarNFSeNacional, NotaRepository) so that
// recurring notas behave identically to ones emitted via POST /v1/nfse.
//
// The handler can't be invoked directly from the scheduler because it
// depends on *fiber.Ctx, so this struct duplicates the orchestration —
// kept short by skipping HTTP-specific concerns (response building,
// validation that the JSON layer already covered, idempotency).
type RealEmissor struct {
	authRepo    *auth.Repository
	notaRepo    *nfse.NotaRepository
	dpsBuilder  *document.DPSBuilder
	signer      XMLSigner
	certLoader  CertLoader
	adapter     NFSeAdapter
}

// NewRealEmissor wires all the deps needed to run the unified DPS path.
func NewRealEmissor(
	authRepo *auth.Repository,
	notaRepo *nfse.NotaRepository,
	dpsBuilder *document.DPSBuilder,
	signer XMLSigner,
	certLoader CertLoader,
	adapter NFSeAdapter,
) *RealEmissor {
	return &RealEmissor{
		authRepo:   authRepo,
		notaRepo:   notaRepo,
		dpsBuilder: dpsBuilder,
		signer:     signer,
		certLoader: certLoader,
		adapter:    adapter,
	}
}

// EmitirNota turns a stored recorrencia (mei_id + JSON servico/tomador/competencia)
// into an autorizada NFS-e via the NFS-e Nacional DPS path.
//
// Returns the persisted nota_id on success. Non-authorized responses (4xx from
// Receita) still persist the nota with status REJEITADA and return the id so
// callers can render the error.
func (e *RealEmissor) EmitirNota(ctx context.Context, meiID string, reqMap map[string]interface{}) (string, error) {
	ownerID, err := uuid.Parse(meiID)
	if err != nil {
		return "", fmt.Errorf("invalid mei_id: %w", err)
	}

	// 1. Resolve empresa (mirror row exists for MEIs since the multi_produto migration).
	empresa, err := e.authRepo.FindEmpresa(ctx, ownerID)
	if err != nil {
		return "", fmt.Errorf("empresa lookup: %w", err)
	}

	// 2. Unmarshal the request map back into EmissaoRequest.
	req, err := mapToEmissaoRequest(reqMap)
	if err != nil {
		return "", fmt.Errorf("emissao request decode: %w", err)
	}

	// 3. Allocate DPS sequence number (atomic).
	numeroDPS, err := e.notaRepo.NextNumeroDPS(ctx, empresa.ID)
	if err != nil {
		return "", fmt.Errorf("alocar numero dps: %w", err)
	}

	// 4. Build DPS XML.
	dpsResult, err := e.dpsBuilder.Build(req, empresa, numeroDPS)
	if err != nil {
		return "", fmt.Errorf("build dps: %w", err)
	}

	// 5. Load cert.
	if empresa.CertSecretARN == nil || *empresa.CertSecretARN == "" {
		return "", fmt.Errorf("empresa sem certificado A1 configurado")
	}
	cert, err := e.certLoader.GetCert(ctx, *empresa.CertSecretARN)
	if err != nil {
		return "", fmt.Errorf("load cert: %w", err)
	}

	// 6. Sign.
	signedXML, err := e.signer.Sign(ctx, dpsResult.XML, cert)
	if err != nil {
		return "", fmt.Errorf("sign: %w", err)
	}

	// 7. Persist nota (PROCESSANDO).
	var meiIDForRow uuid.UUID
	if empresa.Tipo == "MEI" {
		meiIDForRow = empresa.ID
	}
	nota, err := e.notaRepo.Create(ctx, nfse.CreateNotaInput{
		MeiID:            meiIDForRow,
		EmpresaID:        empresa.ID,
		NumeroRPS:        numeroDPS,
		XMLEnviado:       string(signedXML),
		WebhookURL:       req.WebhookURL,
		TomadorDoc:       req.Tomador.Documento,
		TomadorNome:      req.Tomador.RazaoSocial,
		ValorServico:     req.Servico.Valor,
		Competencia:      req.Competencia,
		RegimeTributario: empresa.RegimeTributario,
	})
	if err != nil {
		return "", fmt.Errorf("persist nota: %w", err)
	}

	// 8. Send to Receita.
	success, failure, envErr := e.adapter.EnviarNFSeNacional(ctx, signedXML, cert)
	if envErr != nil && failure == nil {
		// Transient error — leave nota as PROCESSANDO so the StuckPoller retries.
		return nota.ID.String(), nil
	}
	if failure != nil && len(failure.Errors()) > 0 {
		codigo, descricao := failure.FirstError()
		_, _ = e.notaRepo.Rejeitar(ctx, nota.ID, codigo, descricao)
		return nota.ID.String(), fmt.Errorf("rejeitada: %s %s", codigo, descricao)
	}
	if success != nil && success.ChaveAcesso != "" {
		_, _ = e.notaRepo.Autorizar(ctx, nota.ID, success.ChaveAcesso, "", success.IDDps)
	}
	// Best-effort fire-and-forget — webhook delivery is the handler's job, not the scheduler's.

	_ = time.Now() // silence unused import if all branches above return
	return nota.ID.String(), nil
}

// mapToEmissaoRequest converts the JSONB-derived map back into the strongly
// typed request struct used by the rest of the pipeline.
func mapToEmissaoRequest(m map[string]interface{}) (document.EmissaoRequest, error) {
	b, err := json.Marshal(m)
	if err != nil {
		return document.EmissaoRequest{}, err
	}
	var req document.EmissaoRequest
	if err := json.Unmarshal(b, &req); err != nil {
		return document.EmissaoRequest{}, err
	}
	return req, nil
}
