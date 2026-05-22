'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

type Props = {
  nota: { id: string; numero_rps: number }
  onClose: () => void
}

export function ModalSubstituir({ nota, onClose }: Props) {
  const router = useRouter()

  const prosseguir = () => {
    router.push(`/notas/nova?substituir=${nota.id}`)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
                  bg-navy-900/80 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl border border-navy-600
                      bg-navy-700 p-6 shadow-2xl">
        <h3 className="font-medium text-text-1 text-lg mb-2">
          Substituir nota #{nota.numero_rps}
        </h3>

        <p className="text-text-2 text-sm leading-relaxed mb-5">
          A substituição cria uma nova NFS-e com os dados corrigidos e cancela
          a nota original. O prazo máximo é de <strong className="text-text-1">9 dias corridos</strong>{' '}
          a partir da emissão.
        </p>

        <div className="rounded-lg border border-brand-cyan/20 bg-brand-cyan/5
                        p-3 text-xs text-brand-cyan mb-5">
          Os dados da nota atual serão pré-preenchidos no formulário para você corrigir.
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Voltar
          </Button>
          <Button variant="primary" className="flex-1" onClick={prosseguir}>
            Corrigir e substituir →
          </Button>
        </div>
      </div>
    </div>
  )
}
