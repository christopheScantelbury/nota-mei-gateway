import https from 'https'
import { URLSearchParams } from 'url'

const SK = process.env.STRIPE_SECRET_KEY
if (!SK) throw new Error('STRIPE_SECRET_KEY required')

const PRICES_TO_CREATE = [
  // Apenas os que faltam (Trial MEI e ME Start já criados antes do crash)
  { product: 'prod_UTAuH8TnTrImYZ', name: 'NotaFácil MEI — Mensal',   amount: 1990,  recurring: true },
  { product: 'prod_UTAu0JaTLfKeYr', name: 'NotaFácil ME — Pro',       amount: 14990, recurring: true },
  { product: 'prod_UTAurjiADu5bWv', name: 'NotaFácil ME — Business',  amount: 29990, recurring: true },
  { product: 'prod_UeJSM77dfSTAMh', name: 'NotaFácil MEI — Avulso',   amount: 599,   recurring: false },
  { product: 'prod_UeJSsdo3wmCL0w', name: 'NotaFácil MEI — Plus',     amount: 3990,  recurring: true },
  { product: 'prod_UeJSXqYbRpSGnA', name: 'NotaFácil MEI — Premium',  amount: 7990,  recurring: true },
  { product: 'prod_UeJS80A40Z0kna', name: 'NotaFácil ME — Trial',     amount: 0,     recurring: true },
]

function stripeCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? new URLSearchParams(body).toString() : ''
    const req = https.request({
      hostname: 'api.stripe.com',
      path: '/v1' + path,
      method,
      headers: {
        Authorization: 'Bearer ' + SK,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
      },
    }, res => {
      let d = ''
      res.on('data', c => (d += c))
      res.on('end', () => {
        try {
          const j = JSON.parse(d)
          res.statusCode < 400 ? resolve(j) : reject(new Error(j.error?.message))
        } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

const results = {}
for (const p of PRICES_TO_CREATE) {
  const body = {
    product: p.product,
    currency: 'brl',
    unit_amount: String(p.amount),
    nickname: p.name + ' — base',
  }
  if (p.recurring) body['recurring[interval]'] = 'month'
  try {
    const price = await stripeCall('POST', '/prices', body)
    console.log('  ✓', price.id, '·', p.name, '· R$', (p.amount/100).toFixed(2), p.recurring ? '/mês' : '/nota')
    results[p.name] = price.id
  } catch (e) {
    console.error('  ✗', p.name, '·', e.message)
  }
}

console.log('\nResults:', JSON.stringify(results, null, 2))
