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
  /** Metadata propagado pra Subscription e Customer — webhook lê isso pra atualizar o banco */
  metadata:   Record<string, string>
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

  // Metadata em 3 lugares pra garantir que o webhook sempre encontra:
  //   - session.metadata           → checkout.session.completed
  //   - subscription_data.metadata → customer.subscription.created/updated
  //   - customer.metadata (já vem via session ao criar customer novo)
  for (const [k, v] of Object.entries(opts.metadata)) {
    body.set(`metadata[${k}]`, v)
    body.set(`subscription_data[metadata][${k}]`, v)
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

  // 1) Resolver stripe_price_id + plano_id via tabela planos (single source of truth).
  let priceId:  string | undefined
  let planoId:  string | undefined
  if (planoNome) {
    const { data: planoRow } = await supabase
      .from('planos')
      .select('id, stripe_price_id')
      .eq('nome', planoNome)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle<{ id: string; stripe_price_id: string | null }>()
    priceId = planoRow?.stripe_price_id ?? undefined
    planoId = planoRow?.id              ?? undefined
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

  // Resolve dono da conta — MEI legacy OU empresa ME/EPP.
  // Buscamos em paralelo; um dos dois resolve, o outro fica null.
  // ARCH-03 invariant: pra MEI legacy, mei.id == empresa.id (a empresa
  // existe em empresas com tipo='MEI' apontando pra mesma row).
  const [{ data: meiRow }, { data: empresaRow }] = await Promise.all([
    supabase.from('meis')
      .select('id, email, stripe_customer_id')
      .eq('id', session.user.id)
      .maybeSingle<{ id: string; email: string; stripe_customer_id: string | null }>(),
    supabase.from('empresas')
      .select('id, email, tipo, stripe_customer_id')
      .eq('user_id', session.user.id)
      .maybeSingle<{ id: string; email: string; tipo: string; stripe_customer_id: string | null }>(),
  ])

  if (!meiRow && !empresaRow) {
    return NextResponse.json(
      { error: 'NO_ACCOUNT', message: 'Conta não encontrada — refaça login.' },
      { status: 404 },
    )
  }

  // Preferência: empresa ME/EPP (rota nova) → MEI legacy.
  // Para MEI legacy, ambos vão existir com o mesmo ID; usamos empresa pra ME/EPP
  // e MEI pra MEI puro.
  const isEmpresa = !!empresaRow && empresaRow.tipo !== 'MEI'
  const owner = isEmpresa
    ? {
        kind:             'empresa' as const,
        id:               empresaRow!.id,
        email:            empresaRow!.email,
        stripeCustomerId: empresaRow!.stripe_customer_id,
        tipo:             empresaRow!.tipo,
      }
    : {
        kind:             'mei' as const,
        id:               meiRow?.id ?? empresaRow?.id ?? session.user.id,
        email:            meiRow?.email ?? empresaRow?.email ?? session.user.email ?? '',
        stripeCustomerId: meiRow?.stripe_customer_id ?? empresaRow?.stripe_customer_id ?? null,
        tipo:             'MEI',
      }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL
    ?.replace(/^https:\/\/api\./, 'https://www.')  // api.emitirnotafacil.com.br → www.
    ?? 'https://www.emitirnotafacil.com.br'

  // Metadata propagado pro webhook saber qual usuário/plano atualizar.
  const metadata: Record<string, string> = {
    plano_slug:   plano,
    plano_nome:   planoNome,
    tipo_empresa: owner.tipo,
  }
  if (planoId) metadata.plano_id = planoId
  if (owner.kind === 'mei')     metadata.mei_id     = owner.id
  if (owner.kind === 'empresa') metadata.empresa_id = owner.id

  try {
    const checkoutUrl = await createStripeCheckoutSession({
      priceId,
      customerId: owner.stripeCustomerId,
      email:      owner.email || session.user.email || '',
      successUrl: `${baseUrl}/billing?checkout=success`,
      cancelUrl:  `${baseUrl}/billing?checkout=cancel`,
      metadata,
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
