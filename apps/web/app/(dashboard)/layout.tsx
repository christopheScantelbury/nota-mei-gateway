import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'
import { resolvePlanTier } from '@/lib/plan-tier'
import NotificationBell from '@/components/dashboard/NotificationBell'
import FeedbackButton from '@/components/dashboard/FeedbackButton'
import type { MEI } from '@/lib/types'

// ── Types ────────────────────────────────────────────────────────────────────

type EmpresaTipo = 'MEI' | 'ME' | 'EPP'

type EmpresaRow = {
  id: string
  tipo: EmpresaTipo
  razao_social: string
  cnpj: string
  regime_tributario: string | null
  trial_me: boolean | null
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let product = 'NotaFácil'
  if (user) {
    // Try empresas first (new multi-produto schema)
    const { data: empresa } = await supabase
      .from('empresas')
      .select('tipo')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (empresa?.tipo === 'MEI') {
      product = 'Nota Fácil MEI'
    } else if (!empresa) {
      // Legacy: check meis table
      const { data: mei } = await supabase
        .from('meis')
        .select('tipo_usuario')
        .eq('id', user.id)
        .single<Pick<MEI, 'tipo_usuario'>>()
      if (mei?.tipo_usuario === 'mei') product = 'Nota Fácil MEI'
    }
  }

  return {
    title: { default: `Painel — ${product}`, template: `%s — ${product}` },
  }
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const isAdmin = user.app_metadata?.role === 'admin'

  // ── Try new multi-empresa path (requires 20260620000001_multi_produto migration) ──
  const { data: empresas } = await supabase
    .from('empresas')
    .select('id, tipo, razao_social, cnpj, regime_tributario, trial_me')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (empresas && empresas.length > 0) {
    // Multi-empresa: resolve active company
    let empresaAtiva: EmpresaRow

    if (empresas.length === 1) {
      empresaAtiva = empresas[0] as EmpresaRow
    } else {
      // Check saved preference
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('empresa_id')
        .eq('user_id', user.id)
        .maybeSingle()

      const preferred = prefs?.empresa_id
        ? (empresas as EmpresaRow[]).find((e) => e.id === prefs.empresa_id)
        : null

      if (!preferred) redirect('/seletor-empresa')

      empresaAtiva = preferred!
    }

    // Resolve plan tier pra plan-gating (sidebar nav, etc).
    const competencia = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`
    const { data: planoData } = await supabase
      .from('emissoes_mensais')
      .select('planos(nome)')
      .eq('empresa_id', empresaAtiva.id)
      .eq('competencia', competencia)
      .maybeSingle<{ planos: { nome: string } | null }>()
    const planTier = resolvePlanTier(planoData?.planos?.nome)

    return (
      <div className="min-h-screen bg-navy-900 text-text-1 font-body lg:flex">
        <Sidebar
          razaoSocial={empresaAtiva.razao_social}
          isAdmin={isAdmin}
          empresaTipo={empresaAtiva.tipo}
          planTier={planTier}
          empresaAtiva={{
            id: empresaAtiva.id,
            tipo: empresaAtiva.tipo,
            razao_social: empresaAtiva.razao_social,
          }}
          todasEmpresas={(empresas as EmpresaRow[]).map((e) => ({
            id: e.id,
            tipo: e.tipo,
            razao_social: e.razao_social,
          }))}
          notificationBell={<NotificationBell />}
        />
        <main
          id="main-content"
          className="flex-1 overflow-auto pt-14 lg:pt-0 pb-8"
          tabIndex={-1}
        >
          {children}
        </main>
        <FeedbackButton />
      </div>
    )
  }

  // ── Legacy fallback: meis table (pre-migration MEI/Gateway users) ──
  const { data: mei } = await supabase
    .from('meis')
    .select('id, cnpj, razao_social, email, municipio_ibge, stripe_customer_id, tipo_usuario')
    .eq('id', user.id)
    .single<MEI>()

  if (!mei) {
    // Bug 2026-06-05: dev accounts (criados via /cadastro/dev) têm
    // auth.users com user_metadata.is_dev_account=true mas SEM empresa nem
    // mei correspondente. Antes caíamos no redirect('/cadastro') aqui,
    // mandando o user pro CadastroSeletor de novo — UX confusa pois ele
    // já tinha cadastrado. Agora renderizamos o dashboard "gateway" como
    // fallback: ele vê API Keys/Sandbox/Docs/Configurações imediatamente,
    // e pode cadastrar uma empresa real depois pra emitir notas em prod.
    const isDevAccount = user.user_metadata?.is_dev_account === true
    if (isDevAccount) {
      const nome =
        (user.user_metadata?.nome as string | undefined) ??
        user.email ??
        'Conta de desenvolvedor'
      return (
        <div className="min-h-screen bg-navy-900 text-text-1 font-body lg:flex">
          <Sidebar
            razaoSocial={nome}
            isAdmin={isAdmin}
            // Reaproveita o tier 'EPP' do filtro de NAV pra liberar
            // API Keys + Webhooks. Quando o dev cadastrar uma empresa,
            // o tipo real toma o lugar deste fallback.
            empresaTipo="EPP"
            tipoUsuario="gateway"
            notificationBell={<NotificationBell />}
          />
          <main
            id="main-content"
            className="flex-1 overflow-auto pt-14 lg:pt-0 pb-8"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      )
    }
    redirect('/cadastro')
  }

  const razaoSocial = mei.razao_social ?? user.email ?? 'Meu painel'
  const tipoUsuario: 'mei' | 'gateway' = mei.tipo_usuario ?? 'gateway'

  return (
    <div className="min-h-screen bg-navy-900 text-text-1 font-body lg:flex">
      <Sidebar
        razaoSocial={razaoSocial}
        isAdmin={isAdmin}
        tipoUsuario={tipoUsuario}
        notificationBell={<NotificationBell />}
      />
      <main
        id="main-content"
        className="flex-1 overflow-auto pt-14 lg:pt-0 pb-8"
        tabIndex={-1}
      >
        {children}
      </main>
      <FeedbackButton />
    </div>
  )
}
