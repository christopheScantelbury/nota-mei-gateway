import { Suspense } from 'react'
import LoginClient from './LoginClient'

export const metadata = {
  title: 'Entrar | Nota MEI Gateway & Nota Fácil MEI',
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-navy-900 flex items-center justify-center" />
      }
    >
      <LoginClient />
    </Suspense>
  )
}
