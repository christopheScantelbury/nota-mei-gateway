import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Compra cancelada',
}

export default async function BillingCanceladoPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-8 max-w-xl">
      <div className="rounded-xl border border-navy-600 bg-navy-700 p-8 text-center">
        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-navy-600 border border-navy-600 mx-auto mb-5">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path
              d="M8 8l16 16M24 8L8 24"
              stroke="#8AA0B8"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1 className="font-display text-2xl font-extrabold mb-2">
          Compra cancelada
        </h1>
        <p className="text-text-2 text-sm leading-relaxed mb-8">
          Nenhuma cobrança foi realizada. Você pode escolher um plano a qualquer
          momento — sem compromisso.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/billing#planos"
            className="bg-nota-upgrade/10 text-nota-upgrade border border-nota-upgrade/30 font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-nota-upgrade/20 transition"
          >
            Ver planos disponíveis
          </Link>
          <Link
            href="/home"
            className="border border-navy-600 text-text-2 font-semibold text-sm px-6 py-2.5 rounded-lg hover:border-brand-cyan hover:text-text-1 transition"
          >
            Voltar ao dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
