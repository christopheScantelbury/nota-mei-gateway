import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { EmissaoMensal } from '@/lib/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.notameigateway.com.br'

function currentCompetencia() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatBRL(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const PLANOS = [
  { key: 'starter',  name: 'Starter',  limit: 10,   price: 'R$ 29/mês' },
  { key: 'basic',    name: 'Basic',     limit: 50,   price: 'R$ 79/mês' },
  { key: 'pro',      name: 'Pro',       limit: 200,  price: 'R$ 199/mês' },
  { key: 'business', name: 'Business',  limit: 1000, price: 'R$ 499/mês' },
]

export default async function BillingPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect('/')

  const competencia = currentCompetencia()

  // Current month usage + plan via join
  const { data: emissao } = await supabase
    .from('emissoes_mensais')
    .select(`
      id, mei_id, competencia, total_emitidas,
      stripe_subscription_id, stripe_subscription_status, renovacao_em,
      planos ( nome, emissoes_limite, preco_mensal_brl )
    `)
    .eq('mei_id', session.user.id)
    .eq('competencia', competencia)
    .single<EmissaoMensal>()

  const totalEmitidas = emissao?.total_emitidas ?? 0
  const limite = emissao?.planos?.emissoes_limite ?? 10 // default Trial
  const planoNome = emissao?.planos?.nome ?? 'Trial'
  const subStatus = emissao?.stripe_subscription_status
  const usagePct = Math.min(100, Math.round((totalEmitidas / limite) * 100))

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="font-display text-3xl font-extrabold mb-2">Plano & Faturamento</h1>
      <p className="text-text-2 text-sm mb-8">
        Competência atual: <span className="text-text-1 font-medium">{competencia}</span>
      </p>

      {/* Usage card */}
      <div className="rounded-xl border border-navy-600 bg-navy-700 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-text-2 uppercase tracking-wider font-semibold mb-1">
              Plano atual
            </p>
            <p className="font-display text-2xl font-extrabold">{planoNome}</p>
          </div>
          {subStatus && (
            <SubStatusBadge status={subStatus} />
          )}
        </div>

        <div className="mb-2 flex justify-between text-sm">
          <span className="text-text-2">Notas emitidas este mês</span>
          <span className="font-mono font-semibold">
            {totalEmitidas} / {limite}
          </span>
        </div>
        <div className="h-2 rounded-full bg-navy-600 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              usagePct >= 90
                ? 'bg-nota-rejeitada'
                : usagePct >= 70
                ? 'bg-nota-processando'
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
              {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(
                new Date(emissao.renovacao_em),
              )}
            </span>
          </p>
        )}
      </div>

      {/* Portal button — shown only when there's an active subscription */}
      {emissao?.stripe_subscription_id && (
        <div className="rounded-xl border border-navy-600 p-5 mb-6 flex items-center justify-between">
          <div>
            <p className="font-medium mb-0.5">Gerenciar assinatura</p>
            <p className="text-sm text-text-2">
              Altere o plano, método de pagamento ou cancele a assinatura.
            </p>
          </div>
          <a
            href={`${API_BASE}/v1/billing/portal`}
            className="shrink-0 ml-4 text-sm bg-navy-600 text-text-1 font-semibold px-4 py-2 rounded-lg hover:bg-navy-600/70 transition"
          >
            Abrir portal →
          </a>
        </div>
      )}

      {/* Plan cards */}
      <h2 className="font-display text-xl font-bold mb-4">
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
              <p className="text-sm text-text-2">Até {p.limit} notas / mês</p>
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
    active:    { label: 'Ativa',      cls: 'text-nota-autorizada border-nota-autorizada/30 bg-nota-autorizada/10' },
    past_due:  { label: 'Em atraso',  cls: 'text-nota-processando border-nota-processando/30 bg-nota-processando/10' },
    canceled:  { label: 'Cancelada',  cls: 'text-nota-cancelada border-nota-cancelada/30 bg-nota-cancelada/10' },
    trialing:  { label: 'Trial',      cls: 'text-brand-cyan border-brand-cyan/30 bg-brand-cyan/10' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'text-text-2 border-navy-600' }
  return (
    <span className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 ${cls}`}>
      {label}
    </span>
  )
}
