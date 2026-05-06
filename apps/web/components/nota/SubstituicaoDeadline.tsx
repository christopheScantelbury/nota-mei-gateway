/**
 * SubstituicaoDeadline — ME-43
 *
 * Shows the remaining days in the 9-day NFS-e substitution window for
 * ME/EPP AUTORIZADA notas.
 *
 * Rules:
 *   - Only visible for ME/EPP companies (regime ≠ SIMPLES_MEI)
 *   - Only visible for AUTORIZADA notas
 *   - Window: 9 days from emitida_em
 *   - When ≤ 2 days remain: red/urgent styling
 *   - When 3–5 days remain: amber/warning styling
 *   - When > 5 days remain: muted styling
 *   - When expired: shows "Prazo expirado" (grey)
 */

export type RegimeTributario =
  | 'SIMPLES_MEI'
  | 'SIMPLES_NACIONAL'
  | 'LUCRO_PRESUMIDO'
  | 'LUCRO_REAL'
  | null
  | undefined

const WINDOW_DAYS = 9

interface SubstituicaoDeadlineProps {
  emitidaEm: string | null | undefined
  status: string
  regime?: RegimeTributario
  /** compact: show only a small pill without label prefix */
  compact?: boolean
}

export default function SubstituicaoDeadline({
  emitidaEm,
  status,
  regime,
  compact = false,
}: SubstituicaoDeadlineProps) {
  // Only relevant for ME/EPP (not MEI, not SN used by MEI)
  if (!regime || regime === 'SIMPLES_MEI' || regime === 'SIMPLES_NACIONAL') return null
  if (status !== 'AUTORIZADA') return null
  if (!emitidaEm) return null

  const emitidaAt = new Date(emitidaEm).getTime()
  const now       = Date.now()
  const deadlineMs = emitidaAt + WINDOW_DAYS * 24 * 60 * 60 * 1000
  const remainMs   = deadlineMs - now
  const daysLeft   = Math.ceil(remainMs / (24 * 60 * 60 * 1000))

  let label: string
  let className: string

  if (remainMs <= 0) {
    label = 'Prazo de substituição expirado'
    className = 'bg-gray-100 text-gray-400 border-gray-200'
  } else if (daysLeft <= 2) {
    label = compact ? `${daysLeft}d` : `${daysLeft} dia${daysLeft !== 1 ? 's' : ''} para substituir`
    className = 'bg-nota-rejeitada/10 text-nota-rejeitada border-nota-rejeitada/30 animate-pulse'
  } else if (daysLeft <= 5) {
    label = compact ? `${daysLeft}d` : `${daysLeft} dias para substituir`
    className = 'bg-nota-processando/10 text-nota-processando border-nota-processando/30'
  } else {
    label = compact ? `${daysLeft}d` : `${daysLeft} dias para substituir`
    className = 'bg-navy-700 text-text-2 border-navy-600'
  }

  return (
    <span
      title={`Prazo de substituição: 9 dias a partir de ${new Date(emitidaEm).toLocaleDateString('pt-BR')}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-default ${className}`}
    >
      {/* Clock icon */}
      <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 shrink-0" aria-hidden="true">
        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 3v3l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact && remainMs > 0 && (
        <span className="opacity-70 mr-0.5">Subst.</span>
      )}
      {label}
    </span>
  )
}
