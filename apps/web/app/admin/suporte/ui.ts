import type { TicketPrioridade, TicketStatus } from '@/lib/suporte/types'

type Variant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'destructive' | 'neutral' | 'upgrade'

export function statusVariant(s: TicketStatus): Variant {
  return s === 'aguardando_humano' ? 'warning'
    : s === 'aguardando_cliente' ? 'primary'
    : s === 'ia' ? 'upgrade'
    : 'neutral'
}

export function prioridadeVariant(p: TicketPrioridade): Variant {
  return p === 'urgente' ? 'destructive' : p === 'alta' ? 'warning' : p === 'baixa' ? 'secondary' : 'default'
}

export function tempoRelativo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
