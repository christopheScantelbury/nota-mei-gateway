import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import TemplatesList from './TemplatesList'
import type { NotaTemplate } from '@/app/api/templates/route'

export const metadata: Metadata = {
  title: 'Templates de nota',
}

/** Plans that unlock the Templates feature */
const PRO_PLANS = ['pro', 'business']

function isPlanPro(nome: string | undefined): boolean {
  return PRO_PLANS.includes((nome ?? '').toLowerCase())
}

// ── Plan guard ────────────────────────────────────────────────────────────────
function PlanGuard({ currentPlan }: { currentPlan: string }) {
  return (
    <div className="p-4 sm:p-8 max-w-xl">
      <div className="rounded-xl border border-nota-upgrade/30 bg-nota-upgrade/5 p-8 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="font-display text-2xl font-extrabold mb-2">
          Templates disponíveis no plano Pro
        </h1>
        <p className="text-text-2 text-sm leading-relaxed mb-2">
          Você está no plano{' '}
          <span className="text-text-1 font-semibold">{currentPlan}</span>.
          Crie templates de nota para pré-preencher o formulário de emissão e
          acelerar seu fluxo de trabalho.
        </p>
        <p className="text-text-2 text-sm mb-8">
          Disponível nos planos <span className="text-nota-upgrade font-semibold">Pro</span> e{' '}
          <span className="text-nota-upgrade font-semibold">Business</span>.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/billing#planos"
            className="bg-nota-upgrade/10 text-nota-upgrade border border-nota-upgrade/30 font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-nota-upgrade/20 transition"
          >
            Fazer upgrade →
          </Link>
          <Link
            href="/"
            className="border border-navy-600 text-text-2 font-semibold text-sm px-6 py-2.5 rounded-lg hover:border-brand-cyan hover:text-text-1 transition"
          >
            Voltar ao dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function TemplatesPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get current plan and templates in parallel
  const competencia = new Date().toISOString().slice(0, 7) // AAAA-MM

  const [emissaoResult, templatesResult] = await Promise.all([
    supabase
      .from('emissoes_mensais')
      .select('planos(nome)')
      .eq('competencia', competencia)
      .single<{ planos: { nome: string } | null }>(),

    supabase
      .from('nota_templates')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .returns<NotaTemplate[]>(),
  ])

  const planoNome = emissaoResult.data?.planos?.nome ?? 'Trial'

  if (!isPlanPro(planoNome)) {
    return <PlanGuard currentPlan={planoNome} />
  }

  const templates = templatesResult.data ?? []

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Templates</h1>
          <p className="text-text-2 mt-1 text-sm">
            Reutilize dados de emissão para acelerar seu fluxo de trabalho.
          </p>
        </div>
      </div>

      {/* Pass initial templates to client component for optimistic CRUD */}
      <TemplatesList initialTemplates={templates} />
    </div>
  )
}
