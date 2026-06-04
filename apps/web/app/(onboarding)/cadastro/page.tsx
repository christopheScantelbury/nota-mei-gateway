import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { CadastroPageInner } from './CadastroPageClient'
import CadastroSeletor from './CadastroSeletor'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { produto?: string }
}): Promise<Metadata> {
  const isMei = searchParams.produto === 'mei'
  if (!searchParams.produto) {
    return { title: { absolute: 'Criar conta — Nota Fácil MEI' } }
  }
  return {
    title: {
      absolute: isMei ? 'Cadastrar — Nota Fácil MEI' : 'Cadastrar — Nota MEI Gateway',
    },
  }
}

export default function CadastroPage({
  searchParams,
}: {
  searchParams: { produto?: string; plano?: string }
}) {
  // Bug R3-2: ?produto=gateway é rota legada — redirect pro fluxo dev simplificado.
  // Preserva ?plano= se vier junto.
  if (searchParams.produto === 'gateway') {
    const plano = searchParams.plano
    redirect(plano ? `/cadastro/dev?plano=${encodeURIComponent(plano)}` : '/cadastro/dev')
  }

  // No produto param → show type selector
  if (!searchParams.produto) {
    return <CadastroSeletor />
  }

  return (
    <Suspense>
      <CadastroPageInner />
    </Suspense>
  )
}
