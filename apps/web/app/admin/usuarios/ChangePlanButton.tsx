'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import type { PlanName } from '@/lib/plans'

interface Props {
  userId: string
  currentPlan: string
  plans: PlanName[]
}

export default function ChangePlanButton({ userId, currentPlan, plans }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(currentPlan)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSave() {
    if (selected === currentPlan) { setOpen(false); return }
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/usuarios/${userId}/plano`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plano: selected }),
        })
        if (!res.ok) {
          const body = await res.json()
          setError(body.error ?? 'Erro ao alterar plano')
          return
        }
        setOpen(false)
        router.refresh()
      } catch {
        setError('Erro de rede')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-brand-cyan hover:underline"
      >
        Alterar plano
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/80 backdrop-blur-sm">
          <div className="bg-navy-700 border border-navy-600 rounded-xl p-6 w-80 shadow-xl">
            <h3 className="font-display font-bold text-lg mb-4">Alterar Plano</h3>

            <div className="space-y-2 mb-4">
              {plans.map((plan) => (
                <label
                  key={plan}
                  className={[
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
                    selected === plan
                      ? 'border-brand-cyan bg-brand-cyan/10 text-brand-cyan'
                      : 'border-navy-600 text-text-2 hover:border-navy-500',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="plano"
                    value={plan}
                    checked={selected === plan}
                    onChange={() => setSelected(plan)}
                    className="sr-only"
                  />
                  <span className="font-medium text-sm">{plan}</span>
                  {plan === currentPlan && (
                    <span className="ml-auto text-xs text-text-2">atual</span>
                  )}
                </label>
              ))}
            </div>

            {error && <p className="text-xs text-nota-rejeitada mb-3">{error}</p>}

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" disabled={isPending} onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button variant="primary" className="flex-1" loading={isPending} disabled={isPending || selected === currentPlan} onClick={handleSave}>
                {isPending ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
