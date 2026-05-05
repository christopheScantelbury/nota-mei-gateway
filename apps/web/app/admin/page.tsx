export const metadata = { title: 'Visão Geral' }

import { createAdminClient } from '@/lib/supabase/admin'

function StatCard({
  label,
  value,
  sub,
  color = 'cyan',
}: {
  label: string
  value: string | number
  sub?: string
  color?: 'cyan' | 'green' | 'yellow' | 'purple'
}) {
  const colorMap = {
    cyan:   'text-brand-cyan',
    green:  'text-nota-autorizada',
    yellow: 'text-nota-processando',
    purple: 'text-nota-upgrade',
  }
  return (
    <div className="rounded-xl bg-navy-700 border border-navy-600 p-5">
      <p className="text-xs text-text-2 uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-display text-3xl font-extrabold ${colorMap[color]}`}>{value}</p>
      {sub && <p className="text-xs text-text-2 mt-1">{sub}</p>}
    </div>
  )
}

export default async function AdminPage() {
  const supabase = createAdminClient()

  // Queries paralelas para stats
  const [
    { count: totalMeis },
    { count: totalNotas },
    { count: notasAutorizadas },
    { count: notasHoje },
    { data: planosDist },
    { data: notasRecentes },
  ] = await Promise.all([
    supabase.from('meis').select('*', { count: 'exact', head: true }),
    supabase.from('notas_fiscais').select('*', { count: 'exact', head: true }),
    supabase.from('notas_fiscais').select('*', { count: 'exact', head: true }).eq('status', 'AUTORIZADA'),
    supabase.from('notas_fiscais').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    // Distribuição por plano via emissoes_mensais do mês atual
    supabase
      .from('emissoes_mensais')
      .select('planos(nome), total_emitidas')
      .eq('competencia', new Date().toISOString().slice(0, 7))
      .returns<{ planos: { nome: string } | null; total_emitidas: number }[]>(),
    // Últimas 10 notas (todos os MEIs)
    supabase
      .from('notas_fiscais')
      .select('id, mei_id, tomador_nome, valor_servico, status, created_at, meis(razao_social)')
      .order('created_at', { ascending: false })
      .limit(10)
      .returns<{
        id: string
        mei_id: string
        tomador_nome: string | null
        valor_servico: number | null
        status: string
        created_at: string
        meis: { razao_social: string } | null
      }[]>(),
  ])

  // Agrupa distribuição por plano
  const planCounts: Record<string, number> = {}
  for (const row of planosDist ?? []) {
    const nome = row.planos?.nome ?? 'Sem plano'
    planCounts[nome] = (planCounts[nome] ?? 0) + 1
  }

  const taxaAprovacao = totalNotas
    ? Math.round(((notasAutorizadas ?? 0) / totalNotas) * 100)
    : 0

  function formatBRL(v: number | null) {
    if (v == null) return '—'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  }

  function formatDate(iso: string) {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  }

  const STATUS_COLORS: Record<string, string> = {
    AUTORIZADA:     'text-nota-autorizada',
    PROCESSANDO:    'text-nota-processando',
    REJEITADA:      'text-nota-rejeitada',
    CANCELADA:      'text-nota-cancelada',
    ERRO_TEMPORARIO:'text-nota-processando',
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold text-text-1">Visão Geral</h1>
        <p className="text-text-2 mt-1 text-sm">Métricas globais da plataforma.</p>
      </div>

      {/* Cards de stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="MEIs cadastrados"  value={totalMeis ?? 0}          color="cyan"   />
        <StatCard label="Notas emitidas"    value={totalNotas ?? 0}          color="green"  />
        <StatCard label="Notas hoje"        value={notasHoje ?? 0}           color="yellow" />
        <StatCard label="Taxa de aprovação" value={`${taxaAprovacao}%`}      color="purple"
          sub={`${notasAutorizadas ?? 0} autorizadas`} />
      </div>

      {/* Distribuição por plano */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl bg-navy-700 border border-navy-600 p-5">
          <h2 className="font-semibold text-sm text-text-1 mb-4">Distribuição por Plano (mês atual)</h2>
          {Object.keys(planCounts).length === 0 ? (
            <p className="text-text-2 text-sm">Nenhum dado disponível.</p>
          ) : (
            <div className="space-y-3">
              {(['Trial', 'Starter', 'Basic', 'Pro', 'Business'] as const).map((plano) => {
                const count = planCounts[plano] ?? 0
                const total = Object.values(planCounts).reduce((a, b) => a + b, 0)
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={plano} className="flex items-center gap-3">
                    <span className="text-xs text-text-2 w-20 shrink-0">{plano}</span>
                    <div className="flex-1 h-2 bg-navy-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-cyan rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-text-2 w-12 text-right">{count} ({pct}%)</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Links rápidos */}
        <div className="rounded-xl bg-navy-700 border border-navy-600 p-5">
          <h2 className="font-semibold text-sm text-text-1 mb-4">Ações rápidas</h2>
          <div className="space-y-2">
            {[
              { href: '/admin/usuarios', label: 'Gerenciar usuários e planos', icon: '👥' },
              { href: '/admin/notas',    label: 'Ver todas as notas fiscais',   icon: '🧾' },
            ].map(({ href, label, icon }) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-navy-600 hover:border-brand-cyan hover:text-brand-cyan transition-colors text-sm text-text-2"
              >
                <span>{icon}</span>
                <span>{label}</span>
                <span className="ml-auto">→</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Últimas notas */}
      <div className="rounded-xl bg-navy-700 border border-navy-600 overflow-hidden">
        <div className="px-5 py-4 border-b border-navy-600">
          <h2 className="font-semibold text-sm text-text-1">Últimas 10 notas (todos os MEIs)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-600 text-xs text-text-2 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">MEI</th>
                <th className="px-4 py-3 text-left">Tomador</th>
                <th className="px-4 py-3 text-left">Valor</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Data</th>
              </tr>
            </thead>
            <tbody>
              {(notasRecentes ?? []).map((nota) => (
                <tr key={nota.id} className="border-b border-navy-600 last:border-0 hover:bg-navy-600/30 transition-colors">
                  <td className="px-4 py-3 text-text-2 max-w-[140px] truncate">{nota.meis?.razao_social ?? '—'}</td>
                  <td className="px-4 py-3 max-w-[160px] truncate">{nota.tomador_nome ?? '—'}</td>
                  <td className="px-4 py-3 font-mono">{formatBRL(nota.valor_servico)}</td>
                  <td className={`px-4 py-3 font-semibold ${STATUS_COLORS[nota.status] ?? 'text-text-2'}`}>
                    {nota.status}
                  </td>
                  <td className="px-4 py-3 text-text-2 whitespace-nowrap">{formatDate(nota.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
