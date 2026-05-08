import Navbar from '@/components/landing/Navbar'
import LandingFooter from '@/components/landing/LandingFooter'
import EcossistemaScantelbury from '@/components/landing/EcossistemaScantelbury'
import { UrgencyBannerME } from '@/components/landing/UrgencyBannerME'
import { MEHero }         from './components/MEHero'
import { MEBeneficios }   from './components/MEBeneficios'
import { MEComoFunciona } from './components/MEComoFunciona'
import { MEFAQ }          from './components/MEFAQ'
import { MECTAFinal }     from './components/MECTAFinal'

export default function LandingME() {
  return (
    <main className="bg-navy-900 min-h-screen text-text-1 font-body">
      <Navbar />
      <div className="pt-14 sm:pt-16">
        <UrgencyBannerME />
        <MEHero />
        <MEBeneficios />
        <MEComoFunciona />
        <MEFAQ />
        <MECTAFinal />
      </div>
      <EcossistemaScantelbury />
      <LandingFooter />
    </main>
  )
}
