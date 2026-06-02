// Layout do grupo (landing) — todas as páginas públicas (home, /mei, /me,
// /gateway, /precos, /blog, /docs, /comparativo) compartilham:
//   - UrgencyTopBar (HIST-1.1) acima de tudo
//   - O Navbar fica em cada página/sub-layout (alguns têm topbar próprio)

import UrgencyTopBar from '@/components/topbar/UrgencyTopBar'

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UrgencyTopBar />
      {children}
    </>
  )
}
