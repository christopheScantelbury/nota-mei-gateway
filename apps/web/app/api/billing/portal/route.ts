import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Stripe billing portal session via REST (no SDK dependency needed).
async function createStripePortalSession(
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY não configurada')

  const body = new URLSearchParams({
    customer: customerId,
    return_url: returnUrl,
  })

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ??
        `Stripe respondeu ${res.status}`,
    )
  }

  const data = (await res.json()) as { url: string }
  return data.url
}

export async function GET(request: Request): Promise<NextResponse> {
  const returnUrl =
    new URL(request.url).searchParams.get('return_url') ??
    `${process.env.NEXT_PUBLIC_API_URL?.replace('api.', '').replace('/api', '') ?? ''}/billing`

  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Lookup Stripe customer ID from meis table.
  const { data: mei, error } = await supabase
    .from('meis')
    .select('stripe_customer_id')
    .eq('id', session.user.id)
    .single<{ stripe_customer_id: string | null }>()

  if (error || !mei?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'NO_SUBSCRIPTION', message: 'Nenhuma assinatura ativa encontrada.' },
      { status: 404 },
    )
  }

  try {
    const portalUrl = await createStripePortalSession(
      mei.stripe_customer_id,
      returnUrl,
    )
    return NextResponse.redirect(portalUrl)
  } catch (err) {
    console.error('[portal] Stripe error:', err)
    return NextResponse.json(
      {
        error: 'STRIPE_ERROR',
        message: err instanceof Error ? err.message : 'Erro ao abrir portal Stripe.',
      },
      { status: 502 },
    )
  }
}
