// Layout do grupo (landing) — UrgencyTopBar acima de todo o conteúdo.
//
// Spec: HIST-1.1.
//
// Estratégia:
// - UrgencyTopBar é `fixed top-0 z-[60]` (acima do Navbar z-50).
// - Navbar usa `top: var(--topbar-height)` definida em `globals.css` (SSR-safe).
// - O wrapper aqui aplica `padding-top: var(--topbar-height)` no conteúdo
//   children pra empurrar o conteúdo não-fixed pra baixo da topbar. Combina
//   com os `pt-14/16/32` que cada página já tem pra compensar o Navbar.
// - Quando topbar dismissed, `--topbar-height` vira 0 → padding também zera.

import UrgencyTopBar from '@/components/topbar/UrgencyTopBar'

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UrgencyTopBar />
      {/* O padding-top empurra TODO o conteúdo não-fixed pra baixo da topbar,
          eliminando overlap em páginas que assumiram só altura do Navbar. */}
      <div style={{ paddingTop: 'var(--topbar-height, 0px)' }}>
        {children}
      </div>
    </>
  )
}
