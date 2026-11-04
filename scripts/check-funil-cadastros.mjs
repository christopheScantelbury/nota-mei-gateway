#!/usr/bin/env node
/**
 * check-funil-cadastros.mjs — até onde os cadastros pagos avançaram no funil?
 * Cadastrou → enviou certificado A1 → emitiu nota. Mede o gargalo real.
 * Uso: node scripts/check-funil-cadastros.mjs [--desde AAAA-MM-DD]
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const i = process.argv.indexOf('--desde')
const DESDE = i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : '2026-07-21'

const t = readFileSync(join(RAIZ, 'ACESSOS.local.md'), 'utf8')
const m =
  t.match(/DATABASE_URL\s*[=:]\s*[`"']?(postgres(?:ql)?:\/\/[^\s`"'\n]+)/i) ||
  t.match(/(postgres(?:ql)?:\/\/[^\s`"'\n]+)/i)
const c = new pg.Client({ connectionString: m[1], ssl: { rejectUnauthorized: false } })

try {
  await c.connect()
  const { rows } = await c.query(
    `SELECT e.razao_social, e.cnpj, e.created_at, e.cert_valid_until,
            COUNT(n.id)::int AS total_notas,
            COUNT(n.id) FILTER (WHERE n.status='AUTORIZADA')::int AS autorizadas,
            COUNT(n.id) FILTER (WHERE n.status='REJEITADA')::int AS rejeitadas,
            COUNT(n.id) FILTER (WHERE n.status IN ('PROCESSANDO','ERRO_TEMPORARIO'))::int AS pendentes,
            MAX(n.created_at) AS ultima_nota
       FROM empresas e
       LEFT JOIN notas_fiscais n ON n.empresa_id = e.id
      WHERE e.created_at >= $1
        AND (e.gclid IS NOT NULL OR e.utm_source IS NOT NULL)
      GROUP BY e.id, e.razao_social, e.cnpj, e.created_at, e.cert_valid_until
      ORDER BY e.created_at DESC`,
    [DESDE],
  )
  console.log(`\n=== Funil dos cadastros pagos desde ${DESDE} ===`)
  for (const r of rows) {
    const cert = r.cert_valid_until
      ? `ENVIADO (validade ${new Date(r.cert_valid_until).toLocaleDateString('pt-BR')})`
      : 'NÃO enviado'
    console.log(`\n· ${r.razao_social} — CNPJ ${r.cnpj}`)
    console.log(`  cadastro       : ${new Date(r.created_at).toLocaleString('pt-BR')}`)
    console.log(`  certificado A1 : ${cert}`)
    console.log(`  notas          : ${r.total_notas} (${r.autorizadas} autorizadas · ${r.rejeitadas} rejeitadas · ${r.pendentes} pendentes)`)
    if (r.ultima_nota) console.log(`  última nota    : ${new Date(r.ultima_nota).toLocaleString('pt-BR')}`)
  }
  console.log('')
} catch (e) {
  console.error(`ERRO: ${e.message}`)
  process.exitCode = 1
} finally {
  await c.end().catch(() => {})
}
