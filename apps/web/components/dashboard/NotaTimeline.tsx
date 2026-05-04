'use client'

import type { Nota } from '@/lib/types'

interface TimelineEvent {
  label: string
  date: string | null
  done: boolean
  error?: boolean
}

function buildTimeline(nota: Nota): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      label: 'Nota criada',
      date: nota.created_at,
      done: true,
    },
    {
      label: 'Enviada para a Receita Federal',
      date: nota.created_at,
      done: nota.status !== 'PROCESSANDO' || !!nota.protocolo_receita,
    },
  ]

  if (nota.status === 'AUTORIZADA') {
    events.push({
      label: 'Autorizada pela Receita',
      date: nota.emitida_em,
      done: true,
    })
    if (nota.webhook_url) {
      events.push({
        label: nota.webhook_entregue ? 'Webhook entregue' : 'Aguardando entrega do webhook',
        date: nota.emitida_em,
        done: nota.webhook_entregue,
      })
    }
  } else if (nota.status === 'REJEITADA') {
    events.push({
      label: `Rejeitada${nota.erro_codigo ? ` (código ${nota.erro_codigo})` : ''}`,
      date: nota.updated_at ?? nota.created_at,
      done: true,
      error: true,
    })
  } else if (nota.status === 'CANCELADA') {
    events.push({
      label: 'Autorizada pela Receita',
      date: nota.emitida_em,
      done: true,
    })
    events.push({
      label: 'Cancelada',
      date: nota.cancelada_em,
      done: true,
      error: true,
    })
  } else if (nota.status === 'ERRO_TEMPORARIO') {
    events.push({
      label: 'Erro temporário — aguardando retry',
      date: nota.updated_at ?? nota.created_at,
      done: true,
      error: true,
    })
  } else {
    // PROCESSANDO
    events.push({
      label: 'Aguardando resposta da Receita…',
      date: null,
      done: false,
    })
  }

  return events
}

function formatShort(iso: string | null) {
  if (!iso) return null
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

interface Props {
  nota: Nota
}

export default function NotaTimeline({ nota }: Props) {
  const events = buildTimeline(nota)

  return (
    <div className="rounded-xl border border-navy-600 overflow-hidden mb-6">
      <div className="bg-navy-700 px-5 py-3 border-b border-navy-600">
        <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wider">
          Linha do tempo
        </h2>
      </div>
      <ol className="px-5 py-4 space-y-0">
        {events.map((ev, idx) => {
          const isLast = idx === events.length - 1
          const dotColor = ev.error
            ? 'bg-nota-rejeitada'
            : ev.done
            ? 'bg-nota-autorizada'
            : 'bg-nota-processando animate-pulse'

          return (
            <li key={idx} className="relative flex gap-4">
              {/* Vertical connector */}
              {!isLast && (
                <span
                  className="absolute left-[9px] top-5 bottom-0 w-px bg-navy-600"
                  aria-hidden="true"
                />
              )}
              {/* Dot */}
              <span
                className={`mt-1 flex-none w-[18px] h-[18px] rounded-full border-2 border-navy-900 ${dotColor}`}
              />
              {/* Content */}
              <div className="pb-5 flex-1 min-w-0">
                <p
                  className={`text-sm font-medium leading-tight ${
                    ev.error
                      ? 'text-nota-rejeitada'
                      : ev.done
                      ? 'text-text-1'
                      : 'text-nota-processando'
                  }`}
                >
                  {ev.label}
                </p>
                {ev.date && (
                  <p className="text-xs text-text-2 mt-0.5">{formatShort(ev.date)}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
