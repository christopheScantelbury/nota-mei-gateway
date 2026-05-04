'use client'

import { useNotaPolling } from '@/hooks/useNotaPolling'
import type { NotaStatus } from '@/lib/types'

interface Props {
  notaId: string
  status: NotaStatus
}

/**
 * Thin client-only wrapper around useNotaPolling.
 * Renders a subtle "live update" indicator while status is PROCESSANDO;
 * invisible otherwise. The Server Component page imports this alongside
 * the static nota data.
 */
export default function NotaStatusPoller({ notaId, status }: Props) {
  useNotaPolling(notaId, status)

  if (status !== 'PROCESSANDO') return null

  return (
    <div className="inline-flex items-center gap-2 mt-3 text-xs text-nota-processando">
      <span className="inline-block w-2 h-2 rounded-full bg-nota-processando animate-pulse shrink-0" />
      Atualizando status automaticamente a cada 5&nbsp;s…
    </div>
  )
}
