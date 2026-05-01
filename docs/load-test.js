/**
 * k6 Load Test — Nota MEI Gateway
 *
 * Usage:
 *   k6 run docs/load-test.js \
 *     -e API_URL=https://api.notameigateway.com.br \
 *     -e API_KEY=sk_test_<your-key>
 *
 * Scenarios:
 *   smoke    — 1 VU × 30s  (baseline sanity)
 *   load     — ramp to 50 VUs over 2 min, hold 5 min
 *   spike    — sudden burst to 200 VUs for 30s
 *
 * Thresholds:
 *   p95 latency < 500 ms
 *   error rate  < 1 %
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const errorRate = new Rate('errors')
const emitLatency = new Trend('emit_latency', true)

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { scenario: 'smoke' },
    },
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      startTime: '35s',
      tags: { scenario: 'load' },
    },
    spike: {
      executor: 'constant-vus',
      vus: 200,
      duration: '30s',
      startTime: '9m',
      tags: { scenario: 'spike' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
  },
}

const BASE_URL = __ENV.API_URL || 'http://localhost:8080'
const API_KEY  = __ENV.API_KEY  || 'sk_test_placeholder'

const HEADERS = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type':  'application/json',
}

/** 1 ── Health check (unauthenticated) */
function checkHealth() {
  const res = http.get(`${BASE_URL}/v1/health`)
  const ok = check(res, {
    'health 200': (r) => r.status === 200,
    'health status ok': (r) => {
      try { return JSON.parse(r.body).status === 'ok' } catch { return false }
    },
  })
  errorRate.add(!ok)
}

/** 2 ── List notas (paginated read, authenticated) */
function listNotas() {
  const res = http.get(`${BASE_URL}/v1/nfse?limit=20`, { headers: HEADERS })
  const ok = check(res, {
    'list 200': (r) => r.status === 200,
    'list has data key': (r) => {
      try { return Array.isArray(JSON.parse(r.body).data) } catch { return false }
    },
  })
  errorRate.add(!ok)
}

/** 3 ── Emit nota (write, authenticated) */
function emitNota() {
  const payload = JSON.stringify({
    servico: {
      codigo_nbs:    '01.01.01.10',
      discriminacao: `Serviço de desenvolvimento — k6 test ${Date.now()}`,
      valor:         1500.00,
      aliquota_iss:  2.0,
    },
    tomador: {
      tipo:        'PJ',
      documento:   '12345678000190',
      razao_social:'Empresa Teste k6 LTDA',
      email:       'test@k6.io',
    },
    competencia: new Date().toISOString().slice(0, 7), // YYYY-MM
  })

  const start = Date.now()
  const res = http.post(`${BASE_URL}/v1/nfse`, payload, { headers: HEADERS })
  emitLatency.add(Date.now() - start)

  const ok = check(res, {
    'emit 202': (r) => r.status === 202,
    'emit has nota_id': (r) => {
      try { return !!JSON.parse(r.body).nota_id } catch { return false }
    },
  })
  errorRate.add(!ok)
  return res
}

/** 4 ── Billing usage */
function checkUsage() {
  const res = http.get(`${BASE_URL}/v1/billing/usage`, { headers: HEADERS })
  const ok = check(res, {
    'usage 200': (r) => r.status === 200,
  })
  errorRate.add(!ok)
}

export default function () {
  checkHealth()
  sleep(0.5)

  listNotas()
  sleep(0.5)

  const emitRes = emitNota()
  sleep(1)

  // If we got a nota_id back, immediately fetch it to test the GET endpoint.
  if (emitRes.status === 202) {
    try {
      const { nota_id } = JSON.parse(emitRes.body)
      if (nota_id) {
        const detailRes = http.get(`${BASE_URL}/v1/nfse/${nota_id}`, { headers: HEADERS })
        check(detailRes, { 'detail 200 or 404': (r) => r.status === 200 || r.status === 404 })
      }
    } catch (_) { /* ignore parse errors */ }
  }

  checkUsage()
  sleep(1)
}
