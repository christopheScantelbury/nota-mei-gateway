'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import type { StripeInvoice } from '@/app/api/billing/invoices/route'

function formatBRL(amount: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

function formatDate(unix: number) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(unix * 1000))
}

function InvoiceStatusBadge({ status }: { status: StripeInvoice['status'] }) {
  const map: Record<StripeInvoice['status'], { label: string; variant: 'success' | 'warning' | 'destructive' | 'neutral' | 'default' }> = {
    paid:          { label: 'Pago',      variant: 'success'     },
    open:          { label: 'Pendente',  variant: 'warning'     },
    draft:         { label: 'Rascunho', variant: 'default'     },
    uncollectible: { label: 'Falhou',    variant: 'destructive' },
    void:          { label: 'Cancelada', variant: 'neutral'     },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={variant}>{label}</Badge>
}

export default function InvoiceList() {
  const [invoices, setInvoices] = useState<StripeInvoice[] | null>(null)
  const [error, setError]       = useState(false)

  useEffect(() => {
    fetch('/api/billing/invoices')
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices ?? []))
      .catch(() => setError(true))
  }, [])

  if (error) return null // fail silently — invoices are non-critical

  return (
    <div className="rounded-xl border border-navy-600 overflow-hidden mb-8">
      <div className="bg-navy-700 px-5 py-3 border-b border-navy-600">
        <h2 className="font-display text-base font-bold">Faturas</h2>
      </div>

      {invoices === null ? (
        // Loading skeleton
        <div className="divide-y divide-navy-600/50">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-text-2">
          Nenhuma fatura encontrada. As faturas aparecerão aqui após o primeiro ciclo de cobrança.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy-600">
              {['Fatura', 'Período', 'Valor', 'Status', 'Ações'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, i) => (
              <tr
                key={inv.id}
                className={`border-b border-navy-600 last:border-0 ${i % 2 === 0 ? '' : 'bg-navy-700/30'}`}
              >
                <td className="px-4 py-3 font-mono text-xs text-text-2">
                  {inv.number ?? inv.id.slice(-8)}
                </td>
                <td className="px-4 py-3 text-text-2 text-xs">
                  {formatDate(inv.period_start)} → {formatDate(inv.period_end)}
                </td>
                <td className="px-4 py-3 font-mono font-semibold">
                  {formatBRL(inv.amount_due, inv.currency)}
                </td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={inv.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {inv.invoice_pdf && (
                      <a
                        href={inv.invoice_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand-cyan hover:underline"
                      >
                        ⬇ PDF
                      </a>
                    )}
                    {inv.hosted_invoice_url && (
                      <a
                        href={inv.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-text-2 hover:text-text-1"
                      >
                        Ver →
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
