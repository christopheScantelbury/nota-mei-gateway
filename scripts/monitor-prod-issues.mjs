#!/usr/bin/env node
// Monitor de produção → issues no GitHub.
//
// Roda no GitHub Action `.github/workflows/monitor-prod.yml` (de hora em hora).
// 1. Chama GET /api/cron/monitor-prod com a janela [desde, ate) — dados já sanitizados.
// 2. Para cada achado (identificado por fingerprint `fp`):
//    - issue aberta com o mesmo fp  → atualiza o bloco de estatísticas (edição silenciosa)
//    - issue fechada e o erro voltou → abre "[regressão]" referenciando a anterior
//    - nenhuma                        → abre issue nova (bug + prod-monitor + prioridade)
//
// O repo é PÚBLICO e o log do Action também: este script não imprime nada além
// de títulos e contagens. Env: MONITOR_URL, MONITOR_SECRET, GITHUB_TOKEN,
// GITHUB_REPOSITORY, HORAS (janela, default 1), DRY_RUN=1 (só lista).

const {
  MONITOR_URL = 'https://www.emitirnotafacil.com.br',
  MONITOR_SECRET,
  GITHUB_TOKEN,
  GITHUB_REPOSITORY = 'christopheScantelbury/nota-mei-gateway',
  HORAS = '1',
  DRY_RUN,
} = process.env

const MAX_NOVAS_POR_EXECUCAO = 5
const LABEL = 'prod-monitor'
const LABELS_FONTE = {
  api: ['go', 'railway'], 'api-staging': ['go', 'railway'], worker: ['go', 'railway'],
  web: ['next-js'], receita: ['épico: nfse'], nfse: ['épico: nfse'], suporte: ['next-js'], stripe: ['stripe', 'billing'],
}
const LABEL_PRIORIDADE = { alta: '🟡 alta', normal: '🟢 normal' }

if (!MONITOR_SECRET) fail('MONITOR_SECRET ausente')
if (!GITHUB_TOKEN && !DRY_RUN) fail('GITHUB_TOKEN ausente')

function fail(msg) { console.error(`::error::${msg}`); process.exit(1) }

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!res.ok && res.status !== 404 && res.status !== 422) throw new Error(`GitHub ${init.method ?? 'GET'} ${path}: ${res.status}`)
  return res.status === 204 ? null : { status: res.status, body: await res.json().catch(() => null) }
}

// Janela alinhada à hora cheia: [hora-HORAS, hora) — sem sobreposição entre execuções.
const ate = new Date(); ate.setUTCMinutes(0, 0, 0)
const desde = new Date(ate.getTime() - Number(HORAS) * 3600_000)

const fmt = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const marcadorFp = (fp) => `<!-- prod-monitor:fp=${fp} -->`
const STATS_RE = /<!-- stats -->[\s\S]*<!-- \/stats -->/
const TOTAL_RE = /<!-- total=(\d+) -->/

function blocoStats(a, total) {
  return [
    '<!-- stats -->',
    `<!-- total=${total} -->`,
    `- **Ocorrências:** ${total}${a.total_absoluto != null ? ' (contagem da fonte)' : ''}`,
    `- **Primeira vista:** ${fmt(a.primeira)}`,
    `- **Última vista:** ${fmt(a.ultima)}`,
    ...(a.empresas_afetadas != null ? [`- **Empresas afetadas (última janela):** ${a.empresas_afetadas}`] : []),
    `- _Atualizado pelo monitor em ${fmt(new Date().toISOString())}_`,
    '<!-- /stats -->',
  ].join('\n')
}

function corpo(a, regressaoDe) {
  const ctx = Object.entries(a.contexto ?? {})
  return [
    ...(regressaoDe ? [`> ⚠️ **Regressão:** este erro voltou depois que #${regressaoDe} foi fechada.\n`] : []),
    '## O que aconteceu',
    '```',
    a.detalhe,
    '```',
    ...(ctx.length ? ['', '| Campo | Valor |', '|---|---|', ...ctx.map(([k, v]) => `| ${k} | \`${String(v).replace(/\|/g, '\\|')}\` |`)] : []),
    '',
    '## Ocorrências',
    blocoStats(a, a.total_absoluto ?? a.ocorrencias ?? 1),
    '',
    '## Por onde começar',
    ...a.onde_investigar.map((s) => `- ${s}`),
    '',
    '## Ao corrigir',
    '- Fechar com `Fixes #<este número>` no commit.',
    '- Atualizar a base do atendente em /admin/suporte/conhecimento se o cliente percebeu o problema.',
    '',
    '---',
    '_Aberto automaticamente pelo monitor de produção (`.github/workflows/monitor-prod.yml`). Dados sanitizados — detalhes do cliente só no /admin._',
    marcadorFp(a.fp),
  ].join('\n')
}

