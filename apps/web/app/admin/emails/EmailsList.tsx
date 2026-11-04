'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import notify from '@/lib/notify'

export interface EmailRow {
  id: string
  tipo: string
  destino_dominio: string | null
  status: 'pendente' | 'enviado' | 'falhou'
  tentativas: number
  proxima_tentativa_em: string | null
  ultimo_erro: string | null
  provedor: string | null
  nota_id: string | null
  created_at: string
  enviado_em: string | null
}

const TIPO: Record<string, string> = {
  nota_tomador: 'Nota para o tomador',
  nota_autorizada: 'Nota autorizada (emissor)',
  nota_rejeitada: 'Nota rejeitada (emissor)',
  boas_vindas: 'Boas-vindas MEI',
  boas_vindas_me: 'Boas-vindas ME/EPP',
  pagamento_falhou: 'Pagamento falhou',
}

const STATUS_CLS: Record<EmailRow['status'], string> = {
  enviado: 'bg-nota-autorizada/10 text-nota-autorizada',
  pendente: 'bg-nota-processando/10 text-nota-processando',
  falhou: 'bg-nota-rejeitada/10 text-nota-rejeitada',
}

function dataHora(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
}

export default function EmailsList({ items, filtro, canWrite }: { items: EmailRow[]; filtro: string; canWrite: boolean }) {
  const router = useRouter()
  const [enviando, setEnviando] = useState<string | null>(null)

  async function reenviar(ids: string[], rotulo: string) {
    if (!ids.length) return
    setEnviando(rotulo)
    try {
      const res = await fetch('/admin/api/emails/reenviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message ?? 'Falha ao reenviar')
      notify.success('Reenvio agendado', `${data.reenfileirados} e-mail(s) voltam para a fila e saem em até 1 minuto.`)
      router.refresh()
    } catch (e) {
      notify.error('Não foi possível reenviar', (e as Error).message)
    } finally {
      setEnviando(null)
    }
  }

  const falhas = items.filter((i) => i.status === 'falhou').map((i) => i.id)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[
          ['problemas', 'Na fila + falharam'],
          ['enviado', 'Enviados'],
          ['todos', 'Todos'],
        ].map(([f, label]) => (
          <Link
            key={f}
            href={`/admin/emails?f=${f}`}
            className={`text-sm px-3 py-1.5 rounded-lg border transition ${
              filtro === f ? 'border-brand-cyan text-brand-cyan' : 'border-navy-600 text-text-2 hover:text-text-1'
            }`}
          >
            {label}
          </Link>
        ))}
        {canWrite && falhas.length > 0 && (
          <button
            onClick={() => reenviar(falhas, 'todos')}
            disabled={enviando !== null}
            className="ml-auto text-sm px-3 py-1.5 rounded-lg bg-brand-cyan text-navy-900 font-semibold disabled:opacity-50"
          >
            {enviando === 'todos' ? 'Reenviando…' : `Reenviar todos que falharam (${falhas.length})`}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-text-2 rounded-xl border border-navy-600 p-6 text-center">
          {filtro === 'problemas' ? 'Nenhum e-mail na fila nem com falha. 🎉' : 'Nenhum e-mail.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-navy-600">
          <table className="w-full text-sm">
            <thead className="bg-navy-700 text-text-2 text-xs text-left">
              <tr>
                <th className="px-3 py-2">Criado</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Destino</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Tentativas</th>
                <th className="px-3 py-2">Detalhe</th>
                {canWrite && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-t border-navy-600 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{dataHora(e.created_at)}</td>
                  <td className="px-3 py-2">
                    {TIPO[e.tipo] ?? e.tipo}
                    {e.nota_id && (
                      <Link href={`/admin/notas?q=${e.nota_id}`} className="block text-xs text-brand-cyan hover:underline">
                        ver nota
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">@{e.destino_dominio ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${STATUS_CLS[e.status]}`}>{e.status}</span>
                  </td>
                  <td className="px-3 py-2">{e.tentativas}</td>
                  <td className="px-3 py-2 text-xs text-text-2 max-w-md">
                    {e.status === 'enviado' && <>Enviado {dataHora(e.enviado_em)} via {e.provedor}</>}
                    {e.status === 'pendente' && <>Próxima tentativa {dataHora(e.proxima_tentativa_em)}</>}
                    {e.ultimo_erro && e.status !== 'enviado' && (
                      <span className="block break-words text-nota-rejeitada/80">{e.ultimo_erro}</span>
                    )}
                  </td>
                  {canWrite && (
                    <td className="px-3 py-2">
                      <button
                        onClick={() => {
                          if (e.status === 'enviado' && !confirm('Este e-mail já foi entregue. Enviar de novo?')) return
                          void reenviar([e.id], e.id)
                        }}
                        disabled={enviando !== null}
                        className="text-xs px-2.5 py-1 rounded-lg border border-navy-600 hover:border-brand-cyan hover:text-brand-cyan disabled:opacity-50 whitespace-nowrap"
                      >
                        {enviando === e.id ? '…' : 'Reenviar'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
