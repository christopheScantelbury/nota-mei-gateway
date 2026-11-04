'use client'

import { abrirSuporte } from '@/lib/suporte/abrir'

/** Botão/link que abre o chat de ajuda do painel (#258). */
export default function FalarComSuporte({
  mensagem,
  className,
  children = 'Falar com o suporte',
}: {
  mensagem?: string
  className?: string
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => abrirSuporte(mensagem)}
      className={className ?? 'text-sm text-brand-cyan hover:underline'}
    >
      {children}
    </button>
  )
}
