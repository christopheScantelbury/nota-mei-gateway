'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'

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
      <button
        onClick={() => setOpen(true)}
        className="mt-auto text-center text-sm bg-nota-upgrade/10 text-nota-upgrade border border-nota-upgrade/30 font-semibold px-4 py-2 rounded-lg hover:bg-nota-upgrade/20 transition"
      >
        Assinar {planName}
      </button>

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
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-nota-upgrade text-white font-semibold text-sm px-4 py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12" cy="12" r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    Redirecionando…
                  </>
                ) : (
                  'Confirmar e ir ao pagamento →'
                )}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="px-4 py-2.5 border border-navy-600 text-text-2 text-sm rounded-lg hover:border-brand-cyan hover:text-text-1 transition disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
