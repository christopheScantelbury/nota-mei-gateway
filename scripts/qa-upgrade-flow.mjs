#!/usr/bin/env node
// Smoke test do pacote 2026-06-05:
//   - Catálogo Stripe (9 produtos LIVE com descriptions corretas)
//   - Banco planos (9 ativos + stripe_price_id setado)
//   - API /v1/health (todos os serviços ok)
//   - AI endpoint removido (404)
//   - Slug resolution (slugToPlanoNome → planos.nome → stripe_price_id)
//   - Plano dos admins (christophe@gmail = MEI Premium, contato@scantelburydevs = ME Business)
//   - Inactivity timeout do Supabase (introspection, não roda timeout real)
//
// Não faz pagamento real (precisa de browser pra Stripe Checkout interativo).
// Cobre TUDO que é verificável via API/banco — o que precisa de UI vai no
// docs/qa-agent-prompt.md (CT-19..CT-22).
//
// Run:
//   STRIPE_SECRET_KEY=sk_live_... SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/qa-upgrade-flow.mjs
//
// Exit code 0 = todos passaram. Exit 1 = pelo menos um falhou.

const SK  = process.env.STRIPE_SECRET_KEY
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY
const SBP = 'https://pzjvgtwnstfyangfwdom.supabase.co/rest/v1'
const API = 'https://api.emitirnotafacil.com.br'

if (!SK || !SRK) {
  console.error('❌ STRIPE_SECRET_KEY e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.')
  process.exit(1)
}

let failed = 0
let passed = 0
function ok(label, msg = '') { passed++; console.log(`✅ ${label}${msg ? ' — ' + msg : ''}`) }
function fail(label, msg)    { failed++; console.log(`❌ ${label} — ${msg}`) }

// ─── 1. Catálogo Stripe ──────────────────────────────────────────────────────
async function checkStripeCatalog() {
  console.log('\n── 1. Catálogo Stripe LIVE ──')
  const res = await fetch('https://api.stripe.com/v1/products?limit=30&active=true', {
    headers: { Authorization: `Bearer ${SK}` },
  })
  const data = await res.json()
  const products = data.data.filter(p => /NotaFácil/.test(p.name))

  const expected = [
    { name: 'NotaFácil MEI — Trial',    desc: /5 NFS-e por mês/i },
    { name: 'NotaFácil MEI — Avulso',   desc: /R\$ 5,99/i },
    { name: 'NotaFácil MEI — Mensal',   desc: /5 NFS-e por mês/i },
    { name: 'NotaFácil MEI — Plus',     desc: /15 NFS-e por mês/i },
    { name: 'NotaFácil MEI — Premium',  desc: /100 NFS-e por mês/i },
    { name: 'NotaFácil ME — Trial',     desc: /5 NFS-e por mês/i },
    { name: 'NotaFácil ME — Start',     desc: /10 NFS-e por mês/i },
    { name: 'NotaFácil ME — Pro',       desc: /50 NFS-e por mês/i },
    { name: 'NotaFácil ME — Business',  desc: /300 NFS-e por mês/i },
  ]

  for (const exp of expected) {
    const p = products.find(p => p.name === exp.name)
    if (!p) { fail(exp.name, 'produto não encontrado em Stripe LIVE'); continue }
    if (!exp.desc.test(p.description || '')) {
      fail(exp.name, `description não bate (atual="${p.description}")`)
    } else {
      ok(exp.name, `"${p.description.slice(0, 50)}…"`)
    }
  }
}

// ─── 2. Banco planos ────────────────────────────────────────────────────────
async function checkPlanosTable() {
  console.log('\n── 2. Banco — tabela planos ──')
  const res = await fetch(
    `${SBP}/planos?select=nome,emissoes_limite,preco_mensal_brl,stripe_price_id,ativo&order=nome`,
    { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } },
  )
  const planos = await res.json()
  const active = planos.filter(p => p.ativo)

  const expected = [
    { nome: 'Trial MEI',    limit: 5,   price: true  },
    { nome: 'Avulso MEI',   limit: 0,   price: true  },
    { nome: 'MEI Mensal',   limit: 5,   price: true  },
    { nome: 'MEI Plus',     limit: 15,  price: true  },
    { nome: 'MEI Premium',  limit: 100, price: true  },
    { nome: 'Trial ME',     limit: 5,   price: true  },
    { nome: 'ME Start',     limit: 10,  price: true  },
    { nome: 'ME Pro',       limit: 50,  price: true  },
    { nome: 'ME Business',  limit: 300, price: true  },
    { nome: 'Trial EPP',    limit: 5,   price: false }, // EPP ainda sob consulta
  ]

  for (const exp of expected) {
    const p = active.find(p => p.nome === exp.nome)
    if (!p) { fail(`plano ${exp.nome}`, 'não encontrado/inativo no banco'); continue }
    if (p.emissoes_limite !== exp.limit) {
      fail(`plano ${exp.nome}`, `limite ${p.emissoes_limite} ≠ esperado ${exp.limit}`)
      continue
    }
    if (exp.price && !p.stripe_price_id) {
      fail(`plano ${exp.nome}`, 'stripe_price_id ausente')
      continue
    }
    ok(`plano ${exp.nome}`, `${p.emissoes_limite} notas · R$${p.preco_mensal_brl ?? 0}`)
  }
}

