import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export interface StripeInvoice {
  id: string
  number: string | null
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void'
  amount_due: number
  amount_paid: number
  currency: string
  created: number
  invoice_pdf: string | null
  hosted_invoice_url: string | null
  period_start: number
  period_end: number
}

/**
 * GET /api/billing/invoices
 * Returns the last 12 Stripe invoices for the authenticated MEI.
 * Calls Stripe REST API server-side — no Stripe SDK required.
 */
export async function GET() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get Stripe customer ID from MEI row
  const { data: mei } = await supabase
    .from('meis')
    .select('stripe_customer_id')
    .eq('id', session.user.id)
    .single()

  const customerId = mei?.stripe_customer_id
  if (!customerId) {
    // No Stripe customer yet — return empty list (Trial plan)
    return NextResponse.json({ invoices: [] })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json({ invoices: [] })
  }

  try {
    const params = new URLSearchParams({
      customer: customerId,
      limit: '12',
      expand: 'data.subscription',
    })
    const res = await fetch(`https://api.stripe.com/v1/invoices?${params}`, {
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Stripe-Version': '2023-10-16',
      },
      next: { revalidate: 60 }, // cache 1 minute
    })

    if (!res.ok) {
      console.error('Stripe invoices error:', res.status, await res.text())
      return NextResponse.json({ invoices: [] })
    }

    const data = await res.json() as { data: StripeInvoice[] }
    const invoices: StripeInvoice[] = (data.data ?? []).map((inv) => ({
      id:                 inv.id,
      number:             inv.number,
      status:             inv.status,
      amount_due:         inv.amount_due,
      amount_paid:        inv.amount_paid,
      currency:           inv.currency,
      created:            inv.created,
      invoice_pdf:        inv.invoice_pdf,
      hosted_invoice_url: inv.hosted_invoice_url,
      period_start:       inv.period_start,
      period_end:         inv.period_end,
    }))

    return NextResponse.json({ invoices })
  } catch (err) {
    console.error('Stripe invoices fetch failed:', err)
    return NextResponse.json({ invoices: [] })
  }
}
