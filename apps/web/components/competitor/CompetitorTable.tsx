'use client'

import { useEffect, useRef } from 'react'
import competitorsData from '@/data/competitors.json'
import { trackComparisonView } from '@/lib/analytics/events'

/**
 * Tabela comparativa NotaFácil vs concorrentes.
 *
 * Spec: HIST-4.1 + 02-Especificacoes-Tecnicas.md.
 * - `variant="summary"`: apenas features com `highlight: true` (~4 linhas)
 * - `variant="full"`: todas as features (12)
 * - `competitorsFilter`: opcional, limita colunas (uso em posts vs X)
 *
 * @example
 * <CompetitorTable variant="summary" />
 */
interface Feature {
  id: string
  label: string
  highlight: boolean
  values: Record<string, string>
}

interface Props {
  variant?: 'full' | 'summary'
  competitorsFilter?: string[]
  className?: string
  /** view_type pra evento comparison_view */
  source?: 'page' | 'home_embed' | 'blog_embed'
}

export default function CompetitorTable({
  variant = 'full',
  competitorsFilter,
  className = '',
  source = 'home_embed',
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const labels = competitorsData.labels as Record<string, string>
  const competitors = (competitorsFilter ?? competitorsData.competitors) as string[]
  const features = (competitorsData.features as Feature[]).filter(
    f => variant === 'full' || f.highlight,
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let fired = false
    const obs = new IntersectionObserver((entries) => {
      if (!fired && entries.some(e => e.isIntersecting)) {
        fired = true
        trackComparisonView({ view_type: source })
        obs.disconnect()
      }
    }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [source])

  return (
    <div
      ref={ref}
      className={`overflow-x-auto rounded-2xl border border-slate-200 dark:border-navy-600 ${className}`}
    >
      <table className="w-full border-collapse text-sm" aria-label="Comparativo competitivo entre plataformas de emissão de NFS-e">
        <caption className="sr-only">
          Comparativo entre {competitors.length} plataformas de emissão de NFS-e Nacional
        </caption>
        <thead className="bg-slate-50 dark:bg-navy-700/50">
          <tr>
            <th
              scope="col"
              className="text-left p-3 sm:p-4 font-semibold text-slate-700 dark:text-text-1 sticky left-0 bg-slate-50 dark:bg-navy-700/50 z-10"
            >
              Funcionalidade
            </th>
            {competitors.map((c) => (
              <th
                key={c}
                scope="col"
                className={`p-3 sm:p-4 text-center font-semibold whitespace-nowrap ${
                  c === 'notafacil'
                    ? 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200'
                    : 'text-slate-700 dark:text-text-1'
                }`}
              >
                {labels[c] ?? c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((f) => (
            <tr
              key={f.id}
              className={f.highlight ? 'bg-amber-50/40 dark:bg-amber-500/5' : 'bg-white dark:bg-navy-700/20'}
            >
              <th
                scope="row"
                className={`text-left p-3 sm:p-4 font-medium border-t border-slate-200 dark:border-navy-600 sticky left-0 z-10 ${
                  f.highlight
                    ? 'bg-amber-50/80 dark:bg-amber-500/10 text-slate-800 dark:text-text-1'
                    : 'bg-white dark:bg-navy-700/20 text-slate-700 dark:text-text-1'
                }`}
              >
                {f.label}
              </th>
              {competitors.map((c) => (
                <td
                  key={c}
                  className={`p-3 sm:p-4 text-center text-xs sm:text-sm border-t border-slate-200 dark:border-navy-600 ${
                    c === 'notafacil'
                      ? 'bg-amber-50 dark:bg-amber-500/10 font-semibold text-slate-900 dark:text-text-1'
                      : 'text-slate-700 dark:text-text-2'
                  }`}
                >
                  {f.values[c] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-xs text-slate-500 dark:text-text-2 bg-slate-50/50 dark:bg-navy-700/30 border-t border-slate-200 dark:border-navy-600">
        Atualizado em {competitorsData.lastUpdated}. Informações coletadas dos sites oficiais dos concorrentes.
      </p>
    </div>
  )
}
