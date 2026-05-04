'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { NotaStatus } from '@/lib/types'

const POLL_INTERVAL_MS = 5_000          // 5 seconds between polls
const MAX_POLL_MS      = 10 * 60_000    // stop after 10 minutes

interface StatusConfig {
  label: string
  kind: 'success' | 'error' | 'info'
}

const STATUS_CONFIG: Record<NotaStatus, StatusConfig> = {
  PROCESSANDO:     { label: 'Nota em processamento',  kind: 'info'    },
  AUTORIZADA:      { label: 'Nota autorizada ✅',      kind: 'success' },
  REJEITADA:       { label: 'Nota rejeitada ❌',       kind: 'error'   },
  CANCELADA:       { label: 'Nota cancelada',          kind: 'info'    },
  ERRO_TEMPORARIO: { label: 'Erro temporário na nota', kind: 'error'   },
}

/**
 * useNotaPolling — polls /api/notas/:id/status every 5 s while status is
 * PROCESSANDO. Pauses when the browser tab is hidden; auto-stops after 10 min
 * or when the status leaves PROCESSANDO. Shows a Sonner toast on change.
 */
export function useNotaPolling(notaId: string, currentStatus: NotaStatus) {
  const router      = useRouter()
  const startedAt   = useRef(Date.now())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const active      = useRef(currentStatus === 'PROCESSANDO')

  const stopPolling = useCallback(() => {
    active.current = false
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (currentStatus !== 'PROCESSANDO') return

    active.current = true
    startedAt.current = Date.now()

    const poll = async () => {
      if (!active.current) return

      // Pause while tab is hidden — resume on next tick when visible again
      if (document.hidden) return

      // Auto-stop after MAX_POLL_MS
      if (Date.now() - startedAt.current > MAX_POLL_MS) {
        stopPolling()
        toast.warning('Atualização automática encerrada após 10 minutos. Recarregue para ver o status.')
        return
      }

      try {
        const res = await fetch(`/api/notas/${notaId}/status`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        })
        if (!res.ok) return

        const data = (await res.json()) as { status: NotaStatus }
        if (data.status !== 'PROCESSANDO') {
          stopPolling()
          const cfg = STATUS_CONFIG[data.status]
          const msg = cfg?.label ?? data.status
          if (cfg?.kind === 'success') toast.success(msg)
          else if (cfg?.kind === 'error') toast.error(msg)
          else toast.info(msg)
          router.refresh()
        }
      } catch {
        // Silent — will retry on next interval
      }
    }

    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => stopPolling()
  }, [notaId, currentStatus, router, stopPolling])
}
