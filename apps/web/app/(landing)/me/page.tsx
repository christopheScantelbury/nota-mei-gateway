import Link from 'next/link'
import Navbar from '@/components/landing/Navbar'
import LandingFooter from '@/components/landing/LandingFooter'
import { SoftwareAppStructuredData } from '@/components/seo/StructuredData'
// UrgencyBannerME legado removido — UrgencyTopBar no (landing)/layout já cobre (Bug #9)
import { MEHero }         from './components/MEHero'
import { MEBeneficios }   from './components/MEBeneficios'
import { MEComoFunciona } from './components/MEComoFunciona'
import { MEFAQ }          from './components/MEFAQ'
import { MECTAFinal }     from './components/MECTAFinal'
import PricingToggleMe from '@/components/landing/PricingToggleMeSSR'
import CompetitorTable from '@/components/competitor/CompetitorTable'

// ISR: preços/planos lidos do banco revalidam a cada 5 min (edição via /admin/planos reflete sem redeploy).
export const revalidate = 300


export default function LandingME() {
  return (
    <main className="bg-navy-900 min-h-screen text-text-1 font-body">
      <SoftwareAppStructuredData
        name="NotaFácil Empresa"
        description="Plataforma de emissão de NFS-e Nacional para Microempresa e EPP. Simples Nacional e Lucro Presumido. Obrigatório a partir de set/2026."
        url="https://emitirnotafacil.com.br/me"
      />
      <Navbar />
      <div className="pt-14 sm:pt-16">
        <MEHero />
        <MEBeneficios />
        <MEComoFunciona />

        {/* Por que escolher (HIST-4.3 — embed comparativo) */}
        <section className="py-16 px-4 bg-navy-700/30 border-y border-navy-600">
          <div className="mx-auto max-w-5xl">
            <header className="text-center mb-8">
              <h2 className="font-display text-3xl font-extrabold mb-3 text-text-1">
                Por que escolher o NotaFácil Empresa
              </h2>
              <p className="text-text-2">
                Comparado com as principais alternativas do mercado
              </p>
            </header>
            <CompetitorTable variant="summary" source="home_embed" />
            <div className="text-center mt-6">
              <Link href="/comparativo" className="text-amber-300 hover:underline font-semibold">
                Ver comparativo completo →
              </Link>
            </div>
          </div>
        </section>

        {/* Planos — todos os planos ME completos (Start/Pro/Business/Scale) */}
        <section id="precos" className="py-16 md:py-24 px-4">
          <div className="mx-auto max-w-7xl">
            <header className="text-center mb-12">
              <h2 className="font-display text-3xl md:text-4xl font-extrabold text-text-1">
                Planos para Microempresa
              </h2>
              <p className="mt-4 text-text-2 max-w-2xl mx-auto">
                Escolha o plano certo para o volume da sua empresa. Trial grátis com 5 notas, sem cartão.
              </p>
            </header>
            <PricingToggleMe />
          </div>
        </section>

        <MEFAQ />
        <MECTAFinal />
      </div>
      <LandingFooter />
    </main>
  )
}