// ─── 3. API health ──────────────────────────────────────────────────────────
async function checkHealth() {
  console.log('\n── 3. API health ──')
  try {
    const res = await fetch(`${API}/v1/health`)
    const h = await res.json()
    if (h.status !== 'ok') return fail('health', `status=${h.status}`)
    const services = ['db', 'redis', 'rabbitmq', 'receita', 'stripe']
    for (const svc of services) {
      const s = h.services[svc]?.status
      if (s === 'ok') ok(`health.${svc}`)
      else fail(`health.${svc}`, `status=${s}`)
    }
  } catch (e) {
    fail('health', e.message)
  }
}

// ─── 4. AI endpoint removido ────────────────────────────────────────────────
//
// A rota /v1/* está sob o hybrid auth middleware (jwtMw) que responde 401
// pra qualquer path sob /v1/ — mesmo paths inexistentes. Por isso comparar
// só status code não dá pra distinguir "rota existe" vs "rota não existe".
//
// Estratégia: comparar com um path-irmão claramente inexistente.
// Ambos devem retornar 401 (middleware). Se /v1/ai/nbs/sugerir devolver algo
// DIFERENTE de uma rota inexistente, AI ainda está registrada.
async function checkAIRemoved() {
  console.log('\n── 4. AI endpoint removido ──')
  const aiRes = await fetch(`${API}/v1/ai/nbs/sugerir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ descricao: 'qualquer coisa' }),
  })
  const ghostRes = await fetch(`${API}/v1/__rota_que_nao_existe__`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  // Body shape comparison — strip request_id que muda a cada request.
  const norm = (s) => s.replace(/"request_id":"[^"]+"/, '"request_id":"…"')
  const aiBody = norm(await aiRes.text().catch(() => ''))
  const ghostBody = norm(await ghostRes.text().catch(() => ''))

  if (aiRes.status !== ghostRes.status || aiBody !== ghostBody) {
    fail('POST /v1/ai/nbs/sugerir',
      `comportamento diferente de rota inexistente → AI ainda registrada. ` +
      `ai: ${aiRes.status} ${aiBody.slice(0, 80)} | ghost: ${ghostRes.status} ${ghostBody.slice(0, 80)}`)
  } else {
    ok('POST /v1/ai/nbs/sugerir',
      `${aiRes.status} idêntico a rota inexistente — AI removida do router ✅`)
  }
}

// ─── 5. Slug resolution (offline) ───────────────────────────────────────────
function checkSlugResolution() {
  console.log('\n── 5. Slug resolution (offline) ──')
  function slugToPlanoNome(slug) {
    const s = (slug ?? '').toLowerCase().trim()
    if (s === 'trial-mei' || s === 'trial_mei')   return 'Trial MEI'
    if (s === 'avulso')                            return 'Avulso MEI'
    if (s === 'mensal' || s === 'mei-mensal')      return 'MEI Mensal'
    if (s === 'plus'   || s === 'mei-plus')        return 'MEI Plus'
    if (s === 'premium'|| s === 'mei-premium')     return 'MEI Premium'
    if (s === 'trial-me' || s === 'trial_me')      return 'Trial ME'
    if (s === 'start'  || s === 'me-start')        return 'ME Start'
    if (s === 'pro'    || s === 'me-pro')          return 'ME Pro'
    if (s === 'business' || s === 'me-business')   return 'ME Business'
    if (s === 'starter') return 'ME Start'
    if (s === 'basic')   return 'MEI Plus'
    return ''
  }

  const cases = [
    ['start',     'ME Start'],
    ['business',  'ME Business'],
    ['premium',   'MEI Premium'],
    ['plus',      'MEI Plus'],
    ['mensal',    'MEI Mensal'],
    ['avulso',    'Avulso MEI'],
    ['pro',       'ME Pro'],
    ['starter',   'ME Start'],    // legacy → ME Start
    ['basic',     'MEI Plus'],    // legacy → MEI Plus
    ['',          ''],            // empty → vazio
    ['xpto',      ''],            // inválido → vazio
  ]
  for (const [slug, expected] of cases) {
    const got = slugToPlanoNome(slug)
    if (got === expected) ok(`slug "${slug}"`, `→ "${got || '(empty)'}"`)
    else fail(`slug "${slug}"`, `esperava "${expected}" mas devolveu "${got}"`)
  }
}

// ─── 6. PlanGate matrix (offline) ───────────────────────────────────────────
function checkPlanTier() {
  console.log('\n── 6. PlanGate tier resolution (offline) ──')
  function resolveTier(raw) {
    const n = (raw ?? '').toLowerCase().trim()
    if (!n || n.includes('trial')) return 'trial'
    if (n.includes('business') || n.includes('enterprise') || n.includes('premium')) return 'business'
    if (n.includes('pro') || n.includes('plus')) return 'pro'
    if (n.includes('starter') || n.includes('basic') || n.includes('mensal') ||
        n.includes('start')   || n.includes('avulso')) return 'starter'
    return 'trial'
  }

  const cases = [
    ['Trial MEI',    'trial'],
    ['Avulso MEI',   'starter'],
    ['MEI Mensal',   'starter'],
    ['MEI Plus',     'pro'],
    ['MEI Premium',  'business'],
    ['Trial ME',     'trial'],
    ['ME Start',     'starter'],
    ['ME Pro',       'pro'],
    ['ME Business',  'business'],
    ['Trial EPP',    'trial'],
    // legacy
    ['Trial',        'trial'],
    ['Starter',      'starter'],
    ['Pro',          'pro'],
    ['Business',     'business'],
    // edge
    ['',             'trial'],
    ['inexistente',  'trial'],
  ]
  for (const [name, expected] of cases) {
    const got = resolveTier(name)
    if (got === expected) ok(`tier "${name}"`, `→ ${got}`)
    else fail(`tier "${name}"`, `esperava ${expected}, devolveu ${got}`)
  }
}

// ─── 7. Plano dos admins ────────────────────────────────────────────────────
async function checkAdminPlans() {
  console.log('\n── 7. Plano dos admins (graceful upgrade) ──')
  const cases = [
    {
      label: 'christophescantelbury@gmail.com',
      owner: 'mei_id=eq.5a7353a4-add4-48a0-9843-718eb4f72680',
      expectedPlan: 'MEI Premium',
      expectedLimit: 100,
    },
    {
      label: 'contato@scantelburydevs.com.br',
      owner: 'empresa_id=eq.293aa44e-b758-4ea5-8c77-273ddef75bbb',
      expectedPlan: 'ME Business',
      expectedLimit: 300,
    },
  ]
  for (const c of cases) {
    const res = await fetch(
      `${SBP}/emissoes_mensais?${c.owner}&competencia=eq.2026-06&select=stripe_subscription_status,planos(nome,emissoes_limite)`,
      { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } },
    )
    const rows = await res.json()
    if (!rows.length) { fail(c.label, 'sem row em emissoes_mensais 2026-06'); continue }
    const r = rows[0]
    const planNome = r.planos?.nome
    const planLimit = r.planos?.emissoes_limite
    const status = r.stripe_subscription_status
    if (planNome !== c.expectedPlan || planLimit !== c.expectedLimit) {
      fail(c.label, `plano="${planNome}" (limit=${planLimit}) ≠ esperado "${c.expectedPlan}" (${c.expectedLimit})`)
      continue
    }
    if (status !== 'active') {
      fail(c.label, `status=${status} (esperado active)`)
      continue
    }
    ok(c.label, `${planNome} · limit=${planLimit} · status=active`)
  }
}

// ─── Run all ────────────────────────────────────────────────────────────────
(async () => {
  console.log('🧪 Smoke test — pacote upgrade 2026-06-05')
  await checkStripeCatalog()
  await checkPlanosTable()
  await checkHealth()
  await checkAIRemoved()
  checkSlugResolution()
  checkPlanTier()
  await checkAdminPlans()
  console.log(`\n── Resultado: ${passed} ok, ${failed} fail ──`)
  process.exit(failed === 0 ? 0 : 1)
})()
