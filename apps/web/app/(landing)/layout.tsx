// Layout do grupo (landing) — UrgencyTopBar acima de todo o conteúdo.
//
// Spec: HIST-1.1.
//
// Estratégia:
// - UrgencyTopBar é `fixed top-0 z-[60]` (acima do Navbar z-50).
// - Navbar usa `top: var(--topbar-height)` definida em `globals.css` (SSR-safe).
// - **Cookie dismiss lido no SERVIDOR** → passamos `initialDismissed` pro topbar
//   e pro wrapper, eliminando o flash laranja que aparecia no primeiro paint
//   pra users que já tinham dispensado a barra antes.

import { cookies } from 'next/headers'
import UrgencyTopBar from '@/components/topbar/UrgencyTopBar'
import { TOPBAR_COOKIE } from '@/lib/cookies/topbar'

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const initialDismissed = cookies().get(TOPBAR_COOKIE)?.value === '1'

  return (
    <>
      {/* Override SSR da CSS var pra zerar tudo que depende de --topbar-height
          (Navbar `top`, paddings). Sem isso, mesmo zerando o wrapper, o Navbar
          ainda nasceria com gap de 36px no SSR pra users já dismissed. */}
      {initialDismissed && (
        <style dangerouslySetInnerHTML={{ __html: ':root{--topbar-height:0px}' }} />
      )}
      <UrgencyTopBar initialDismissed={initialDismissed} />
      <div style={{ paddingTop: initialDismissed ? '0px' : 'var(--topbar-height, 0px)' }}>
        {children}
      </div>
    </>
  )
}
