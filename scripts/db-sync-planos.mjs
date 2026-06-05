import https from 'https'

const SR = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SR) throw new Error('SUPABASE_SERVICE_ROLE_KEY required')

const PLANOS = [
  // MEI
  { nome: 'Trial MEI',     tipo_empresa: 'MEI', emissoes_limite: 5,    preco_mensal_brl: 0,      preco_excedente_brl: 0,    stripe_price_id: 'price_1Tf0psQkYQoRUOWm2igKaLQS', stripe_product_id: 'prod_UTAuGnSjKooV6n', ativo: true },
  { nome: 'Avulso MEI',    tipo_empresa: 'MEI', emissoes_limite: 0,    preco_mensal_brl: 0,      preco_excedente_brl: 5.99, stripe_price_id: 'price_1Tf0r8QkYQoRUOWmXDS4AyAA', stripe_product_id: 'prod_UeJSM77dfSTAMh', ativo: true },
  { nome: 'MEI Mensal',    tipo_empresa: 'MEI', emissoes_limite: 5,    preco_mensal_brl: 19.90,  preco_excedente_brl: 0.80, stripe_price_id: 'price_1Tf0r7QkYQoRUOWmHJ0JRjod', stripe_product_id: 'prod_UTAuH8TnTrImYZ', ativo: true },
  { nome: 'MEI Plus',      tipo_empresa: 'MEI', emissoes_limite: 15,   preco_mensal_brl: 39.90,  preco_excedente_brl: 0.50, stripe_price_id: 'price_1Tf0r8QkYQoRUOWmsc74N6sq', stripe_product_id: 'prod_UeJSsdo3wmCL0w', ativo: true },
  { nome: 'MEI Premium',   tipo_empresa: 'MEI', emissoes_limite: 100,  preco_mensal_brl: 79.90,  preco_excedente_brl: 0.30, stripe_price_id: 'price_1Tf0r8QkYQoRUOWmGWYfkoWT', stripe_product_id: 'prod_UeJSXqYbRpSGnA', ativo: true },
  // ME/EPP
  { nome: 'Trial ME',      tipo_empresa: 'ME',  emissoes_limite: 5,    preco_mensal_brl: 0,      preco_excedente_brl: 0,    stripe_price_id: 'price_1Tf0r8QkYQoRUOWmEsgIim8Q', stripe_product_id: 'prod_UeJS80A40Z0kna', ativo: true },
  { nome: 'ME Start',      tipo_empresa: 'ME',  emissoes_limite: 10,   preco_mensal_brl: 59.99,  preco_excedente_brl: 0.80, stripe_price_id: 'price_1Tf0psQkYQoRUOWmuQnm2z3a', stripe_product_id: 'prod_UTAu7miepp5T7v', ativo: true },
  { nome: 'ME Pro',        tipo_empresa: 'ME',  emissoes_limite: 50,   preco_mensal_brl: 149.90, preco_excedente_brl: 0.60, stripe_price_id: 'price_1Tf0r7QkYQoRUOWmVFu5FET4', stripe_product_id: 'prod_UTAu0JaTLfKeYr', ativo: true },
  { nome: 'ME Business',   tipo_empresa: 'ME',  emissoes_limite: 300,  preco_mensal_brl: 299.90, preco_excedente_brl: 0.40, stripe_price_id: 'price_1Tf0r7QkYQoRUOWmFnBiJrmI', stripe_product_id: 'prod_UTAurjiADu5bWv', ativo: true },
  // Trial EPP mantém pra compat (empresa contato@scantelburydevs já tá nele)
  { nome: 'Trial EPP',     tipo_empresa: 'EPP', emissoes_limite: 5,    preco_mensal_brl: 0,      preco_excedente_brl: 0,    stripe_price_id: null, stripe_product_id: null, ativo: true },
]

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : ''
    const r = https.request({
      hostname: 'pzjvgtwnstfyangfwdom.supabase.co',
      path: '/rest/v1' + path,
      method,
      headers: {
        apikey: SR,
        Authorization: 'Bearer ' + SR,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let d = ''
      res.on('data', c => (d += c))
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: d ? JSON.parse(d) : null }) }
        catch (e) { resolve({ status: res.statusCode, raw: d }) }
      })
    })
    r.on('error', reject)
    if (data) r.write(data)
    r.end()
  })
}

const all = await req('GET', '/planos?select=id,nome,tipo_empresa,ativo')
console.log('Planos atuais:', all.json.length)

// Desativar tudo
const deactivated = await req('PATCH', '/planos?id=not.is.null', { ativo: false })
console.log('Desativados:', (deactivated.json || []).length)

// Upsert
for (const p of PLANOS) {
  const existing = all.json.find(x => x.nome === p.nome && x.tipo_empresa === p.tipo_empresa)
  if (existing) {
    const u = await req('PATCH', `/planos?id=eq.${existing.id}`, p)
    console.log('  ✓ updated', p.nome, u.status)
  } else {
    const c = await req('POST', '/planos', p)
    console.log('  ✓ created', p.nome, c.status, c.json?.[0]?.id || '')
  }
}

const final = await req('GET', '/planos?ativo=eq.true&select=nome,emissoes_limite,preco_mensal_brl,preco_excedente_brl,tipo_empresa&order=tipo_empresa.asc,preco_mensal_brl.asc')
console.log('\n=== Planos ativos finais ===')
console.table(final.json)
