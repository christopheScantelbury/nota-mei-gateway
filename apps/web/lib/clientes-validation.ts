/**
 * Helpers compartilhados entre /api/clientes/route.ts e /api/clientes/[id]/route.ts.
 *
 * Vive em /lib porque Next.js 14 não permite exports custom em arquivos route.ts.
 */
import type { ClienteInput } from '@/lib/types-cliente'

export function validateClienteInput(input: Partial<ClienteInput>): string | null {
  if (input.tipo && !['PJ', 'PF'].includes(input.tipo)) return 'tipo inválido (use PJ ou PF)'
  if (input.documento != null) {
    const clean = String(input.documento).replace(/\D/g, '')
    if (input.tipo === 'PJ' && clean.length !== 14) return 'CNPJ deve ter 14 dígitos'
    if (input.tipo === 'PF' && clean.length !== 11) return 'CPF deve ter 11 dígitos'
    if (!input.tipo && clean.length !== 11 && clean.length !== 14) return 'documento inválido'
  }
  if (input.razao_social != null && String(input.razao_social).trim().length === 0) {
    return 'razao_social é obrigatória'
  }
  if (input.email != null && input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return 'email inválido'
  }
  if (input.municipio_ibge != null && input.municipio_ibge) {
    if (!/^\d{7}$/.test(input.municipio_ibge)) return 'municipio_ibge deve ter 7 dígitos'
  }
  return null
}

export function normalizeClienteInput(input: Partial<ClienteInput>) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue
    if (k === 'documento' && typeof v === 'string') {
      out[k] = v.replace(/\D/g, '')
    } else if (k === 'tags' && Array.isArray(v)) {
      out[k] = v.map(String).map((s) => s.trim()).filter(Boolean)
    } else if (typeof v === 'string') {
      const trimmed = v.trim()
      out[k] = trimmed === '' ? null : trimmed
    } else {
      out[k] = v
    }
  }
  return out
}
