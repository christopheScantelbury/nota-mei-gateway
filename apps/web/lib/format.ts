/**
 * Formatadores canônicos do NotaFácil — moeda, documentos e datas no padrão
 * brasileiro. Use SEMPRE estas funções em vez de redefinir helpers locais,
 * para garantir consistência em todo o sistema.
 */

const onlyDigits = (s: string): string => (s ?? '').replace(/\D/g, '')

// ── Moeda ─────────────────────────────────────────────────────────────────────

/**
 * Formata um valor numérico como moeda brasileira: R$ 1.234,56.
 * Retorna o placeholder "—" para null/undefined/NaN.
 */
export function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

/**
 * Formata um valor em centavos (ex.: Stripe) como moeda. A `currency` é o
 * código ISO de 3 letras (ex.: "brl", "usd").
 */
export function formatMoneyFromCents(amountCents: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountCents / 100)
}

// ── Documentos (exibição) ───────────────────────────────────────────────────

/** Formata um CNPJ para exibição: 00.000.000/0000-00. Tolera entrada já formatada. */
export function formatCNPJ(value: string): string {
  const d = onlyDigits(value)
  if (d.length !== 14) return value || '—'
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/** Formata um CPF para exibição: 000.000.000-00. Tolera entrada já formatada. */
export function formatCPF(value: string): string {
  const d = onlyDigits(value)
  if (d.length !== 11) return value || '—'
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Formata CPF (11 díg.) ou CNPJ (14 díg.) automaticamente pelo comprimento. */
export function formatDoc(value: string | null | undefined): string {
  if (!value) return '—'
  const d = onlyDigits(value)
  if (d.length === 11) return formatCPF(d)
  if (d.length === 14) return formatCNPJ(d)
  return value
}

/** Formata um CEP para exibição: 00000-000. */
export function formatCEP(value: string): string {
  const d = onlyDigits(value)
  if (d.length !== 8) return value || '—'
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

// ── Documentos (máscara progressiva para inputs onChange) ────────────────────

/** Máscara progressiva de CNPJ enquanto o usuário digita. */
export function maskCNPJ(value: string): string {
  const d = onlyDigits(value).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/** Máscara progressiva de CPF enquanto o usuário digita. */
export function maskCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Máscara progressiva de CPF/CNPJ pelo número de dígitos (≤11 = CPF). */
export function maskDoc(value: string): string {
  const d = onlyDigits(value)
  return d.length <= 11 ? maskCPF(d) : maskCNPJ(d)
}

/** Máscara progressiva de CEP enquanto o usuário digita. */
export function maskCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

// ── Competência ──────────────────────────────────────────────────────────────

/** Converte competência "AAAA-MM" em "MM/AAAA"; retorna a entrada se não casar. */
export function formatCompetencia(comp: string | null | undefined): string {
  if (!comp) return '—'
  const m = /^(\d{4})-(\d{2})$/.exec(comp)
  return m ? `${m[2]}/${m[1]}` : comp
}
