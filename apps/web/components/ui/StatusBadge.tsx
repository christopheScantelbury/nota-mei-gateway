import type { NotaStatus } from '@/lib/types'

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

export default function StatusBadge({ status }: { status: NotaStatus }) {
  const { label, className } = config[status] ?? {
    label: status,
    className: 'bg-navy-600 text-text-2 border-navy-600',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  )
}
