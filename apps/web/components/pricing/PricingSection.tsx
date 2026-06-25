import PricingCard from './PricingCard'
import PricingViewTracker from './PricingViewTracker'
import { getAnchorPlans } from '@/lib/pricing/anchor'

/**
 * Seção "Planos e preços" da home — dark-first (herda bg-navy-900 do main).
 *
 * 2026-06-25: convertido em Server Component que busca os 3 planos âncora
 * direto do banco (`planos`). Fallback congelado em `data/pricing.ts` cobre
 * o caso de banco indisponível no render. Tracking `pricing_view` ficou
 * isolado em `PricingViewTracker.tsx` (Client).
 *
 * Spec original: HIST-2.1.
 */
export default async function PricingSection() {
  const plans = await getAnchorPlans()

  return (
    <section id="precos" className="py-16 md:py-24 px-4">
      <PricingViewTracker>
        <div className="max-w-7xl mx-auto">
          <header className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-text-1">
              Planos e preços
            </h2>
            <p className="mt-4 text-text-2 max-w-2xl mx-auto">
              Um plano para cada perfil. Comece grátis. Escale conforme cresce.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <PricingCard key={plan.key} plan={plan} />
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-text-2">
            Trial de 30 dias sem cartão. Cancele quando quiser.
          </p>
        </div>
      </PricingViewTracker>
    </section>
  )
}
