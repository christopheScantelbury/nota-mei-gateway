// stripe-catalog-rebuild.mjs — refaz o catálogo de planos no Stripe LIVE.
//
// Catálogo final (decisão 2026-06-05):
//
//   MEI:
//     - Trial         · grátis · 5 notas (one-shot, sem cobrança)
//     - Avulso        · pay-per-use · R$ 5,99/nota (price avulso, não recurring)
//     - MEI Mensal    · R$ 19,90/mês · 5 notas
//     - MEI Plus      · R$ 39,90/mês · 15 notas
//     - MEI Premium   · R$ 79,90/mês · 100 notas
//
//   ME/EPP:
//     - Trial ME      · grátis · 5 notas one-shot
//     - ME Start      · R$ 59,99/mês · 10 notas (excedente R$ 0,80)
//     - ME Pro        · R$ 149,90/mês · 50 notas (excedente R$ 0,60)
//     - ME Business   · R$ 299,90/mês · 300 notas (excedente R$ 0,40)
//     - EPP Scale     · sob consulta — não cria no Stripe
//
// Estratégia: reusar produtos existentes (rename) + criar prices novos
// (price antigo vira inactive porque prices são imutáveis no Stripe).
//
// Uso:
//   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-catalog-rebuild.mjs

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY
if (!STRIPE_KEY) {
  console.error('❌ STRIPE_SECRET_KEY env var é obrigatória')
  process.exit(1)
}

const dryRun = process.argv.includes('--dry-run')

// Mapping dos produtos atuais → nome novo. Vamos REUSAR esses 5 produtos.
const EXISTING_PRODUCTS = {
  'prod_UTAuGnSjKooV6n': { newName: 'NotaFácil MEI — Trial',     metadata: { persona: 'MEI', tier: 'trial',   notas: '5' } },
  'prod_UTAu7miepp5T7v': { newName: 'NotaFácil ME — Start',      metadata: { persona: 'ME',  tier: 'starter', notas: '10' } },
  'prod_UTAuH8TnTrImYZ': { newName: 'NotaFácil MEI — Mensal',    metadata: { persona: 'MEI', tier: 'starter', notas: '5' } },
  'prod_UTAu0JaTLfKeYr': { newName: 'NotaFácil ME — Pro',        metadata: { persona: 'ME',  tier: 'pro',     notas: '50' } },
  'prod_UTAurjiADu5bWv': { newName: 'NotaFácil ME — Business',   metadata: { persona: 'ME',  tier: 'business', notas: '300' } },
}

// Novos produtos a criar (que não existem ainda).
const NEW_PRODUCTS = [
  { name: 'NotaFácil MEI — Avulso',  metadata: { persona: 'MEI', tier: 'avulso',  notas: 'unlimited' } },
  { name: 'NotaFácil MEI — Plus',    metadata: { persona: 'MEI', tier: 'plus',    notas: '15' } },
  { name: 'NotaFácil MEI — Premium', metadata: { persona: 'MEI', tier: 'premium', notas: '100' } },
  { name: 'NotaFácil ME — Trial',    metadata: { persona: 'ME',  tier: 'trial',   notas: '5' } },
]

// Mapping de price por produto (após sabermos os IDs).
// Cada price → preço em centavos (BRL).
//
// IMPORTANT: Stripe não permite alterar amount de price ativo. Criamos
// novo price + desativamos o antigo manualmente depois (ou aqui).
const PRICE_PLAN = (productNewName) => {
  const map = {
    'NotaFácil MEI — Trial':     { recurring: 0, interval: 'month' }, // grátis recurring → permite trial automation
    'NotaFácil MEI — Avulso':    { unit: 599, recurring: null },     // R$ 5,99 por unidade (não recurring)
    'NotaFácil MEI — Mensal':    { recurring: 1990, interval: 'month' },
    'NotaFácil MEI — Plus':      { recurring: 3990, interval: 'month' },
    'NotaFácil MEI — Premium':   { recurring: 7990, interval: 'month' },
    'NotaFácil ME — Trial':      { recurring: 0, interval: 'month' },
    'NotaFácil ME — Start':      { recurring: 5999, interval: 'month', overage: 80 },   // R$ 0,80
    'NotaFácil ME — Pro':        { recurring: 14990, interval: 'month', overage: 60 },  // R$ 0,60
    'NotaFácil ME — Business':   { recurring: 29990, interval: 'month', overage: 40 },  // R$ 0,40
  }
  return map[productNewName]
}

