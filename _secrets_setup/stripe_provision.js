#!/usr/bin/env node
/**
 * Stripe Provisioning Script — Nota MEI Gateway
 *
 * Cria automaticamente:
 *   1. Produtos + Preços para cada plano (Trial, Starter, Basic, Pro, Business)
 *   2. Webhook endpoint registrado na sua URL de produção
 *   3. Imprime todos os price_IDs prontos para Railway
 *
 * PRÉ-REQUISITOS:
 *   1. Ter conta Stripe (https://dashboard.stripe.com/register)
 *   2. Ter a Secret Key (sk_live_... ou sk_test_...) — Dashboard → Developers → API Keys
 *
 * COMO RODAR:
 *   STRIPE_SECRET_KEY=sk_live_xxx node _secrets_setup/stripe_provision.js
 *
 * Para modo de teste primeiro:
 *   STRIPE_SECRET_KEY=sk_test_xxx node _secrets_setup/stripe_provision.js
 */

const https = require('https');

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) {
  console.error('❌ Defina STRIPE_SECRET_KEY antes de rodar:\n   STRIPE_SECRET_KEY=sk_... node stripe_provision.js');
  process.exit(1);
}

const WEBHOOK_URL = 'https://api.notameigateway.com.br/v1/webhooks/stripe';

// Flatten nested objects into Stripe's bracket notation: { a: { b: 1 } } → "a[b]=1"
function flattenParams(obj, prefix) {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      parts.push(...flattenParams(v, key));
    } else if (Array.isArray(v)) {
      v.forEach(item => parts.push(`${encodeURIComponent(key + '[]')}=${encodeURIComponent(item)}`));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    }
  }
  return parts;
}
function encodeBody(data) { return flattenParams(data, '').join('&'); }

const PLANS = [
  { nome: 'Trial',    limite: 5,    preco: 0,      excedente: 0 },
  { nome: 'Starter',  limite: 30,   preco: 4900,   excedente: 190 },  // R$49/mês, R$1,90/nota extra
  { nome: 'Basic',    limite: 100,  preco: 9900,   excedente: 120 },  // R$99/mês
  { nome: 'Pro',      limite: 300,  preco: 19900,  excedente: 90 },   // R$199/mês
  { nome: 'Business', limite: 1000, preco: 39900,  excedente: 60 },   // R$399/mês
];

function stripePost(path, data) {
  return new Promise((resolve, reject) => {
    const body = encodeBody(data);
    const opts = {
      hostname: 'api.stripe.com',
      path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      }
    };
    const req = https.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        const parsed = JSON.parse(d);
        if (parsed.error) reject(new Error(parsed.error.message));
        else resolve(parsed);
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

function stripeGet(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.stripe.com', path, method: 'GET',
      headers: { 'Authorization': `Bearer ${STRIPE_KEY}` }
    };
    https.get(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        const parsed = JSON.parse(d);
        if (parsed.error) reject(new Error(parsed.error.message));
        else resolve(parsed);
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('\n🔧 Provisionando Stripe para Nota MEI Gateway...\n');
  console.log(`   Modo: ${STRIPE_KEY.startsWith('sk_live') ? '🔴 PRODUÇÃO' : '🟡 TESTE'}\n`);

  const priceIds = {};

  for (const plan of PLANS) {
    console.log(`📦 Criando plano ${plan.nome}...`);

    // Criar produto
    const product = await stripePost('/v1/products', {
      name: `Nota MEI Gateway — ${plan.nome}`,
      description: `Emissão de até ${plan.limite} NFS-e por mês`,
      metadata: { plano: plan.nome.toLowerCase(), limite: plan.limite },
    });
    console.log(`   ✅ Produto: ${product.id}`);

    let priceId;
    if (plan.preco === 0) {
      // Trial — sem cobrança, usar preço simbólico de R$0
      const price = await stripePost('/v1/prices', {
        product: product.id,
        currency: 'brl',
        unit_amount: 0,
        recurring: { interval: 'month' },
        metadata: { plano: plan.nome.toLowerCase() },
      });
      priceId = price.id;
    } else {
      // Plano pago — preço fixo mensal
      const price = await stripePost('/v1/prices', {
        product: product.id,
        currency: 'brl',
        unit_amount: plan.preco,
        recurring: { interval: 'month' },
        metadata: { plano: plan.nome.toLowerCase() },
      });
      priceId = price.id;

      // Billing Meter (API v2025 exige meter antes do metered price)
      const eventName = `nfse_excedente_${plan.nome.toLowerCase()}`;
      const meter = await stripePost('/v1/billing/meters', {
        event_name: eventName,
        display_name: `Excedente NFS-e — ${plan.nome}`,
        default_aggregation: { formula: 'sum' },
      });
      console.log(`   ✅ Meter: ${meter.id} (event: ${eventName})`);

      // Preço de excedente vinculado ao meter
      const meteredPrice = await stripePost('/v1/prices', {
        product: product.id,
        currency: 'brl',
        unit_amount: plan.excedente,
        billing_scheme: 'per_unit',
        recurring: { interval: 'month', usage_type: 'metered', meter: meter.id },
        metadata: { plano: plan.nome.toLowerCase(), tipo: 'excedente', meter_id: meter.id },
      });
      console.log(`   ✅ Preço excedente: ${meteredPrice.id}`);
    }

    console.log(`   ✅ Price ID: ${priceId}`);
    priceIds[plan.nome] = priceId;
  }

  // Criar webhook endpoint
  console.log('\n📡 Registrando webhook endpoint...');
  const webhook = await stripePost('/v1/webhook_endpoints', {
    url: WEBHOOK_URL,
    enabled_events: [
      'invoice.paid',
      'invoice.payment_failed',
      'customer.subscription.deleted',
      'customer.subscription.updated',
    ],
    description: 'Nota MEI Gateway — eventos de billing',
  });
  console.log(`   ✅ Webhook criado: ${webhook.id}`);
  console.log(`   🔑 Webhook Secret: ${webhook.secret}`);

  // Output final
  console.log('\n' + '='.repeat(70));
  console.log('✅ Stripe provisionado! Copie as vars abaixo:\n');
  console.log(`STRIPE_SECRET_KEY=${STRIPE_KEY}`);
  console.log(`STRIPE_WEBHOOK_SECRET=${webhook.secret}`);
  console.log(`STRIPE_PRICE_STARTER=${priceIds['Starter']}`);
  console.log(`STRIPE_PRICE_BASIC=${priceIds['Basic']}`);
  console.log(`STRIPE_PRICE_PRO=${priceIds['Pro']}`);
  console.log(`STRIPE_PRICE_BUSINESS=${priceIds['Business']}`);
  console.log('='.repeat(70));
  console.log('\n📋 Próximos passos:');
  console.log('   1. Copie as vars acima para ACESSOS.local.md (seção Stripe)');
  console.log('   2. Configure no Railway:');
  console.log('      railway variables set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... etc');
  console.log('   3. Configure no Vercel:');
  console.log('      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... (Dashboard → API Keys)');
}

main().catch(err => {
  console.error('\n❌ Erro:', err.message);
  process.exit(1);
});
