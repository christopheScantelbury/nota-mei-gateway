import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Mapeia o slug enviado pelo frontend → nome canônico armazenado em planos.nome.
// Mantido em sync com apps/api/internal/billing/repository.go::slugToPlanoNome.
function slugToPlanoNome(slug: string): string {
  switch (slug.toLowerCase().trim()) {
    case 'trial-mei':
    case 'trial_mei':       return 'Trial MEI'
    case 'avulso':          return 'Avulso MEI'
    case 'mensal':
    case 'mei-mensal':      return 'MEI Mensal'
    case 'plus':
    case 'mei-plus':        return 'MEI Plus'
    case 'premium':
    case 'mei-premium':     return 'MEI Premium'
    case 'trial-me':
    case 'trial_me':        return 'Trial ME'
    case 'start':
    case 'me-start':        return 'ME Start'
    case 'pro':
    case 'me-pro':          return 'ME Pro'
    case 'business':
    case 'me-business':     return 'ME Business'
    // Legacy slugs (pre-2026-06)
    case 'starter':         return 'ME Start'
    case 'basic':           return 'MEI Plus'
  }
  return ''
}

// Fallback env-var lookup pra rollback emergencial — usado só se a busca no
// banco falhar inesperadamente (ex: outage Supabase momentâneo).
const LEGACY_PRICE_IDS: Record<string, string | undefined> = {
  starter:  process.env.STRIPE_PRICE_STARTER,
  basic:    process.env.STRIPE_PRICE_BASIC,
  pro:      process.env.STRIPE_PRICE_PRO,
  business: process.env.STRIPE_PRICE_BUSINESS,
}

async function createStripeCheckoutSession(opts: {
  priceId:    string
  customerId: string | null
  email:      string
  successUrl: string
  cancelUrl:  string
}): Promise<string> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY não configurada')

  const body = new URLSearchParams({
    mode:                          'subscription',
    'line_items[0][price]':        opts.priceId,
    'line_items[0][quantity]':     '1',
    success_url:                   opts.successUrl,
    cancel_url:                    opts.cancelUrl,
  })

  if (opts.customerId) {
    body.set('customer', opts.customerId)
  } else {
    body.set('customer_email', opts.email)
  }

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${key}`,
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

// POST /api/billing/checkout — cria uma sessão de checkout Stripe e retorna a URL
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  let body: { plano?: string }
  try { body = await request.json() } catch { body = {} }

  const plano = (body.plano ?? '').toLowerCase()
  const planoNome = slugToPlanoNome(plano)

  // 1) Resolver stripe_price_id via tabela planos (single source of truth).
  let priceId: string | undefined
  if (planoNome) {
    const { data: planoRow } = await supabase
      .from('planos')
      .select('stripe_price_id')
      .eq('nome', planoNome)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle<{ stripe_price_id: string | null }>()
    priceId = planoRow?.stripe_price_id ?? undefined
  }

  // 2) Fallback: env-vars legacy (só pra rollback de emergência).
  if (!priceId) priceId = LEGACY_PRICE_IDS[plano]

  if (!priceId) {
    return NextResponse.json(
      {
        error:   'VALIDATION_ERROR',
        message: planoNome
          ? `Plano "${planoNome}" indisponível para assinatura no momento.`
          : `Plano inválido: ${plano}`,
      },
      { status: 422 },
    )
  }

  // Busca empresa do usuário (stripe_customer_id + email)
  const { data: empresa } = await supabase
    .from('empresas')
    .select('stripe_customer_id, email')
    .eq('user_id', session.user.id)
    .limit(1)
    .maybeSingle<{ stripe_customer_id: string | null; email: string }>()

  const baseUrl = process.env.NEXT_PUBLIC_API_URL
    ?.replace(/^https:\/\/api\./, 'https://www.')  // api.emitirnotafacil.com.br → www.
    ?? 'https://www.emitirnotafacil.com.br'

  try {
    const checkoutUrl = await createStripeCheckoutSession({
      priceId,
      customerId: empresa?.stripe_customer_id ?? null,
      email:      empresa?.email ?? session.user.email ?? '',
      successUrl: `${baseUrl}/billing?checkout=success`,
      cancelUrl:  `${baseUrl}/billing?checkout=cancel`,
    })

    return NextResponse.json({ url: checkoutUrl })
  } catch (err) {
    console.error('[checkout] Stripe error:', err)
    return NextResponse.json(
      {
        error:   'STRIPE_ERROR',
        message: err instanceof Error ? err.message : 'Erro ao criar sessão de checkout.',
      },
      { status: 502 },
    )
  }
}
