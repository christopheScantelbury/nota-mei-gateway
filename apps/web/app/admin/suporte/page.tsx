import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canRead, getAdminContext } from '@/lib/admin/permissions'
import { Badge } from '@/components/ui/Badge'
import { PRIORIDADE_LABEL, STATUS_LABEL, type SupportTicket, type TicketStatus } from '@/lib/suporte/types'
import { prioridadeVariant, statusVariant, tempoRelativo } from './ui'

export const metadata = { title: 'Suporte' }
export const dynamic = 'force-dynamic'

type Row = SupportTicket & { empresas: { razao_social: string } | null }

const FILTROS: { key: string; label: string; status: TicketStatus[] | null }[] = [
  { key: 'abertos',            label: 'Abertos',              status: ['aguardando_humano', 'aguardando_cliente', 'ia'] },
  { key: 'aguardando_humano',  label: 'Aguardando atendente', status: ['aguardando_humano'] },
  { key: 'aguardando_cliente', label: 'Aguardando cliente',   status: ['aguardando_cliente'] },
  { key: 'ia',                 label: 'Com a IA',             status: ['ia'] },
  { key: 'resolvido',          label: 'Resolvidos',           status: ['resolvido'] },
  { key: 'todos',              label: 'Todos',                status: null },
]

export default async function SuportePage({ searchParams }: { searchParams: { f?: string } }) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const ctx = await getAdminContext(user.id, sb)
  if (!canRead(ctx, '/admin/suporte')) redirect('/admin')

  const filtro = FILTROS.find((f) => f.key === searchParams.f) ?? FILTROS[0]
  const admin = createAdminClient()

  let q = admin
    .from('support_tickets')
    .select('id, empresa_id, user_id, status, prioridade, assunto, resumo, motivo_escalada, assumido_por, ai_input_tokens, ai_output_tokens, ai_cache_read_tokens, ai_custo_usd, ultima_mensagem_em, ultima_mensagem_autor, resolvido_em, created_at, empresas(razao_social)')
    .order('ultima_mensagem_em', { ascending: false })
    .limit(200)
  if (filtro.status) q = q.in('status', filtro.status)
  const { data: rows } = await q.returns<Row[]>()

  // Contadores para as abas
  const { data: todos } = await admin.from('support_tickets').select('status').neq('status', 'resolvido')
  const contagem = new Map<string, number>()
  for (const t of todos ?? []) contagem.set(t.status, (contagem.get(t.status) ?? 0) + 1)
  const abertos = (todos ?? []).length

  const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emails = new Map((usersList?.users ?? []).map((u) => [u.id, u.email ?? '']))

  const custoMes = (rows ?? []).reduce((s, r) => s + Number(r.ai_custo_usd ?? 0), 0)
  const urgentes = (rows ?? []).filter((r) => r.status === 'aguardando_humano').sort((a, b) => {
    const p = { urgente: 0, alta: 1, normal: 2, baixa: 3 }
    return p[a.prioridade] - p[b.prioridade]
  })
  const lista = [...urgentes, ...(rows ?? []).filter((r) => r.status !== 'aguardando_humano')]

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold mb-1">Suporte</h1>
          <p className="text-text-2 text-sm">
            Conversas do chat &quot;Ajuda&quot;. A IA atende primeiro e transfere para cá quando precisa de pessoa.
          </p>
        </div>
        <Link
          href="/admin/suporte/conhecimento"
          className="px-4 py-2 rounded-lg border border-navy-600 text-sm hover:border-brand-cyan/50"
        >
          📚 Base de conhecimento da IA
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTROS.map((f) => {
          const n = f.key === 'abertos' ? abertos : f.status?.length === 1 && f.key !== 'resolvido' ? contagem.get(f.status[0]) ?? 0 : null
          const ativo = f.key === filtro.key
          return (
            <Link
              key={f.key}
              href={`/admin/suporte?f=${f.key}`}
              className={`px-3 py-1.5 rounded-full text-sm border ${ativo ? 'border-brand-cyan bg-brand-cyan/10 text-text-1' : 'border-navy-600 text-text-2 hover:text-text-1'}`}
            >
              {f.label}{n !== null ? ` (${n})` : ''}
            </Link>
          )
        })}
      </div>

      <div className="overflow-x-auto rounded-xl border border-navy-600">
        <table className="w-full text-sm">
          <thead className="bg-navy-700 text-text-2 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Prioridade</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Assunto</th>
              <th className="px-3 py-2 font-medium">Última mensagem</th>
              <th className="px-3 py-2 font-medium text-right">IA (US$)</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((t) => (
              <tr key={t.id} className="border-t border-navy-600 hover:bg-navy-700/50">
                <td className="px-3 py-2 whitespace-nowrap">
                  <Badge variant={statusVariant(t.status)}>{STATUS_LABEL[t.status]}</Badge>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Badge variant={prioridadeVariant(t.prioridade)}>{PRIORIDADE_LABEL[t.prioridade]}</Badge>
                </td>
                <td className="px-3 py-2">
                  <p className="text-text-1">{t.empresas?.razao_social ?? '—'}</p>
                  <p className="text-xs text-text-2">{emails.get(t.user_id) ?? t.user_id.slice(0, 8)}</p>
                </td>
                <td className="px-3 py-2 max-w-xs">
                  <Link href={`/admin/suporte/${t.id}`} className="text-brand-cyan hover:underline line-clamp-2">
                    {t.assunto ?? '(sem assunto)'}
                  </Link>
                  {t.motivo_escalada && <p className="text-xs text-text-2 line-clamp-1">{t.motivo_escalada}</p>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-text-2">
                  {tempoRelativo(t.ultima_mensagem_em)}
                  <span className="block text-xs">{t.ultima_mensagem_autor ?? ''}</span>
                </td>
                <td className="px-3 py-2 text-right text-text-2 tabular-nums">{Number(t.ai_custo_usd).toFixed(3)}</td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-text-2">Nenhum chamado neste filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-2 mt-3">Custo de IA dos chamados listados: US$ {custoMes.toFixed(2)}</p>
    </div>
  )
}
