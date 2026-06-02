'use client'

import { useEffect, useState } from 'react'
import { computeCountdown, VIGENCIA_DATE } from '@/lib/dates/countdown'

/**
 * Contagem regressiva até 01/09/2026 (vigência NFS-e Nacional).
 *
 * Spec: HIST-1.3.
 * - Pré-vigência: "92 dias · 14h · 23min"
 * - Pós-vigência: "Obrigatório há X dias — você está atrasado"
 * - SSR: placeholder "Set/2026" pra evitar hydration mismatch (D-13)
 *
 * @example
 * <CountdownSet2026 size="compact" />
 */
interface Props {
  size?: 'default' | 'compact'
  targetDate?: Date
  className?: string
}

export default function CountdownSet2026({
  size = 'default',
  targetDate = VIGENCIA_DATE,
  className = '',
}: Props) {
  const [diff, setDiff] = useState(() => computeCountdown(new Date(), targetDate))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const tick = () => setDiff(computeCountdown(new Date(), targetDate))
    tick()
    const interval = setInterval(tick, 60_000)
    return () => clearInterval(interval)
  }, [targetDate])

  // SSR/pré-hidratação: placeholder estável (sem números) pra evitar mismatch
  if (!mounted) {
    return (
      <span
        className={`inline-flex items-baseline gap-1 font-mono text-amber-900 ${className}`}
      >
        Set/2026
      </span>
    )
  }

  if (diff.isOver) {
    return (
      <span
        aria-live="polite"
        className={`inline-flex items-baseline gap-2 font-mono text-red-700 ${className}`}
      >
        <span className="font-bold">Obrigatório há {diff.daysOver} dias</span>
        <span className="text-xs">— você está atrasado</span>
      </span>
    )
  }

  const numCls = size === 'compact' ? 'text-base font-bold' : 'text-2xl font-bold'
  const unitCls = size === 'compact' ? 'text-xs' : 'text-sm'
  const subCls = size === 'compact' ? 'text-sm' : 'text-lg'

  return (
    <span
      aria-live="polite"
      aria-label={`Faltam ${diff.days} dias, ${diff.hours} horas e ${diff.minutes} minutos para a obrigatoriedade`}
      className={`inline-flex items-baseline gap-2 font-mono ${className}`}
    >
      <span className={`${numCls} tabular-nums`}>{diff.days}</span>
      <span className={unitCls}>dias ·</span>
      <span className={`${subCls} tabular-nums`}>{diff.hours}h</span>
      <span className={`${subCls} tabular-nums`}>{diff.minutes}min</span>
    </span>
  )
}
