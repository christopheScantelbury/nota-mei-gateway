package nfse

// rejeicoesME maps SEFIN Nacional rejection codes for DPS submissions (ME/EPP path).
// Codes E01-E09 are hard errors that prevent NFS-e issuance.
// Code E55 covers schema/XML validation failures.
// Code W01 is a non-fatal warning that does not block issuance.
//
// Source: Manual de Integração NFS-e Nacional v1.2 — Tabela de Rejeições.
var rejeicoesME = map[string]string{
	"E01": "CNPJ do prestador inválido ou não habilitado para NFS-e Nacional",
	"E02": "Inscrição municipal do prestador não encontrada no cadastro municipal",
	"E03": "Código NBS inválido ou não vigente na tabela CNBS",
	"E04": "Alíquota de ISS inválida para o município do prestador",
	"E05": "Competência da DPS fora do período permitido para emissão retroativa",
	"E06": "Número de DPS já utilizado (duplicata) — verifique o campo nDPS",
	"E07": "Assinatura digital inválida ou certificado A1 expirado",
	"E08": "Documento do tomador inválido (CPF/CNPJ com dígitos verificadores incorretos)",
	"E09": "Município do tomador não reconhecido pelo código IBGE informado",
	"E55": "Erro de validação de schema XML — verifique a estrutura do DPS enviado",
	"W01": "ISS retido na fonte aplicado automaticamente pelo município (aviso não bloqueante)",
}

// DescricaoRejeicao returns the Portuguese description for a SEFIN rejection code.
// Returns the raw code as the description when the code is not in the known map,
// so that unknown codes are still surfaced to the caller.
func DescricaoRejeicao(codigo string) string {
	if desc, ok := rejeicoesME[codigo]; ok {
		return desc
	}
	return "Rejeição SEFIN Nacional: " + codigo
}

// IsWarning returns true when the code is non-fatal (W-prefix).
func IsWarning(codigo string) bool {
	return len(codigo) > 0 && codigo[0] == 'W'
}

// IsError returns true when the code is a hard error (E-prefix).
func IsError(codigo string) bool {
	return len(codigo) > 0 && codigo[0] == 'E'
}
