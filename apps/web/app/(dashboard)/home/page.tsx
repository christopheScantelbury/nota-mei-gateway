export const metadata = { title: 'Painel' }

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { firstWord } from '@/lib/strings'
import StatusBadge from '@/components/ui/StatusBadge'
import OnboardingChecklist from '@/components/dashboard/OnboardingChecklist'
import PrimeiraNotaCelebration from '@/components/dashboard/PrimeiraNotaCelebration'
import type { Nota, NotaStatus, EmissaoMensal } from '@/lib/types'

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatBRL(value: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

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
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-navy-600">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className="mb-6 opacity-70">
        <rect width="72" height="72" rx="16" fill="#142035" />
        <rect x="18" y="14" width="36" height="44" rx="4" fill="#1E3050" />
        <rect x="24" y="22" width="24" height="3" rx="1.5" fill="#8AA0B8" />
        <rect x="24" y="30" width="18" height="3" rx="1.5" fill="#8AA0B8" />
        <circle cx="50" cy="52" r="12" fill="#0A0F1E" />
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
        <a
          href="/docs/quickstart"
          className="border border-navy-600 text-text-2 font-semibold text-sm px-5 py-2.5 rounded-lg hover:border-brand-cyan hover:text-text-1 transition"
        >
          Ver documentação →
        </a>
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

  // Parallel fetches
  const [meiResult, emissaoResult, notasResult, keyResult, firstAutorizadaResult] = await Promise.all([
    supabase
      .from('meis')
      .select('razao_social, cert_valid_until')
      .eq('id', user.id)
      .single<{ razao_social: string; cert_valid_until: string | null }>(),

    supabase
      .from('emissoes_mensais')
      .select('total_emitidas, renovacao_em, stripe_subscription_id, planos(nome, emissoes_limite)')
      .eq('competencia', competencia)
      .single<EmissaoMensal>(),

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
      .single<{ key_prefix: string; label: string | null; created_at: string }>(),

    supabase
      .from('notas_fiscais')
      .select('id')
      .eq('status', 'AUTORIZADA')
      .order('emitida_em', { ascending: true })
      .limit(1)
      .single<{ id: string }>(),
  ])

  const mei = meiResult.data
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
  const usagePct = Math.min(100, Math.round((totalEmitidas / limite) * 100))

  const certDays = daysUntil(mei?.cert_valid_until ?? null)
  const hasCert = !!mei?.cert_valid_until
  const hasNota = notas.length > 0 || totalEmitidas > 0
  const hasApiKey = !!apiKey
  const hasAuthorizedNota = !!firstAutorizada
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
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Last 5 notas (2/3 width) */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold">Últimas notas</h2>
            <Link href="/notas" className="text-xs text-brand-cyan hover:underline">
              Ver todas →
            </Link>
          </div>

          {notas.length === 0 ? (
            <EmptyState />
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

        {/* API key card (1/3 width) */}
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

      </div>
    </div>
  )
}
