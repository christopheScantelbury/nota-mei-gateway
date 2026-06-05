#!/usr/bin/env node
// Atualiza description de cada produto NotaFácil no Stripe pra refletir
// o limite correto de NFS-e/mês. Usado depois do rebuild do catálogo
// pra corrigir descrições herdadas dos planos antigos (R$49 com 1000 notas etc).
//
// Tabela canônica (sync com supabase planos table + scripts/db-sync-planos.mjs):
//
//   Trial MEI       — 5 NFS-e/mês — sem cartão
//   Avulso MEI      — Pague por nota (R$ 5,99 cada)
//   MEI Mensal      — 5 NFS-e/mês
//   MEI Plus        — 15 NFS-e/mês
//   MEI Premium     — 100 NFS-e/mês
//   Trial ME        — 5 NFS-e/mês — sem cartão
//   ME Start        — 10 NFS-e/mês
//   ME Pro          — 50 NFS-e/mês
//   ME Business     — 300 NFS-e/mês
//
// Run: STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-fix-descriptions.mjs

const SK = process.env.STRIPE_SECRET_KEY
if (!SK) { console.error('STRIPE_SECRET_KEY env var required'); process.exit(1) }

const PRODUCTS = [
  { id: 'prod_UTAuGnSjKooV6n', name: 'NotaFácil MEI — Trial',   description: 'Emissão de até 5 NFS-e por mês — sem cartão de crédito' },
  { id: 'prod_UeJSM77dfSTAMh', name: 'NotaFácil MEI — Avulso',  description: 'Pague por nota emitida — R$ 5,99 cada (sem mensalidade)' },
  { id: 'prod_UTAuH8TnTrImYZ', name: 'NotaFácil MEI — Mensal',  description: 'Emissão de até 5 NFS-e por mês' },
  { id: 'prod_UeJSsdo3wmCL0w', name: 'NotaFácil MEI — Plus',    description: 'Emissão de até 15 NFS-e por mês' },
  { id: 'prod_UeJSXqYbRpSGnA', name: 'NotaFácil MEI — Premium', description: 'Emissão de até 100 NFS-e por mês' },
  { id: 'prod_UeJS80A40Z0kna', name: 'NotaFácil ME — Trial',    description: 'Emissão de até 5 NFS-e por mês — sem cartão de crédito' },
  { id: 'prod_UTAu7miepp5T7v', name: 'NotaFácil ME — Start',    description: 'Emissão de até 10 NFS-e por mês' },
  { id: 'prod_UTAu0JaTLfKeYr', name: 'NotaFácil ME — Pro',      description: 'Emissão de até 50 NFS-e por mês' },
  { id: 'prod_UTAurjiADu5bWv', name: 'NotaFácil ME — Business', description: 'Emissão de até 300 NFS-e por mês' },
]

async function stripe(path, body) {
  const params = new URLSearchParams(body).toString()
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SK}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Stripe ${res.status}: ${err}`)
  }
  return res.json()
}

for (const p of PRODUCTS) {
  try {
    const updated = await stripe(`/v1/products/${p.id}`, {
      name: p.name,
      description: p.description,
    })
    console.log(`✅ ${updated.id.padEnd(20)} ${updated.name.padEnd(35)} — ${updated.description}`)
  } catch (e) {
    console.error(`❌ ${p.id}: ${e.message}`)
  }
}
