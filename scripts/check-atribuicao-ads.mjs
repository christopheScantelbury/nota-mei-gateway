#!/usr/bin/env node
/**
 * check-atribuicao-ads.mjs — responde "a campanha do Google Ads gerou cadastro?"
 *
 * Lê direto do banco (fonte da verdade), não do GA4. O GA4 só enxerga quem
 * aceita cookies; o banco enxerga todo mundo. Essa é a razão de existir deste
 * script — ver docs do incidente de atribuição de 2026-07-21.
 *
 * Uso:  node scripts/check-atribuicao-ads.mjs [--desde AAAA-MM-DD]
 * Default: --desde 2026-07-21 (dia em que a correção de atribuição entrou no ar
 * e o contador do teste foi zerado).
 *
 * Credenciais: lidas de ACESSOS.local.md (não commitado). Nada é impresso.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const DESDE = (() => {
  const i = process.argv.indexOf('--desde')
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : '2026-07-21'
})()

function lerDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const texto = readFileSync(join(RAIZ, 'ACESSOS.local.md'), 'utf8')
  // aceita `DATABASE_URL=...`, `DATABASE_URL: ...` e a URL crua em bloco de código
  const m =
    texto.match(/DATABASE_URL\s*[=:]\s*[`"']?(postgres(?:ql)?:\/\/[^\s`"'\n]+)/i) ||
    texto.match(/(postgres(?:ql)?:\/\/[^\s`"'\n]+)/i)
  if (!m) throw new Error('DATABASE_URL não encontrada em ACESSOS.local.md nem no ambiente')
  return m[1]
}

const client = new pg.Client({
  connectionString: lerDatabaseUrl(),
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()

  const { rows: pagos } = await client.query(
    `SELECT created_at, razao_social, cnpj, gclid, utm_source, utm_campaign, utm_term
       FROM empresas
      WHERE created_at >= $1
        AND (gclid IS NOT NULL OR utm_source IS NOT NULL)
      ORDER BY created_at DESC`,
    [DESDE],
  )

  const { rows: [totais] } = await client.query(
    `SELECT COUNT(*)::int AS todos,
            COUNT(*) FILTER (WHERE gclid IS NOT NULL)::int AS com_gclid
       FROM empresas
      WHERE created_at >= $1`,
    [DESDE],
  )

  console.log(`\n=== Atribuição de cadastros desde ${DESDE} ===\n`)
  console.log(`Cadastros totais no período : ${totais.todos}`)
  console.log(`Vindos de tráfego pago      : ${totais.com_gclid}`)

  if (pagos.length === 0) {
    console.log('\n>> NENHUM cadastro atribuído a tráfego pago no período.\n')
  } else {
    console.log('\nDetalhe dos cadastros com origem rastreada:\n')
    for (const r of pagos) {
      const quando = new Date(r.created_at).toLocaleString('pt-BR')
      console.log(`  · ${quando} — ${r.razao_social ?? '(sem razão social)'} — CNPJ ${r.cnpj ?? '—'}`)
      console.log(`      gclid=${r.gclid ? 'sim' : 'não'}  utm_source=${r.utm_source ?? '—'}  campanha=${r.utm_campaign ?? '—'}  termo=${r.utm_term ?? '—'}`)
    }
    console.log('')
  }
} catch (erro) {
  console.error(`ERRO: ${erro.message}`)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
