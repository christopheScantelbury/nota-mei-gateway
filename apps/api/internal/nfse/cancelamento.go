package nfse

import "time"

const (
	// JanelaCancelamentoPrivado is the cancellation window for private-sector tomadores.
	// SEFIN Nacional allows cancellation up to 90 days after emission.
	JanelaCancelamentoPrivado = 90 * 24 * time.Hour

	// JanelaCancelamentoPublico is the cancellation window for public-body tomadores.
	// Art. 1 §3 DL 9.745/2019 grants an extended 365-day window for ORGAO_PUBLICO.
	JanelaCancelamentoPublico = 365 * 24 * time.Hour
)

// PrazoCancelamento holds the result of a cancellation-window check.
type PrazoCancelamento struct {
	Permitido  bool
	DataLimite time.Time
	// TomadorPublico is true when tomador_tipo is ORGAO_PUBLICO.
	TomadorPublico bool
}

// VerificarPrazoCancelamento checks whether a nota is still within its cancellation
// window based on emitida_em and the tomador type (ME-31).
//
//   - Private tomadores: 90-day window.
//   - Public-body tomadores (ORGAO_PUBLICO): 365-day window.
//
// Returns Permitido=false when the window has expired or emitidaEm is nil.
func VerificarPrazoCancelamento(emitidaEm *time.Time, tomadorTipo *string) PrazoCancelamento {
	if emitidaEm == nil {
		return PrazoCancelamento{Permitido: false}
	}

	publico := tomadorTipo != nil && *tomadorTipo == "ORGAO_PUBLICO"
	janela := JanelaCancelamentoPrivado
	if publico {
		janela = JanelaCancelamentoPublico
	}

	dataLimite := emitidaEm.Add(janela)
	return PrazoCancelamento{
		Permitido:      time.Now().UTC().Before(dataLimite),
		DataLimite:     dataLimite,
		TomadorPublico: publico,
	}
}
