import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Assinatura confirmada',
}

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string }
}) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect('/')

  return (
    <div className="p-8 max-w-xl">
      <div className="rounded-xl border border-nota-autorizada/40 bg-nota-autorizada/10 p-8 text-center">
        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-nota-autorizada/20 border border-nota-autorizada/30 mx-auto mb-5">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path
              d="M7 16l6 6 12-12"
              stroke="#00C85A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="font-display text-2xl font-extrabold text-nota-autorizada mb-2">
          Assinatura ativada!
        </h1>
        <p className="text-text-2 text-sm leading-relaxed mb-8">
          Sua assinatura foi processada com sucesso. O novo limite de emissões
          já está ativo — pode começar a emitir notas agora mesmo.
        </p>

        {/* Session ID for support */}
        {searchParams.session_id && (
          <p className="text-xs text-text-2 font-mono bg-navy-900 border border-navy-600 rounded px-3 py-1.5 mb-6 break-all">
            Ref: {searchParams.session_id}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/notas/nova"
            className="bg-brand-cyan text-navy-900 font-semibold text-sm px-6 py-2.5 rounded-lg hover:opacity-90 transition"
          >
            Emitir nova nota →
          </Link>
          <Link
            href="/billing"
            className="border border-navy-600 text-text-1 font-semibold text-sm px-6 py-2.5 rounded-lg hover:border-brand-cyan transition"
          >
            Ver meu plano
          </Link>
        </div>
      </div>
    </div>
  )
}
