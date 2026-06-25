export const metadata = { title: 'Painel' }

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { firstWord } from '@/lib/strings'
import StatusBadge from '@/components/ui/StatusBadge'
import OnboardingChecklist from '@/components/dashboard/OnboardingChecklist'
import { features, resolvePlanTier } from '@/lib/plan-tier'
import PrimeiraNotaCelebration from '@/components/dashboard/PrimeiraNotaCelebration'
import type { Nota, NotaStatus, EmissaoMensal } from '@/lib/types'
import { formatBRL } from '@/lib/format'

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

function currentCompetencia() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatCompetencia(comp: string) {
  const [year, month] = comp.split('-')
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${names[parseInt(month, 10) - 1]} ${year}`
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ── Empty state SVG ───────────────────────────────────────────────────────────
function EmptyState({ showDocs = true }: { showDocs?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-navy-600">
      {/* Cores theme-aware: claro vira tons de slate, escuro mantém navy. */}
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className="mb-6 opacity-90">
        <rect width="72" height="72" rx="16" className="fill-slate-100 dark:fill-navy-700" />
        <rect x="18" y="14" width="36" height="44" rx="4" className="fill-white dark:fill-navy-600" />
        <rect x="24" y="22" width="24" height="3" rx="1.5" className="fill-slate-300 dark:fill-text-2" />
        <rect x="24" y="30" width="18" height="3" rx="1.5" className="fill-slate-300 dark:fill-text-2" />
        <circle cx="50" cy="52" r="12" className="fill-white dark:fill-navy-900" />
        <circle cx="50" cy="52" r="10" fill="#00E8FF" opacity="0.15" stroke="#00E8FF" strokeWidth="1.5" />
        <path d="M46 52l3 3 5-5" stroke="#00E8FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h3 className="font-display text-xl font-bold mb-2">Tudo pronto para sua primeira emissão</h3>
      <p className="text-text-2 text-sm max-w-xs mb-6">
        Configure seu certificado A1 e emita sua primeira NFS-e em minutos.
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        <Link
          href="/notas/nova"
          className="bg-brand-cyan text-navy-900 font-semibold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition"
        >
          Emitir primeira nota
        </Link>
        {showDocs && (
          <a
            href="/docs/quickstart"
            className="border border-navy-600 text-text-2 font-semibold text-sm px-5 py-2.5 rounded-lg hover:border-brand-cyan hover:text-text-1 transition"
          >
            Ver documentação →
          </a>
        )}
      </div>
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function UsageBar({ pct }: { pct: number }) {
  const color = pct >= 100 ? 'bg-nota-rejeitada' : pct >= 80 ? 'bg-nota-processando' : 'bg-brand-cyan'
  return (
    <div className="h-2 rounded-full bg-navy-600 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function DashboardHome() {
  const supabase = createClient()
  // Use getUser() (validates JWT server-side) instead of getSession() (trusts client cookie)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const competencia = currentCompetencia()

  // Profile: try empresas first (ME/EPP), fall back to meis (MEI legacy)
  type ProfileData = {
    razao_social: string
    cert_valid_until: string | null
    tipo?: string | null
    inscricao_municipal?: string | null
  }
  const empresaProfile = await supabase
    .from('empresas')
    .select('razao_social, cert_valid_until, tipo, inscricao_municipal')
    .eq('user_id', user.id)
    .maybeSingle<ProfileData>()

  let profileData: ProfileData | null = empresaProfile.data ?? null
  if (!profileData) {
    const meiProfile = await supabase
      .from('meis')
      .select('razao_social, cert_valid_until')
      .eq('id', user.id)
      .single<ProfileData>()
    profileData = meiProfile.data ?? null
  }

  // Users in the `meis` table (legacy) or with tipo='MEI' are end-users, not API consumers
  const empresaTipo: 'MEI' | 'ME' | 'EPP' =
    (empresaProfile.data?.tipo as 'MEI' | 'ME' | 'EPP') ?? 'MEI'

  // Parallel fetches — RLS enforces isolation for both MEI and ME/EPP
  const [emissaoResult, notasResult, keyResult, firstAutorizadaResult, statusBreakdownResult] = await Promise.all([
    supabase
      .from('emissoes_mensais')
      .select('total_emitidas, renovacao_em, stripe_subscription_id, planos(nome, emissoes_limite)')
      .eq('competencia', competencia)
      .maybeSingle<EmissaoMensal>(),

    supabase
      .from('notas_fiscais')
      .select('id, numero_rps, status, tomador_nome, valor_servico, competencia, emitida_em, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
      .overrideTypes<Pick<Nota, 'id' | 'numero_rps' | 'status' | 'tomador_nome' | 'valor_servico' | 'competencia' | 'emitida_em' | 'created_at'>[]>(),

    supabase
      .from('api_keys')
      .select('key_prefix, label, created_at')
      .is('revoked_at', null)
      .limit(1)
      .maybeSingle<{ key_prefix: string; label: string | null; created_at: string }>(),

    // Uma nota CANCELADA precisou ser AUTORIZADA antes de ser cancelada — então
    // marca o passo "Primeira nota autorizada" como concluído nos dois casos.
    supabase
      .from('notas_fiscais')
      .select('id')
      .in('status', ['AUTORIZADA', 'CANCELADA'])
      .order('emitida_em', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle<{ id: string }>(),

    // Breakdown por status (mês atual) para mostrar no card de uso.
    supabase
      .from('notas_fiscais')
      .select('status')
      .eq('competencia', competencia)
      .overrideTypes<{ status: NotaStatus }[]>(),
  ])

  const mei = profileData
  const emissao = emissaoResult.data
  const notas = notasResult.data ?? []
  const apiKey = keyResult.data
  const firstAutorizada = firstAutorizadaResult.data

  // Usa o primeiro nome/palavra da razão social ou o prefixo do e-mail
  const rawName = mei?.razao_social || user.email?.split('@')[0] || 'você'
  const displayName = firstWord(rawName)

  const totalEmitidas = emissao?.total_emitidas ?? 0
  const limite = emissao?.planos?.emissoes_limite ?? 5
  const planoNome = emissao?.planos?.nome ?? 'Trial'
  const planTier = resolvePlanTier(planoNome)
  const usagePct = Math.min(100, Math.round((totalEmitidas / limite) * 100))

  // Breakdown por status (mês atual)
  const breakdown = (statusBreakdownResult.data ?? []).reduce<Record<string, number>>((acc, n) => {
    acc[n.status] = (acc[n.status] ?? 0) + 1
    return acc
  }, {})
  const nAutorizadas = (breakdown.AUTORIZADA ?? 0) + (breakdown.CANCELADA ?? 0)
  const nProcessando = breakdown.PROCESSANDO ?? 0
  const nRejeitadas = breakdown.REJEITADA ?? 0

  const certDays = daysUntil(mei?.cert_valid_until ?? null)
  const hasCert = !!mei?.cert_valid_until
  const hasNota = notas.length > 0 || totalEmitidas > 0
  const hasApiKey = !!apiKey
  const hasAuthorizedNota = !!firstAutorizada
  const hasInscricaoMunicipal = !!(empresaProfile.data?.inscricao_municipal ?? '').trim()
  // Show celebration only on first authorized nota (total === 1 means it just happened)
  const isFirstAutorized = hasAuthorizedNota && totalEmitidas === 1

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      {/* First nota celebration (confetti) */}
      {isFirstAutorized && <PrimeiraNotaCelebration />}

      {/* Greeting */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">
          Bom dia, {displayName}
        </h1>
        <p className="text-text-2 mt-1 text-sm">
          {formatCompetencia(competencia)} · Plano <span className="text-text-1 font-medium">{planoNome}</span>
        </p>
      </div>

      {/* Onboarding checklist — hidden once all steps are complete */}
      <OnboardingChecklist
        hasCert={hasCert}
        hasNota={hasNota}
        hasApiKey={hasApiKey}
        hasAuthorizedNota={hasAuthorizedNota}
        hasInscricaoMunicipal={hasInscricaoMunicipal}
        empresaTipo={empresaTipo}
        planTier={planTier}
      />

      {/* Certificate alert */}
      {certDays !== null && certDays <= 30 && (
        <div className={`mb-6 flex items-start gap-3 rounded-xl border p-4 ${
          certDays <= 0
            ? 'border-nota-rejeitada/40 bg-nota-rejeitada/10'
            : 'border-nota-processando/40 bg-nota-processando/10'
        }`}>
          <span className="text-xl shrink-0">{certDays <= 0 ? '🔴' : '⚠️'}</span>
          <div className="flex-1">
            <p className={`font-semibold text-sm ${certDays <= 0 ? 'text-nota-rejeitada' : 'text-nota-processando'}`}>
              {certDays <= 0
                ? 'Seu certificado A1 expirou'
                : `Certificado vence em ${certDays} dia${certDays !== 1 ? 's' : ''}`}
            </p>
            <p className="text-text-2 text-xs mt-0.5">
              Renove agora para continuar emitindo notas sem interrupção.
            </p>
          </div>
          <Link
            href="/configuracoes?aba=certificado"
            className="shrink-0 text-xs font-semibold bg-navy-700 border border-navy-600 px-3 py-1.5 rounded-lg hover:border-brand-cyan transition"
          >
            Renovar agora
          </Link>
        </div>
      )}

      {/* Top row: usage card + quick actions */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">

        {/* Usage card (2/3 width) */}
        <div className="lg:col-span-2 rounded-xl border border-navy-600 bg-navy-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-text-2 uppercase tracking-wider font-semibold">
              Uso do mês
            </p>
            <Link href="/billing" className="text-xs text-brand-cyan hover:underline">
              Ver histórico →
            </Link>
          </div>
          <p className="font-display text-2xl font-extrabold mb-1">
            {totalEmitidas}
            <span className="text-text-2 text-base font-normal"> / {limite} emissões</span>
          </p>
          <UsageBar pct={usagePct} />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-text-2">{usagePct}% utilizado</p>
            {emissao?.renovacao_em && (
              <p className="text-xs text-text-2">
                Renova em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(emissao.renovacao_em))}
              </p>
            )}
          </div>

          {/* Breakdown por status. Em TRIAL, todas (incluindo rejeitadas)
              consomem cota — backend incrementa em qualquer outcome. Em
              planos pagos, só AUTORIZADA conta. A pílula rejeitada
              continua sempre informativa. */}
          {(nAutorizadas + nProcessando + nRejeitadas) > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {nAutorizadas > 0 && (
                <span className="inline-flex items-center gap-1.5 bg-nota-autorizada/10 border border-nota-autorizada/30 text-nota-autorizada rounded-full px-2.5 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-nota-autorizada" />
                  {nAutorizadas} autorizada{nAutorizadas !== 1 ? 's' : ''}
                </span>
              )}
              {nProcessando > 0 && (
                <span className="inline-flex items-center gap-1.5 bg-nota-processando/10 border border-nota-processando/30 text-nota-processando rounded-full px-2.5 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-nota-processando animate-pulse" />
                  {nProcessando} processando
                </span>
              )}
              {nRejeitadas > 0 && (
                <span
                  className="inline-flex items-center gap-1.5 bg-nota-rejeitada/10 border border-nota-rejeitada/30 text-nota-rejeitada rounded-full px-2.5 py-0.5"
                  title={planTier === 'trial' ? 'Tentativas rejeitadas consomem cota no plano trial' : 'Rejeitadas não consomem cota'}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-nota-rejeitada" />
                  {nRejeitadas} rejeitada{nRejeitadas !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
          {planTier === 'trial' && nRejeitadas > 0 && (
            <p className="text-[11px] text-text-2 mt-2 italic">
              No plano grátis, tentativas rejeitadas também contam no limite.
            </p>
          )}
          {usagePct >= 80 && usagePct < 100 && (
            <p className="text-xs text-nota-processando mt-2">⚠️ Você está próximo do limite do plano.</p>
          )}
          {usagePct >= 100 && (
            <div className="mt-3 flex items-center gap-2">
              <p className="text-xs text-nota-rejeitada">Limite atingido.</p>
              <Link href="/billing" className="text-xs text-nota-upgrade font-semibold hover:underline">
                Fazer upgrade →
              </Link>
            </div>
          )}
        </div>

        {/* Quick actions (1/3 width) */}
        <div className="rounded-xl border border-navy-600 bg-navy-700 p-6 flex flex-col gap-3">
          <p className="text-xs text-text-2 uppercase tracking-wider font-semibold mb-1">
            Ações rápidas
          </p>
          <Link
            href="/notas/nova"
            className="w-full text-center bg-brand-cyan text-navy-900 font-semibold text-sm px-4 py-2.5 rounded-lg hover:opacity-90 transition"
          >
            + Emitir nova nota
          </Link>
          <Link
            href="/notas"
            className="w-full text-center border border-navy-600 text-text-1 font-semibold text-sm px-4 py-2.5 rounded-lg hover:border-brand-cyan transition"
          >
            Ver minhas notas
          </Link>
          <Link
            href="/configuracoes"
            className="w-full text-center border border-navy-600 text-text-2 font-semibold text-sm px-4 py-2.5 rounded-lg hover:border-brand-cyan hover:text-text-1 transition"
          >
            Configurações
          </Link>
        </div>
      </div>

      {/* Recent notes + API key row */}
      <div className={`grid ${empresaTipo !== 'MEI' ? 'lg:grid-cols-3' : ''} gap-6`}>

        {/* Last 5 notas (2/3 width for API users, full width for MEI) */}
        <div className={empresaTipo !== 'MEI' ? 'lg:col-span-2' : ''}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold">Últimas notas</h2>
            <Link href="/notas" className="text-xs text-brand-cyan hover:underline">
              Ver todas →
            </Link>
          </div>

          {notas.length === 0 ? (
            <EmptyState showDocs={empresaTipo !== 'MEI'} />
          ) : (
            <div className="rounded-xl border border-navy-600 overflow-hidden">
              {notas.map((n, i) => (
                <Link
                  key={n.id}
                  href={`/notas/${n.id}`}
                  className={`flex items-center gap-4 px-4 py-3 hover:bg-navy-700/60 transition-colors ${
                    i > 0 ? 'border-t border-navy-600' : ''
                  }`}
                >
                  <StatusBadge status={n.status as NotaStatus} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.tomador_nome ?? '—'}</p>
                    <p className="text-xs text-text-2">{n.competencia ?? '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono">{formatBRL(n.valor_servico)}</p>
                    <p className="text-xs text-text-2">{formatDate(n.emitida_em ?? n.created_at)}</p>
                  </div>
                  <span className="text-text-2 text-xs">→</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* API key card — só pra ME/EPP em plano Pro+. Trial e Starter não
            veem esse card (API/Webhook são features Pro). Quem quer integrar
            faz upgrade pelo /billing. */}
        {empresaTipo !== 'MEI' && features.canUseAPI(planTier) && (
          <div className="rounded-xl border border-navy-600 bg-navy-700 p-5">
            <p className="text-xs text-text-2 uppercase tracking-wider font-semibold mb-4">
              Integração via API
            </p>
            {apiKey ? (
              <>
                <div className="bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 mb-3">
                  <p className="text-xs text-text-2 mb-0.5">Sua API Key</p>
                  <p className="font-mono text-sm text-brand-cyan">
                    {apiKey.key_prefix}••••••••
                  </p>
                  {apiKey.label && (
                    <p className="text-xs text-text-2 mt-0.5">{apiKey.label}</p>
                  )}
                </div>
                <Link
                  href="/configuracoes?aba=api-keys"
                  className="block text-center text-xs text-text-2 hover:text-brand-cyan transition"
                >
                  Gerenciar API Keys →
                </Link>
              </>
            ) : (
              <>
                <p className="text-text-2 text-sm mb-4">
                  Integre sua aplicação à API REST para emitir notas automaticamente.
                </p>
                <Link
                  href="/configuracoes?aba=api-keys"
                  className="block w-full text-center text-sm font-semibold border border-brand-cyan text-brand-cyan px-4 py-2 rounded-lg hover:bg-brand-cyan/10 transition"
                >
                  Criar API Key
                </Link>
              </>
            )}
            <div className="mt-4 pt-4 border-t border-navy-600">
              <a
                href="/docs"
                className="block text-center text-xs text-text-2 hover:text-brand-cyan transition"
              >
                Ver documentação →
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
