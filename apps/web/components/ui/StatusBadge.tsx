import type { NotaStatus } from '@/lib/types'
import { situacaoErroTemporario, TEXTO_ERRO_TEMPORARIO } from '@/lib/notas/erro-temporario'

const config: Record<
  NotaStatus,
  { label: string; className: string }
> = {
  AUTORIZADA:     { label: 'Autorizada',     className: 'bg-nota-autorizada/10 text-nota-autorizada border-nota-autorizada/30' },
  PROCESSANDO:    { label: 'Processando',    className: 'bg-nota-processando/10 text-nota-processando border-nota-processando/30 animate-pulse' },
  REJEITADA:      { label: 'Rejeitada',      className: 'bg-nota-rejeitada/10 text-nota-rejeitada border-nota-rejeitada/30' },
  CANCELADA:      { label: 'Cancelada',      className: 'bg-nota-cancelada/10 text-nota-cancelada border-nota-cancelada/30' },
  ERRO_TEMPORARIO:{ label: 'Erro Temporário',className: 'bg-nota-rejeitada/10 text-nota-rejeitada border-nota-rejeitada/30' },
}

/**
 * erroCodigo (opcional) refina ERRO_TEMPORARIO (#277): "Aguardando Receita" em
 * âmbar quando a nota pode já ter sido autorizada — o vermelho "Erro" levava o
 * cliente a emitir de novo e duplicar a NFS-e.
 */
export default function StatusBadge({ status, erroCodigo }: { status: NotaStatus; erroCodigo?: string | null }) {
  let { label, className } = config[status] ?? {
    label: status,
    className: 'bg-navy-600 text-text-2 border-navy-600',
  }
  if (status === 'ERRO_TEMPORARIO') {
    const sit = situacaoErroTemporario(erroCodigo)
    label = TEXTO_ERRO_TEMPORARIO[sit].badge
    if (sit !== 'nao_recebida') {
      className = 'bg-nota-processando/10 text-nota-processando border-nota-processando/30'
    }
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  )
}
