import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { EmissaoMensal } from '@/lib/types'
import UsageChart from '@/components/dashboard/UsageChart'
import InvoiceList from '@/components/dashboard/InvoiceList'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.notameigateway.com.br'

function currentCompetencia() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatBRL(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatCompetenciaShort(comp: string) {
  const [year, month] = comp.split('-')
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${names[parseInt(month, 10) - 1]}/${year.slice(2)}`
}

/** Generate last N months as "AAAA-MM" strings (most recent first) */
function lastMonths(n: number): string[] {
  const result: string[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

const PLANOS = [
  { key: 'starter',  name: 'Starter',  limit: 50,   price: 'R$ 29/mês'  },
  { key: 'basic',    name: 'Basic',     limit: 200,  price: 'R$ 59/mês'  },
  { key: 'pro',      name: 'Pro',       limit: 500,  price: 'R$ 119/mês' },
  { key: 'business', name: 'Business',  limit: 2000, price: 'R$ 249/mês' },
]

interface HistoricoRow {
  competencia: string
  plano_nome: string
  total_emitidas: number
  emissoes_limite: number
}

export default async function BillingPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/')

  const competencia = currentCompetencia()
  const months6 = lastMonths(6)

  // Parallel fetches
  const [emissaoResult, historico6Result] = await Promise.all([
    // Current month
    supabase
      .from('emissoes_mensais')
      .select(`
        id, mei_id, competencia, total_emitidas,
        stripe_subscription_id, stripe_subscription_status, renovacao_em,
        planos ( nome, emissoes_limite, preco_mensal_brl )
      `)
      .eq('mei_id', session.user.id)
      .eq('competencia', competencia)
      .single<EmissaoMensal>(),

    // Last 6 months for chart + history table
    supabase
      .from('emissoes_mensais')
      .select('competencia, total_emitidas, planos(nome, emissoes_limite)')
      .eq('mei_id', session.user.id)
      .in('competencia', months6)
      .order('competencia', { ascending: false })
      .returns<{ competencia: string; total_emitidas: number; planos: { nome: string; emissoes_limite: number } | null }[]>(),
  ])

  const emissao       = emissaoResult.data
  const historico6    = historico6Result.data ?? []

  const totalEmitidas = emissao?.total_emitidas ?? 0
  const limite        = emissao?.planos?.emissoes_limite ?? 5
  const planoNome     = emissao?.planos?.nome ?? 'Trial'
  const subStatus     = emissao?.stripe_subscription_status
  const usagePct      = Math.min(100, Math.round((totalEmitidas / limite) * 100))

  // Build chart data (last 6 months, oldest→newest for left-to-right display)
  const histMap = new Map(historico6.map(r => [r.competencia, r]))
  const chartData = [...months6].reverse().map(m => {
    const row = histMap.get(m)
    return {
      mes:      formatCompetenciaShort(m),
      emitidas: row?.total_emitidas ?? 0,
      limite:   row?.planos?.emissoes_limite ?? limite,
    }
  })

  // History table (sorted newest first)
  const historyRows: HistoricoRow[] = historico6.map(r => ({
    competencia:    r.competencia,
    plano_nome:     r.planos?.nome ?? '—',
    total_emitidas: r.total_emitidas,
    emissoes_limite: r.planos?.emissoes_limite ?? 0,
  }))

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display text-3xl font-extrabold mb-2">Plano &amp; Faturamento</h1>
      <p className="text-text-2 text-sm mb-8">
        Competência atual: <span className="text-text-1 font-medium">{competencia}</span>
      </p>

      {/* Usage card */}
      <div className="rounded-xl border border-navy-600 bg-navy-700 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-text-2 uppercase tracking-wider font-semibold mb-1">Plano atual</p>
            <p className="font-display text-2xl font-extrabold">{planoNome}</p>
          </div>
          {subStatus && <SubStatusBadge status={subStatus} />}
        </div>
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-text-2">Notas emitidas este mês</span>
          <span className="font-mono font-semibold">{totalEmitidas} / {limite}</span>
        </div>
        <div className="h-2 rounded-full bg-navy-600 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              usagePct >= 100 ? 'bg-nota-rejeitada'
              : usagePct >= 80 ? 'bg-nota-processando'
              : 'bg-brand-cyan'
            }`}
            style={{ width: `${usagePct}%` }}
          />
        </div>
        <p className="text-xs text-text-2 mt-1.5">{usagePct}% do limite mensal utilizado</p>
        {emissao?.renovacao_em && (
          <p className="text-xs text-text-2 mt-3">
            Renova em{' '}
            <span className="text-text-1">
              {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(emissao.renovacao_em))}
            </span>
          </p>
        )}
        {usagePct >= 100 && (
          <p className="text-xs text-nota-rejeitada mt-2">
            🔴 Limite atingido. <a href="/billing#planos" className="underline text-nota-upgrade">Faça upgrade</a> para continuar emitindo.
          </p>
        )}
      </div>

      {/* Portal button */}
      {emissao?.stripe_subscription_id && (
        <div className="rounded-xl border border-navy-600 p-5 mb-6 flex items-center justify-between">
          <div>
            <p className="font-medium mb-0.5">Gerenciar assinatura</p>
            <p className="text-sm text-text-2">Altere o plano, método de pagamento ou cancele.</p>
          </div>
          <a
            href="/api/billing/portal"
            className="shrink-0 ml-4 text-sm bg-navy-600 text-text-1 font-semibold px-4 py-2 rounded-lg hover:bg-navy-600/70 transition"
          >
            Gerenciar Plano →
          </a>
        </div>
      )}

      {/* Usage chart — last 6 months */}
      <div className="rounded-xl border border-navy-600 bg-navy-700 p-6 mb-6">
        <h2 className="font-display text-lg font-bold mb-1">Emissões nos últimos 6 meses</h2>
        <p className="text-xs text-text-2 mb-4">Linha tracejada = limite do plano</p>
        {chartData.every(d => d.emitidas === 0) ? (
          <div className="flex items-center justify-center h-32 text-text-2 text-sm">
            Nenhuma emissão registrada nos últimos 6 meses.
          </div>
        ) : (
          <UsageChart data={chartData} />
        )}
      </div>

      {/* History table */}
      {historyRows.length > 0 && (
        <div className="rounded-xl border border-navy-600 overflow-hidden mb-8">
          <div className="bg-navy-700 px-5 py-3 border-b border-navy-600">
            <h2 className="font-display text-base font-bold">Histórico por competência</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-600">
                {['Competência', 'Plano', 'Emitidas', 'Limite', 'Utilizado'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historyRows.map((r, i) => {
                const pct = r.emissoes_limite > 0 ? Math.min(100, Math.round((r.total_emitidas / r.emissoes_limite) * 100)) : 0
                return (
                  <tr key={r.competencia} className={`border-b border-navy-600 last:border-0 ${i % 2 === 0 ? '' : 'bg-navy-700/30'}`}>
                    <td className="px-4 py-3 font-mono text-brand-cyan text-sm">{r.competencia}</td>
                    <td className="px-4 py-3 text-text-2">{r.plano_nome}</td>
                    <td className="px-4 py-3 font-mono">{r.total_emitidas}</td>
                    <td className="px-4 py-3 font-mono text-text-2">{r.emissoes_limite}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-navy-600 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? 'bg-nota-rejeitada' : pct >= 80 ? 'bg-nota-processando' : 'bg-brand-cyan'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-2">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Stripe invoices — client component, loads async */}
      {emissao?.stripe_subscription_id && <InvoiceList />}

      {/* Plan cards */}
      <h2 className="font-display text-xl font-bold mb-4" id="planos">
        {emissao?.stripe_subscription_id ? 'Alterar plano' : 'Escolha seu plano'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PLANOS.map((p) => {
          const isCurrent = p.name.toLowerCase() === planoNome.toLowerCase()
          return (
            <div
              key={p.key}
              className={`rounded-xl border p-5 flex flex-col gap-3 transition ${
                isCurrent
                  ? 'border-brand-cyan bg-brand-cyan/5'
                  : 'border-navy-600 hover:border-navy-600/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold">{p.name}</p>
                {isCurrent && (
                  <span className="text-xs text-brand-cyan font-semibold border border-brand-cyan/30 rounded-full px-2 py-0.5">
                    Atual
                  </span>
                )}
              </div>
              <p className="text-2xl font-display font-extrabold">{p.price}</p>
              <p className="text-sm text-text-2">Até {p.limit.toLocaleString('pt-BR')} notas / mês</p>
              {!isCurrent && (
                <a
                  href={`${API_BASE}/v1/billing/checkout?plano=${p.key}`}
                  className="mt-auto text-center text-sm bg-nota-upgrade/10 text-nota-upgrade border border-nota-upgrade/30 font-semibold px-4 py-2 rounded-lg hover:bg-nota-upgrade/20 transition"
                >
                  Assinar {p.name}
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SubStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:   { label: 'Ativa',     cls: 'text-nota-autorizada border-nota-autorizada/30 bg-nota-autorizada/10'   },
    past_due: { label: 'Em atraso', cls: 'text-nota-processando border-nota-processando/30 bg-nota-processando/10' },
    canceled: { label: 'Cancelada', cls: 'text-nota-cancelada border-nota-cancelada/30 bg-nota-cancelada/10'       },
    trialing: { label: 'Trial',     cls: 'text-brand-cyan border-brand-cyan/30 bg-brand-cyan/10'                   },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'text-text-2 border-navy-600' }
  return (
    <span className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 ${cls}`}>
      {label}
    </span>
  )
}
