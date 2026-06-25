// Thank-you page de assinatura paga — destino do Stripe Checkout success_url.
//
// Esta é a conversion PRIMÁRIA no Google Ads. Stripe envia ?session_id={CHECKOUT_SESSION_ID}
// e nós resolvemos plan/value via lookup no banco (server-side, sem expor preço).

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import SubscribeTracking from './SubscribeTracking'

interface SearchParams {
  session_id?: string
  plan?: string
}

export default async function ObrigadoAssinaturaPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const sessionId = searchParams.session_id
  const planSlug = searchParams.plan

  // Lookup plan info (sem expor preço se não precisar) — só pra UX e tracking value.
  let planNome: string | null = null
  let planValue: number | null = null
  let persona: 'mei' | 'me' | 'dev' = 'unknown' as never

  if (planSlug) {
    try {
      const admin = createAdminClient()
      const { data } = await admin
        .from('planos')
        .select('nome,tipo_empresa,preco_mensal_brl')
        .eq('nome', planSlug)
        .limit(1)
        .single()
      if (data) {
        planNome = data.nome
        planValue = Number(data.preco_mensal_brl)
        const tipo = (data.tipo_empresa as string)?.toUpperCase()
        persona = tipo === 'MEI' ? 'mei' : tipo === 'API' ? 'dev' : 'me'
      }
    } catch {
      // Env não configurada (dev sem .env.local) — renderiza thank-you genérico.
      planNome = planSlug
    }
  }

  return (
    <main className="min-h-screen bg-navy-900 text-text-1 flex items-center justify-center px-4">
      <SubscribeTracking
        persona={persona}
        plan={planNome ?? 'unknown'}
        value={planValue ?? 0}
        transactionId={sessionId ?? null}
      />
      <div className="max-w-lg w-full rounded-2xl border border-navy-600 bg-navy-700 p-8 text-center">
        <div className="text-5xl mb-4" aria-hidden>🎉</div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold mb-3">
          Assinatura confirmada!
        </h1>
        <p className="text-text-2 mb-6 leading-relaxed">
          {planNome ? (
            <>Seu plano <strong className="text-text-1">{planNome}</strong> está ativo.</>
          ) : (
            <>Seu plano está ativo.</>
          )}{' '}
          Você já pode emitir notas no volume contratado.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/notas/nova"
            className="bg-brand-cyan text-navy-900 font-bold px-5 py-3 rounded-lg hover:opacity-90 transition text-sm"
          >
            Emitir nova nota →
          </Link>
          <Link
            href="/home"
            className="border border-navy-600 text-text-1 hover:border-brand-cyan hover:text-brand-cyan font-semibold px-5 py-3 rounded-lg transition text-sm"
          >
            Ir pro painel
          </Link>
        </div>
      </div>
    </main>
  )
}
