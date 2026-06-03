// Layout do grupo (landing) — UrgencyTopBar acima de todo o conteúdo.
//
// Spec: HIST-1.1.
//
// Estratégia: UrgencyTopBar é `fixed top-0 z-[60]` (acima do Navbar z-50).
// Cada página continua renderizando seu próprio Navbar — o Navbar usa
// `top: var(--topbar-height)` definida em globals.css (SSR-safe, sem race).

import UrgencyTopBar from '@/components/topbar/UrgencyTopBar'

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UrgencyTopBar />
      {children}
    </>
  )
}
