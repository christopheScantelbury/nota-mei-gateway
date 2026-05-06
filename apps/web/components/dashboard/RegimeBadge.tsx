/**
 * RegimeBadge — exibe o regime tributário da empresa como pill colorido.
 *
 * SIMPLES_MEI        → "MEI"        cinza
 * SIMPLES_NACIONAL   → "SN"         verde-esmeralda
 * LUCRO_PRESUMIDO    → "LP"         âmbar
 * LUCRO_REAL         → "LR"         laranja
 */

import type { RegimeTributario } from '@/lib/types'

interface RegimeBadgeProps {
  regime?: RegimeTributario | null
  /** full: exibe o nome completo; default: exibe abreviação */
  full?: boolean
}

const CONFIG: Record<
  NonNullable<RegimeTributario>,
  { abbr: string; full: string; className: string }
> = {
  SIMPLES_MEI: {
    abbr: 'MEI',
    full: 'Simples MEI',
    className: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  },
  SIMPLES_NACIONAL: {
    abbr: 'SN',
    full: 'Simples Nacional',
    className: 'bg-nota-autorizada/10 text-nota-autorizada border-nota-autorizada/30',
  },
  LUCRO_PRESUMIDO: {
    abbr: 'LP',
    full: 'Lucro Presumido',
    className: 'bg-nota-processando/10 text-nota-processando border-nota-processando/30',
  },
  LUCRO_REAL: {
    abbr: 'LR',
    full: 'Lucro Real',
    className: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  },
}

export default function RegimeBadge({ regime, full = false }: RegimeBadgeProps) {
  if (!regime) return null

  const cfg = CONFIG[regime]
  if (!cfg) return null

  return (
    <span
      title={cfg.full}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-default ${cfg.className}`}
    >
      {full ? cfg.full : cfg.abbr}
    </span>
  )
}
