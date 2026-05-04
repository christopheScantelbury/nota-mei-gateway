/**
 * Validates a Brazilian CNPJ using the official check-digit algorithm.
 * Accepts raw digits or formatted strings (dots, slashes, dashes are stripped).
 */
export function validarCNPJ(cnpj: string): boolean {
  const n = cnpj.replace(/\D/g, '')
  if (n.length !== 14) return false
  // Reject obvious sequences like 00000000000000
  if (/^(\d)\1+$/.test(n)) return false

  const calc = (len: number): number => {
    let sum = 0
    let pos = len - 7
    for (let i = len; i >= 1; i--) {
      sum += parseInt(n[len - i]) * pos--
      if (pos < 2) pos = 9
    }
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }

  return calc(12) === parseInt(n[12]) && calc(13) === parseInt(n[13])
}