async function issuesExistentes() {
  const porFp = new Map()
  for (let page = 1; page <= 5; page++) {
    const r = await gh(`/repos/${GITHUB_REPOSITORY}/issues?labels=${encodeURIComponent(LABEL)}&state=all&per_page=100&page=${page}`)
    const lista = r?.body ?? []
    for (const i of lista) {
      const m = /<!-- prod-monitor:fp=([\w-]+) -->/.exec(i.body ?? '')
      if (!m) continue
      const atual = porFp.get(m[1])
      // Prefere a aberta; entre fechadas, a mais recente.
      if (!atual || (atual.state === 'closed' && (i.state === 'open' || i.number > atual.number))) porFp.set(m[1], i)
    }
    if (lista.length < 100) break
  }
  return porFp
}

async function garantirLabel() {
  const r = await gh(`/repos/${GITHUB_REPOSITORY}/labels/${encodeURIComponent(LABEL)}`)
  if (r?.status === 404) {
    await gh(`/repos/${GITHUB_REPOSITORY}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name: LABEL, color: 'B60205', description: 'Erro de produção detectado pelo monitor automático' }),
    })
  }
}

// ─── Execução ────────────────────────────────────────────────────────────────

const url = `${MONITOR_URL}/api/cron/monitor-prod?desde=${desde.toISOString()}&ate=${ate.toISOString()}`
const res = await fetch(url, { headers: { Authorization: `Bearer ${MONITOR_SECRET}` } })
if (!res.ok) fail(`monitor-prod respondeu ${res.status}`)
const { achados = [], falhas = [] } = await res.json()

console.log(`Janela ${desde.toISOString()} → ${ate.toISOString()}: ${achados.length} achado(s)`)
for (const f of falhas) console.log(`::warning title=Fonte indisponível::${f}`)

if (DRY_RUN) {
  for (const a of achados) console.log(`- [${a.severidade}] ${a.titulo} (${a.ocorrencias ?? a.total_absoluto ?? '?'})`)
  process.exit(0)
}
if (!achados.length) process.exit(0)

await garantirLabel()
const existentes = await issuesExistentes()
let novas = 0
const adiados = []

for (const a of achados) {
  const issue = existentes.get(a.fp)

  if (issue?.state === 'open') {
    const anterior = Number(TOTAL_RE.exec(issue.body ?? '')?.[1] ?? 0)
    const total = a.total_absoluto ?? anterior + (a.ocorrencias ?? 1)
    const body = STATS_RE.test(issue.body ?? '')
      ? issue.body.replace(STATS_RE, blocoStats(a, total))
      : `${issue.body}\n\n${blocoStats(a, total)}`
    await gh(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ body }) })
    console.log(`atualizada #${issue.number}: ${a.titulo} (total ${total})`)
    continue
  }

  const regressao = issue?.state === 'closed' && new Date(a.ultima) > new Date(issue.closed_at)
  if (issue && !regressao) continue // erro antigo de antes do fechamento

  if (novas >= MAX_NOVAS_POR_EXECUCAO) { adiados.push(a.titulo); continue }
  const r = await gh(`/repos/${GITHUB_REPOSITORY}/issues`, {
    method: 'POST',
    body: JSON.stringify({
      title: `${regressao ? '[regressão] ' : ''}${a.titulo}`,
      body: corpo(a, regressao ? issue.number : null),
      labels: ['bug', LABEL, LABEL_PRIORIDADE[a.severidade], ...(LABELS_FONTE[a.fonte] ?? [])],
    }),
  })
  novas++
  console.log(`nova #${r?.body?.number}: ${a.titulo}`)
}

if (adiados.length) {
  console.log(`::warning title=Limite de issues::${adiados.length} achado(s) ficaram para a próxima execução`)
}
