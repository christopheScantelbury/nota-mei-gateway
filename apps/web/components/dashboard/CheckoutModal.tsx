'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'

interface Props {
  planName: string
  planPrice: string
  planLimit: number
  checkoutUrl: string
}

/**
 * CheckoutModal — shows plan details in a confirmation dialog before
 * redirecting to Stripe Checkout. The button is disabled after the first
 * click to prevent double-submissions.
 */
export default function CheckoutModal({
  planName,
  planPrice,
  planLimit,
  checkoutUrl,
}: Props) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)

  function handleConfirm() {
    if (loading) return
    setLoading(true)
    window.location.href = checkoutUrl
  }

  return (
    <>
      <Button
        variant="upgrade"
        size="sm"
        className="mt-auto"
        fullWidth
        onClick={() => setOpen(true)}
      >
        Assinar {planName}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar assinatura</DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Plan summary */}
            <div className="rounded-lg bg-navy-900 border border-navy-600 divide-y divide-navy-600">
              {[
                { label: 'Plano',    value: planName },
                { label: 'Limite',   value: `${planLimit.toLocaleString('pt-BR')} notas/mês` },
                { label: 'Cobrança', value: planPrice, highlight: true },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-sm text-text-2">{label}</span>
                  <span
                    className={`text-sm font-semibold ${
                      highlight ? 'text-brand-cyan' : 'text-text-1'
                    }`}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-text-2 leading-relaxed">
              Você será redirecionado ao Stripe Checkout. Nenhuma cobrança é
              efetuada antes da confirmação do pagamento.
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="upgrade"
                className="flex-1"
                onClick={handleConfirm}
                loading={loading}
              >
                {loading ? 'Redirecionando…' : 'Confirmar e ir ao pagamento →'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
