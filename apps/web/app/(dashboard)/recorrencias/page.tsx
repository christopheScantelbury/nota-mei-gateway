export const metadata = { title: 'Automação' }

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RecorrenciasList from './RecorrenciasList'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.emitirnotafacil.com.br'

function currentCompetencia() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default async function RecorrenciasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Plan guard — automação is a Business-plan feature
  // RLS enforces isolation for both MEI and ME/EPP — no explicit user filter needed
  const { data: emissao } = await supabase
    .from('emissoes_mensais')
    .select('planos(nome)')
    .eq('competencia', currentCompetencia())
    .maybeSingle<{ planos: { nome: string } | null }>()

  const planoNome = emissao?.planos?.nome?.toLowerCase() ?? 'trial'
  const hasAccess = planoNome === 'business'

  if (!hasAccess) {
    return (
      <div className="p-4 sm:p-8 max-w-2xl">
        <div className="rounded-xl border border-nota-upgrade/30 bg-nota-upgrade/5 p-8 text-center">
          <div className="text-5xl mb-4">🔄</div>
          <h1 className="font-display text-2xl font-extrabold mb-2">
            Automação de emissão recorrente
          </h1>
          <p className="text-text-2 mb-6 text-sm leading-relaxed">
            Configure regras de emissão recorrente e as notas são emitidas automaticamente
            todo mês no dia que você escolher — sem nenhuma ação manual.
            <br />
            <br />
            Este recurso está disponível exclusivamente no plano{' '}
            <span className="text-nota-upgrade font-semibold">Business</span>.
          </p>
          <a
            href="/billing"
            className="inline-block text-sm font-semibold bg-nota-upgrade text-white px-6 py-2.5 rounded-lg hover:opacity-90 transition"
          >
            Fazer upgrade para Business →
          </a>
        </div>
      </div>
    )
  }

  // Fetch existing recorrencias
  let initialData: unknown[] = []
  try {
    const res = await fetch(`${API_BASE}/v1/recorrencias`, {
      headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}` },
      cache: 'no-store',
    })
    if (res.ok) {
      const body = await res.json()
      initialData = body?.data ?? []
    }
  } catch {
    // non-fatal — component renders with empty list
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <RecorrenciasList initialData={initialData as Parameters<typeof RecorrenciasList>[0]['initialData']} />
    </div>
  )
}
