#!/usr/bin/env node
/**
 * check-planos-integrity.mjs — detecta planos em estado inconsistente.
 *
 * Invariante: todo plano `ativo=true` com `preco_mensal_brl > 0` DEVE ter
 * `stripe_price_id` não-null (senão o checkout quebra — 422 "indisponível").
 *
 * Também cruza com o Stripe: confirma que o price_id existe, está ativo, e
 * o valor bate com o banco.
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=... STRIPE_SECRET_KEY=... node scripts/check-planos-integrity.mjs
 *
 * Exit code 0 = tudo ok · 1 = inconsistência detectada (útil pra CI/cron).
 */

const SUPABASE_URL = 'https://pzjvgtwnstfyangfwdom.supabase.co'
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY
const SK = process.env.STRIPE_SECRET_KEY

if (!SR) {
  console.error('✗ SUPABASE_SERVICE_ROLE_KEY ausente')
  process.exit(2)
}

async function supa(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SR, Authorization: `Bearer ${SR}` },
  })
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`)
  return r.json()
}

async function stripePrice(id) {
  if (!SK) return null
  const r = await fetch(`https://api.stripe.com/v1/prices/${id}`, {
    headers: { Authorization: `Bearer ${SK}` },
  })
  if (!r.ok) return { error: `${r.status}` }
  return r.json()
}

const problems = []

const planos = await supa(
  'planos?select=nome,tipo_empresa,preco_mensal_brl,stripe_price_id,ativo&order=tipo_empresa,preco_mensal_brl',
)

for (const p of planos) {
  const paid = Number(p.preco_mensal_brl ?? 0) > 0
  if (!p.ativo) continue

  // Invariante 1: ativo + pago → tem price_id
  if (paid && !p.stripe_price_id) {
    problems.push(`${p.nome}: ativo + R$${p.preco_mensal_brl} mas SEM stripe_price_id → checkout quebra`)
    continue
  }

  // Invariante 2 (se STRIPE_SECRET_KEY setada): price existe, ativo e valor bate
  if (paid && p.stripe_price_id && SK) {
    const sp = await stripePrice(p.stripe_price_id)
    if (!sp || sp.error) {
      problems.push(`${p.nome}: stripe_price_id ${p.stripe_price_id} não encontrado no Stripe (${sp?.error ?? 'erro'})`)
    } else if (!sp.active) {
      problems.push(`${p.nome}: stripe_price_id ${p.stripe_price_id} está ARQUIVADO no Stripe`)
    } else if (Math.abs(sp.unit_amount / 100 - Number(p.preco_mensal_brl)) > 0.01) {
      problems.push(`${p.nome}: banco R$${p.preco_mensal_brl} ≠ Stripe R$${(sp.unit_amount / 100).toFixed(2)}`)
    }
  }
}

if (problems.length === 0) {
  console.log(`✓ ${planos.filter(p => p.ativo).length} planos ativos — nenhuma inconsistência`)
  process.exit(0)
} else {
  console.error(`✗ ${problems.length} inconsistência(s):`)
  for (const p of problems) console.error('  •', p)
  process.exit(1)
}
