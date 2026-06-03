import type { Metadata } from 'next'
import { Suspense } from 'react'
import LoginClient from './LoginClient'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { produto?: string }
}): Promise<Metadata> {
  const produto = searchParams.produto
  const titleByProduct: Record<string, string> = {
    mei:     'Entrar — Nota Fácil MEI',
    me:      'Entrar — NotaFácil Empresa',
    gateway: 'Entrar — NotaFácil API',
  }
  // absolute bypassa o template do root layout pra evitar duplicar marca
  return {
    title: {
      absolute: produto && titleByProduct[produto] ? titleByProduct[produto] : 'Entrar — NotaFácil',
    },
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
