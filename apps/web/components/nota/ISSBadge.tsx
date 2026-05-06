/**
 * ISSBadge — ME-42
 *
 * Shows how ISS is collected for a given nota, based on the company's
 * regime tributário.
 *
 * Rules (per Brazilian tax law / NT 004 v2.0):
 *   - Simples MEI          → ISS via DAS (always, part of the Simples MEI calculus)
 *   - Simples Nacional ME  → ISS via DAS (collected through the monthly DAS document)
 *   - Lucro Presumido      → ISS via DAM (municipal collection doc), unless retido
 *   - Lucro Presumido + retido → ISS retido na fonte (withheld by the tomador)
 *   - Lucro Real           → ISS via DAM (same logic as LP)
 *
 * When regime is unknown (most dashboard notas are MEI today), we render
 * "ISS via DAS" because the current authenticated user must be MEI or SN.
 */

export type RegimeTributario =
  | 'SIMPLES_MEI'
  | 'SIMPLES_NACIONAL'
  | 'LUCRO_PRESUMIDO'
  | 'LUCRO_REAL'
  | null
  | undefined

interface ISSBadgeProps {
  regime?: RegimeTributario
  /** issRetido is only meaningful for LUCRO_PRESUMIDO / LUCRO_REAL. */
  issRetido?: boolean | null
  /** compact hides the descriptive text, showing only the pill. */
  compact?: boolean
}

interface BadgeConfig {
  label: string
  title: string
  className: string
}

function getConfig(regime: RegimeTributario, issRetido?: boolean | null): BadgeConfig {
  // LP / LR with retention
  if (
    (regime === 'LUCRO_PRESUMIDO' || regime === 'LUCRO_REAL') &&
    issRetido === true
  ) {
    return {
      label: 'ISS retido',
      title: 'ISS retido na fonte pelo tomador de serviços (Art. 6 LC 116/2003)',
      className: 'bg-nota-upgrade/10 text-nota-upgrade border-nota-upgrade/30',
    }
  }

  // LP / LR without retention
  if (regime === 'LUCRO_PRESUMIDO' || regime === 'LUCRO_REAL') {
    return {
      label: 'ISS via DAM',
      title: 'ISS recolhido via Documento de Arrecadação Municipal emitido pelo prestador',
      className: 'bg-nota-processando/10 text-nota-processando border-nota-processando/30',
    }
  }

  // Simples Nacional ME/EPP or unknown (default to DAS)
  return {
    label: 'ISS via DAS',
    title: 'ISS recolhido via DAS — Documento de Arrecadação do Simples Nacional',
    className: 'bg-nota-autorizada/10 text-nota-autorizada border-nota-autorizada/30',
  }
}

export default function ISSBadge({ regime, issRetido, compact = false }: ISSBadgeProps) {
  const { label, title, className } = getConfig(regime, issRetido)

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-default ${className}`}
    >
      {/* ISS icon */}
      <svg
        viewBox="0 0 12 12"
        fill="none"
        className="w-3 h-3 shrink-0"
        aria-hidden="true"
      >
        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 6h4M6 4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {label}
      {!compact && regime && regime !== 'SIMPLES_MEI' && regime !== 'SIMPLES_NACIONAL' && (
        <span className="opacity-60 text-[10px]">({regime === 'LUCRO_PRESUMIDO' ? 'LP' : 'LR'})</span>
      )}
    </span>
  )
}
