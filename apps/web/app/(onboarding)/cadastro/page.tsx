import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CadastroPageInner } from './CadastroPageClient'

// Título dinâmico por produto — server component tem acesso ao searchParams
export async function generateMetadata({
  searchParams,
}: {
  searchParams: { produto?: string }
}): Promise<Metadata> {
  const isMei = searchParams.produto === 'mei'
  // absolute bypasses the root layout template so MEI users don't see the
  // Gateway suffix: 'Cadastrar — Nota Fácil MEI · Nota MEI Gateway'
  return {
    title: {
      absolute: isMei ? 'Cadastrar — Nota Fácil MEI' : 'Cadastrar — Nota MEI Gateway',
    },
  }
}

export default function CadastroPage() {
  return (
    <Suspense>
      <CadastroPageInner />
    </Suspense>
  )
}
