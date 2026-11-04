#!/usr/bin/env node
/**
 * check-conversao-pagante.mjs — os cadastros vindos de Ads viraram PAGANTES?
 *
 * Diferença de cadastro (trial grátis) para receita (assinatura paga). Cruza
 * empresas (origem paga) com plano_id, trial_fim e status de assinatura Stripe.
 *
 * Uso: node scripts/check-conversao-pagante.mjs [--desde AAAA-MM-DD]
 * Credenciais lidas de ACESSOS.local.md (nada é impresso).
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
  const t = readFileSync(join(RAIZ, 'ACESSOS.local.md'), 'utf8')
  const m =
    t.match(/DATABASE_URL\s*[=:]\s*[`"']?(postgres(?:ql)?:\/\/[^\s`"'\n]+)/i) ||
    t.match(/(postgres(?:ql)?:\/\/[^\s`"'\n]+)/i)
  if (!m) throw new Error('DATABASE_URL não encontrada')
  return m[1]
}

const client = new pg.Client({ connectionString: lerDatabaseUrl(), ssl: { rejectUnauthorized: false } })

try {
  await client.connect()

  // colunas defensivas: nem todo ambiente tem todas — descobrir quais existem
  const { rows: cols } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'empresas'`,
  )
  const has = (c) => cols.some((r) => r.column_name === c)

  const campos = [
    'e.created_at', 'e.razao_social', 'e.cnpj',
    has('trial_me') ? 'e.trial_me' : 'NULL::boolean AS trial_me',
    has('trial_fim') ? 'e.trial_fim' : 'NULL::timestamptz AS trial_fim',
    has('plano_id') ? 'e.plano_id' : 'NULL::uuid AS plano_id',
    has('stripe_customer_id') ? 'e.stripe_customer_id' : 'NULL::text AS stripe_customer_id',
  ]

  const joinPlano = has('plano_id')
    ? 'LEFT JOIN planos p ON p.id = e.plano_id'
    : 'LEFT JOIN planos p ON false'

  const { rows } = await client.query(
    `SELECT ${campos.join(', ')},
            p.nome AS plano_nome, p.preco_mensal_brl AS plano_preco
       FROM empresas e
       ${joinPlano}
      WHERE e.created_at >= $1
        AND (e.gclid IS NOT NULL OR e.utm_source IS NOT NULL)
      ORDER BY e.created_at DESC`,
    [DESDE],
  )

  // assinatura mais recente por empresa (se a tabela existir)
  let assinPorEmpresa = new Map()
  try {
    const { rows: assin } = await client.query(
      `SELECT DISTINCT ON (mei_id) mei_id, stripe_subscription_status, plano_id, competencia
         FROM emissoes_mensais
        ORDER BY mei_id, competencia DESC`,
    )
    // emissoes_mensais.mei_id referencia empresas.id neste schema
    assinPorEmpresa = new Map(assin.map((a) => [a.mei_id, a]))
  } catch { /* tabela pode não bater no ambiente — segue sem */ }

  console.log(`\n=== Conversão para PAGANTE — cadastros pagos desde ${DESDE} ===\n`)
  if (rows.length === 0) { console.log('Nenhum cadastro de origem paga no período.\n'); }

  for (const r of rows) {
    const quando = new Date(r.created_at).toLocaleString('pt-BR')
    const sub = assinPorEmpresa.get(r.id)
    const temPlano = !!r.plano_nome
    const trialAberto = r.trial_fim == null
    const statusSub = sub?.stripe_subscription_status ?? null

    let veredito
    if (statusSub === 'active') veredito = '💰 PAGANTE (assinatura active)'
    else if (statusSub) veredito = `⚠️ assinatura status="${statusSub}"`
    else if (temPlano && r.plano_preco > 0) veredito = `💰 plano pago atribuído: ${r.plano_nome}`
    else if (trialAberto) veredito = '🆓 ainda em TRIAL (não pagou)'
    else veredito = '🆓 trial encerrado, sem assinatura ativa'

    console.log(`  · ${quando} — ${r.razao_social ?? '(sem nome)'} — CNPJ ${r.cnpj ?? '—'}`)
    console.log(`      plano=${r.plano_nome ?? 'nenhum'}  trial_fim=${r.trial_fim ? new Date(r.trial_fim).toLocaleDateString('pt-BR') : 'aberto'}  stripe_customer=${r.stripe_customer_id ? 'sim' : 'não'}`)
    console.log(`      → ${veredito}\n`)
  }
} catch (e) {
  console.error(`ERRO: ${e.message}`)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
