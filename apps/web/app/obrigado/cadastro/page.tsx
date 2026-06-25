// Thank-you page de cadastro concluído.
//
// Disparo limpo da conversion `signup_complete` + Google Ads conversion.
// O fluxo de cadastro redireciona pra cá após sucesso (sem retornar pro form).
// Mantém destino próprio pra Google Ads não ter ambiguidade de quando contar.

'use client'

import { Suspense, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { trackSignupComplete, sendAdsConversion, type Persona } from '@/lib/analytics/events'

function TrackingInner() {
  const params = useSearchParams()
  const persona = (params.get('persona') as Persona) || 'unknown'
  const plan = params.get('plan') ?? 'trial'

  useEffect(() => {
    trackSignupComplete({ persona, plan })
    sendAdsConversion('NEXT_PUBLIC_ADS_CONV_SIGNUP')
  }, [persona, plan])

  return null
}

export default function ObrigadoCadastroPage() {
  return (
    <main className="min-h-screen bg-navy-900 text-text-1 flex items-center justify-center px-4">
      {/* Suspense é exigido pelo Next 14 quando useSearchParams é usado em
          Client Component (CSR bailout). Sem isso, o build falha. */}
      <Suspense fallback={null}>
        <TrackingInner />
      </Suspense>
      <div className="max-w-lg w-full rounded-2xl border border-navy-600 bg-navy-700 p-8 text-center">
        <div className="text-5xl mb-4" aria-hidden>✅</div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold mb-3">
          Cadastro concluído!
        </h1>
        <p className="text-text-2 mb-6 leading-relaxed">
          Sua conta está pronta. Próximo passo: enviar seu certificado A1 e emitir
          sua primeira nota grátis.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/configuracoes/certificado"
            className="bg-brand-cyan text-navy-900 font-bold px-5 py-3 rounded-lg hover:opacity-90 transition text-sm"
          >
            Configurar certificado A1 →
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
