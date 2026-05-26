'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import type { Cliente } from '@/lib/types-cliente'

interface Props {
  cliente: Cliente
  canCrud: boolean
}

export default function ClienteDetailActions({ cliente, canCrud }: Props) {
  const router = useRouter()
  const [archiving, setArchiving] = useState(false)

  async function handleArquivar() {
    if (!confirm(`Arquivar ${cliente.razao_social}?\n\nAs notas históricas serão preservadas.`)) return
    setArchiving(true)
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao arquivar')
      router.push('/clientes')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao arquivar')
      setArchiving(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2 shrink-0">
      <Link
        href={`/notas/nova?cliente=${cliente.id}`}
        className="text-sm bg-brand-cyan text-navy-900 font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition whitespace-nowrap"
      >
        + Emitir nota
      </Link>
      {canCrud && (
        <>
          <Link
            href={`/clientes/${cliente.id}/editar`}
            className="text-sm border border-navy-600 text-text-1 font-medium px-4 py-2 rounded-lg hover:border-brand-cyan transition"
          >
            Editar
          </Link>
          <Button
            variant="ghost"
            size="sm"
            loading={archiving}
            onClick={handleArquivar}
            className="text-nota-rejeitada hover:bg-nota-rejeitada/10"
          >
            Arquivar
          </Button>
        </>
      )}
    </div>
  )
}