async function stripe(method, path, body) {
  const url = `https://api.stripe.com/v1${path}`
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  }
  if (body) {
    opts.body = new URLSearchParams(body).toString()
  }
  if (dryRun && method !== 'GET') {
    console.log(`[dry-run] ${method} ${path}`, body)
    return { id: `dry_${Date.now()}`, dry: true }
  }
  const res = await fetch(url, opts)
  const json = await res.json()
  if (!res.ok) {
    console.error(`❌ ${method} ${path} →`, json.error?.message || json)
    throw new Error(json.error?.message || `Stripe ${res.status}`)
  }
  return json
}

const created = {}

async function main() {
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log()

  // 1. Renomear produtos existentes
  console.log('═══ 1. Atualizando produtos existentes ═══')
  for (const [productId, conf] of Object.entries(EXISTING_PRODUCTS)) {
    const body = { name: conf.newName }
    Object.entries(conf.metadata).forEach(([k, v]) => {
      body[`metadata[${k}]`] = v
    })
    await stripe('POST', `/products/${productId}`, body)
    console.log(`  ✓ ${productId} → ${conf.newName}`)
    created[conf.newName] = productId
  }

  // 2. Criar produtos novos
  console.log('\n═══ 2. Criando produtos novos ═══')
  for (const prod of NEW_PRODUCTS) {
    const body = { name: prod.name }
    Object.entries(prod.metadata).forEach(([k, v]) => {
      body[`metadata[${k}]`] = v
    })
    const created_prod = await stripe('POST', '/products', body)
    console.log(`  ✓ created ${created_prod.id || created_prod.dry} · ${prod.name}`)
    created[prod.name] = created_prod.id
  }

  // 3. Criar prices novos
  console.log('\n═══ 3. Criando prices ═══')
  const newPriceIDs = {}
  for (const [productName, productId] of Object.entries(created)) {
    const plan = PRICE_PLAN(productName)
    if (!plan) continue

    // Preço recurring (mensal)
    if (plan.recurring !== undefined) {
      const body = {
        product: productId,
        currency: 'brl',
        unit_amount: plan.recurring,
        'recurring[interval]': plan.interval || 'month',
        nickname: `${productName} — recurring`,
      }
      const p = await stripe('POST', '/prices', body)
      console.log(`  ✓ recurring ${p.id || p.dry} · ${productName} · R$ ${(plan.recurring/100).toFixed(2)}/mês`)
      newPriceIDs[productName] = { recurring: p.id || p.dry }
    }
    // Preço avulso (não recurring)
    if (plan.unit !== undefined) {
      const body = {
        product: productId,
        currency: 'brl',
        unit_amount: plan.unit,
        nickname: `${productName} — por nota`,
      }
      const p = await stripe('POST', '/prices', body)
      console.log(`  ✓ avulso ${p.id || p.dry} · ${productName} · R$ ${(plan.unit/100).toFixed(2)}/nota`)
      if (!newPriceIDs[productName]) newPriceIDs[productName] = {}
      newPriceIDs[productName].avulso = p.id || p.dry
    }
    // Preço excedente: deixado pra setup manual no Dashboard Stripe pela
    // nova API exigir billing meters (Stripe 2025-03-31). Sem isso o
    // metered price não pode ser criado via API simples. Plano cobra
    // apenas a base mensal por ora.
    if (plan.overage !== undefined) {
      console.log(`  ⊘ overage ${productName} · R$ ${(plan.overage/100).toFixed(2)} — manual no Dashboard (meter setup)`)
    }
  }

  console.log('\n═══ Resultado ═══')
  console.log(JSON.stringify(newPriceIDs, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
