import PioneerBadge from '@/components/badges/PioneerBadge'
import competitorsData from '@/data/competitors.json'

/**
 * Hero de posts "vs concorrente" — logos lado a lado + selo de pioneirismo
 * + data de última atualização.
 *
 * Spec: HIST-4.4 + 05-Componentes-React.md.
 *
 * @example
 * <VsHero competitor="focus_nfe" />
 */
interface Props {
  competitor: 'focus_nfe' | 'enotas' | 'plugnotas' | 'nfeio'
  className?: string
}

export default function VsHero({ competitor, className = '' }: Props) {
  const label = (competitorsData.labels as Record<string, string>)[competitor] ?? competitor

  return (
    <div className={`not-prose my-8 rounded-2xl border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-700 p-6 sm:p-8 text-center ${className}`}>
      <div className="flex items-center justify-center gap-4 sm:gap-8 mb-4">
        <span className="font-display text-2xl sm:text-3xl font-extrabold text-brand-cyan">
          NotaFácil
        </span>
        <span className="text-slate-400 dark:text-text-2 font-mono text-xl">vs</span>
        <span className="font-display text-2xl sm:text-3xl font-extrabold text-slate-700 dark:text-text-1">
          {label}
        </span>
      </div>
      <div className="flex justify-center mb-3">
        <PioneerBadge variant="inline" />
      </div>
      <p className="text-xs text-slate-500 dark:text-text-2">
        Comparativo técnico — atualizado em {competitorsData.lastUpdated}
      </p>
    </div>
  )
}
