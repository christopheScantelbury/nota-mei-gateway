import type { Metadata } from 'next'
import { Suspense } from 'react'
import LoginClient from './LoginClient'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { produto?: string }
}): Promise<Metadata> {
  const isMei = searchParams.produto === 'mei'
  return {
    title: isMei ? 'Entrar — Nota Fácil MEI' : 'Entrar — Nota MEI Gateway',
  }
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
