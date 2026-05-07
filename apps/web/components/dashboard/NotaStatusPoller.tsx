'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ErroEmissao } from '@/app/(dashboard)/notas/nova/components/ErroEmissao'
import type { NotaStatus } from '@/lib/types'

interface Props {
  notaId: string
  status: NotaStatus
}

const POLLING_INTERVAL_MS = 5_000
const POLLING_TIMEOUT_MS  = 5 * 60 * 1000

/**
 * Client-only polling indicator for nota detail page.
 * Shows "live update" spinner while PROCESSANDO, handles timeout and API errors.
 */
export default function NotaStatusPoller({ notaId, status }: Props) {
  const router   = useRouter()
  const [timedOut, setTimedOut] = useState(false)
  const [apiErro,  setApiErro]  = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'PROCESSANDO') return

    let ativo = true
    const inicio = Date.now()
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      if (!ativo) return

      if (Date.now() - inicio > POLLING_TIMEOUT_MS) {
        setTimedOut(true)
        return
      }

      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ''
        const res = await fetch(`${apiBase}/v1/nfse/${notaId}`, { cache: 'no-store' })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          const code: string = err.error ?? ''
          if (code === 'CERTIFICADO_EXPIRADO') {
            setApiErro('certificado_expirado')
          } else if (code === 'CERTIFICADO_INVALIDO') {
            setApiErro('certificado_invalido')
          } else {
            setApiErro('api_indisponivel')
          }
          return
        }

        const data = await res.json()

        if (!['PROCESSANDO', 'ERRO_TEMPORARIO'].includes(data.status)) {
          // Refresh server component to reflect the new status
          router.refresh()
          return
        }

        if (ativo) {
          timer = setTimeout(poll, POLLING_INTERVAL_MS)
        }
      } catch {
        if (ativo) setApiErro('api_indisponivel')
      }
    }

    timer = setTimeout(poll, POLLING_INTERVAL_MS)
    return () => {
      ativo = false
      clearTimeout(timer)
    }
  }, [notaId, status, router])

  if (status !== 'PROCESSANDO') return null

  if (timedOut) {
    return (
      <ErroEmissao
        tipo="timeout_polling"
        onTentar={() => router.push('/notas')}
      />
    )
  }

  if (apiErro) {
    return (
      <ErroEmissao
        tipo={apiErro as 'certificado_expirado' | 'certificado_invalido' | 'api_indisponivel'}
        onTentar={() => window.location.reload()}
      />
    )
  }

  return (
    <div className="inline-flex items-center gap-2 mt-3 text-xs text-nota-processando">
      <span className="inline-block w-2 h-2 rounded-full bg-nota-processando animate-pulse shrink-0" />
      Atualizando status automaticamente a cada 5&nbsp;s…
    </div>
  )
}
