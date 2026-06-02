// Constantes e helpers de countdown para a vigência NFS-e Nacional.
//
// Spec: HIST-1.3 + D-13 (decisão fechada: timezone Brasília UTC-3).

/** Data oficial de vigência da NFS-e Nacional obrigatória (Brasília UTC-3). */
export const VIGENCIA_DATE = new Date('2026-09-01T00:00:00-03:00')

export interface CountdownDiff {
  isOver: boolean
  daysOver: number
  days: number
  hours: number
  minutes: number
}

/** Calcula diferença entre `now` e VIGENCIA_DATE. */
export function computeCountdown(now: Date, target: Date = VIGENCIA_DATE): CountdownDiff {
  const diffMs = target.getTime() - now.getTime()
  if (diffMs <= 0) {
    const daysOver = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24))
    return { isOver: true, daysOver, days: 0, hours: 0, minutes: 0 }
  }
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  return { isOver: false, daysOver: 0, days, hours, minutes }
}
