import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Monitor de produção — junta os erros de uma janela de tempo e devolve
 * achados agrupados e SANITIZADOS. Quem consome é o GitHub Action
 * `.github/workflows/monitor-prod.yml`, que abre/atualiza issues num repo
 * PÚBLICO: nada que identifique cliente sai daqui (sem CNPJ, nome, e-mail,
 * IDs, chaves). Detalhes ficam no /admin.
 *
 * Fontes:
 *  - Railway (API Go, worker, staging): todo log `error` + 4xx em /v1/webhooks/*
 *  - error_log (erros do navegador capturados pelo dashboard)
 *  - notas REJEITADA / ERRO_TEMPORARIO (agrupadas por código da Receita)
 *  - notas presas em PROCESSANDO há mais de 2h
 *  - falhas da IA de suporte
 */

export type Fonte = 'api' | 'api-staging' | 'worker' | 'web' | 'receita' | 'nfse' | 'suporte'

export interface Achado {
  fp: string
  fonte: Fonte
  severidade: 'alta' | 'normal'
  titulo: string
  detalhe: string
  contexto: Record<string, string>
  /** Ocorrências dentro da janela (somadas pelo consumidor). */
  ocorrencias?: number
  /** Total absoluto conhecido pela fonte (substitui a soma). */
  total_absoluto?: number
  empresas_afetadas?: number
  primeira: string
  ultima: string
  onde_investigar: string[]
}

const RAILWAY_ENV = process.env.RAILWAY_ENVIRONMENT_ID ?? 'ed8bd1f0-1416-4fad-b90f-d5666ae99ea7'
const SERVICOS: Record<string, Fonte> = {
  'fc34b8ba-8580-444e-9418-e9d1a0ca38ee': 'api',
  '38dfefba-db56-4960-bf4c-fac2cb6d7971': 'api-staging',
  '33e66172-97df-4cca-9781-54663661a9d8': 'worker',
}

// Ruído conhecido — não vira issue.
const RUIDO_WEB = /ChunkLoadError|Loading chunk \S+ failed|^Script error\.?$|Failed to fetch|Load failed|NetworkError|ResizeObserver loop/i
const RUIDO_API: RegExp[] = [
  /UpdateCert failed[\s\S]*password incorrect/i, // cliente digitou a senha do PFX errada
  /no Stripe-Signature header/i,                  // bot/scanner fazendo POST no webhook sem assinatura
  /proxy network namespace pool is closed/i,      // infra do Railway durante redeploy
]

// ─── Sanitização ─────────────────────────────────────────────────────────────

export function limpar(s: string | null | undefined, max = 400): string {
  if (!s) return ''
  return s
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
    .replace(/\b(sk|pk|rk)_(live|test)_\w+/g, '[chave]')
    .replace(/\b(whsec|sbp|vcp|ghp|gho)_\w+/g, '[segredo]')
    .replace(/sk-ant-[\w-]+/g, '[segredo]')
    .replace(/eyJ[\w-]+\.[\w-]+(\.[\w-]+)?/g, '[jwt]')
    .replace(/arn:aws:[^\s"',)]+/g, '[arn]')
    .replace(/https?:\/\/[^\s"'<>]+/g, (u) => {
      try { const x = new URL(u); return `${x.origin}${x.pathname}` } catch { return '[url]' }
    })
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '[ip]')
    .replace(/\d{2,3}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, '[doc]') // CNPJ formatado
    .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[doc]')             // CPF formatado
    .replace(/\d{5,}/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

const fingerprint = (...partes: string[]) =>
  createHash('sha256').update(partes.join('|')).digest('hex').slice(0, 12)

function attr(v: string | undefined): string {
  if (v == null) return ''
  try { const p = JSON.parse(v); return typeof p === 'string' ? p : JSON.stringify(p) } catch { return v }
}

const ARQUIVO_POR_ROTA: [RegExp, string][] = [
  [/^\/v1\/webhooks\/stripe/, 'apps/api/internal/handler/stripe_webhook.go'],
  [/^\/v1\/nfse/, 'apps/api/internal/handler/nfse.go'],
  [/^\/v1\/auth/, 'apps/api/internal/handler/register.go'],
  [/^\/v1\/billing/, 'apps/api/internal/handler/billing.go'],
]

// ─── Railway ─────────────────────────────────────────────────────────────────

interface RailwayLog {
  timestamp: string
  severity: string
  message: string
  tags: { serviceId?: string } | null
  attributes: { key: string; value: string }[] | null
}

async function railwayLogs(filtro: string, desde: Date, ate: Date): Promise<RailwayLog[]> {
  const token = process.env.RAILWAY_PROJECT_TOKEN
  if (!token) throw new Error('RAILWAY_PROJECT_TOKEN ausente')
  const out: RailwayLog[] = []
  let ancora = ate.toISOString()
  for (let pagina = 0; pagina < 5; pagina++) {
    const res = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: { 'Project-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($env:String!,$f:String!,$a:String!){ environmentLogs(environmentId:$env, filter:$f, anchorDate:$a, beforeLimit:1000) { timestamp severity message tags { serviceId } attributes { key value } } }`,
        variables: { env: RAILWAY_ENV, f: filtro, a: ancora },
      }),
      cache: 'no-store',
    })
    const j = await res.json().catch(() => null) as { data?: { environmentLogs: RailwayLog[] }; errors?: { message: string }[] } | null
    if (!res.ok || !j?.data) throw new Error(`Railway: ${j?.errors?.[0]?.message ?? res.status}`)
    const logs = j.data.environmentLogs
    for (const l of logs) {
      const t = new Date(l.timestamp)
      if (t >= desde && t < ate) out.push(l)
    }
    const maisAntigo = logs.length ? new Date(logs[0].timestamp) : null
    if (logs.length < 1000 || !maisAntigo || maisAntigo < desde) break
    ancora = logs[0].timestamp
  }
  return out
}

async function coletarRailway(desde: Date, ate: Date): Promise<Achado[]> {
  const [erros, avisos] = await Promise.all([
    railwayLogs('@level:error', desde, ate),
    railwayLogs('@level:warn', desde, ate),
  ])
  const relevantes = [
    ...erros,
    // 4xx em webhooks = integração quebrada (foi assim que o Stripe falhou 100%).
    // No Stripe usamos a linha "signature invalid" (traz o motivo) em vez do 400
    // do access log — senão cada bot que faz POST sem assinatura vira issue.
    ...avisos.filter((l) => {
      const path = attr(l.attributes?.find((a) => a.key === 'path')?.value)
      if (/stripe webhook signature invalid/i.test(l.message)) return true
      if (path === '/v1/webhooks/stripe' && attr(l.attributes?.find((a) => a.key === 'status')?.value) === '400') return false
      return path.startsWith('/v1/webhooks')
    }),
  ]

  const grupos = new Map<string, Achado>()
  for (const l of relevantes) {
    const fonte = SERVICOS[l.tags?.serviceId ?? ''] ?? 'api'
    const a = Object.fromEntries((l.attributes ?? []).map((x) => [x.key, attr(x.value)]))
    const msg = limpar(l.message, 160)
    const erro = limpar(a.error ?? a.err ?? '', 300)
    if (RUIDO_API.some((r) => r.test(`${l.message} ${a.error ?? ''}`))) continue

    const fp = fingerprint(fonte, msg, erro.slice(0, 120))
    const g = grupos.get(fp)
    if (g) {
      g.ocorrencias = (g.ocorrencias ?? 0) + 1
      if (l.timestamp < g.primeira) g.primeira = l.timestamp
      if (l.timestamp > g.ultima) g.ultima = l.timestamp
      continue
    }
    const path = limpar(a.path, 120)
    const contexto: Record<string, string> = { servico: fonte, nivel: l.severity }
    if (path) contexto.rota = `${a.method ?? ''} ${path}`.trim()
    if (a.status) contexto.status_http = a.status
    const arquivo = ARQUIVO_POR_ROTA.find(([r]) => r.test(path))?.[1]
    grupos.set(fp, {
      fp,
      fonte,
      severidade: fonte === 'api-staging' ? 'normal' : 'alta',
      titulo: `[${fonte}] ${msg}`.slice(0, 120),
      detalhe: [msg, erro].filter(Boolean).join('\n'),
      contexto,
      ocorrencias: 1,
      primeira: l.timestamp,
      ultima: l.timestamp,
      onde_investigar: [
        `Railway → serviço \`${fonte}\` → Logs, filtro \`@level:${l.severity}\` (procurar pela mensagem acima)`,
        ...(arquivo ? [`\`${arquivo}\``] : []),
        ...(fonte === 'api-staging' ? ['Serviço de staging — confirmar se deveria estar rodando contra recursos de produção'] : []),
      ],
    })
  }
  return Array.from(grupos.values())
}

// ─── Supabase (banco de produção) ────────────────────────────────────────────

async function coletarWeb(sb: SupabaseClient, desde: Date, ate: Date): Promise<Achado[]> {
  const { data, error } = await sb
    .from('error_log')
    .select('fingerprint, level, source, message, stack, url, occurrence_count, first_seen_at, last_seen_at')
    .eq('resolved', false)
    .eq('level', 'error')
    .gte('last_seen_at', desde.toISOString())
    .lt('last_seen_at', ate.toISOString())
    .limit(200)
  if (error) throw new Error(`error_log: ${error.message}`)
  return (data ?? [])
    .filter((e) => !RUIDO_WEB.test(e.message ?? ''))
    .map((e) => {
      const msg = limpar(e.message, 160)
      const stack = (e.stack ?? '').split('\n').slice(0, 4).map((s: string) => limpar(s, 160)).join('\n')
      return {
        fp: `web-${String(e.fingerprint).slice(0, 12)}`,
        fonte: 'web' as const,
        severidade: 'normal' as const,
        titulo: `[web] ${msg}`.slice(0, 120),
        detalhe: [msg, stack].filter(Boolean).join('\n'),
        contexto: { origem: e.source, pagina: limpar(e.url, 120) || '—' },
        total_absoluto: e.occurrence_count,
        primeira: e.first_seen_at,
        ultima: e.last_seen_at,
        onde_investigar: ['/admin/errors (marcar como resolvido depois do fix)'],
      }
    })
}

async function coletarReceita(sb: SupabaseClient, desde: Date, ate: Date): Promise<Achado[]> {
  const { data, error } = await sb
    .from('notas_fiscais')
    .select('status, erro_codigo, erro_descricao, empresa_id, mei_id, updated_at')
    .in('status', ['REJEITADA', 'ERRO_TEMPORARIO'])
    .gte('updated_at', desde.toISOString())
    .lt('updated_at', ate.toISOString())
    .limit(2000)
  if (error) throw new Error(`notas_fiscais: ${error.message}`)

  const grupos = new Map<string, Achado & { _empresas: Set<string> }>()
  for (const n of data ?? []) {
    const codigo = (n.erro_codigo ?? 'SEM_CODIGO').toString().slice(0, 20)
    const fp = fingerprint('receita', n.status, codigo)
    const dono = String(n.empresa_id ?? n.mei_id ?? '')
    const g = grupos.get(fp)
    if (g) {
      g.ocorrencias = (g.ocorrencias ?? 0) + 1
      g._empresas.add(dono)
      if (n.updated_at < g.primeira) g.primeira = n.updated_at
      if (n.updated_at > g.ultima) g.ultima = n.updated_at
      continue
    }
    const descricao = limpar(n.erro_descricao, 300)
    grupos.set(fp, {
      fp,
      fonte: 'receita',
      severidade: n.status === 'ERRO_TEMPORARIO' ? 'alta' : 'normal',
      titulo: `[receita] ${n.status} ${codigo}${descricao ? ` — ${descricao}` : ''}`.slice(0, 120),
      detalhe: descricao || '(sem descrição)',
      contexto: { status: n.status, codigo },
      ocorrencias: 1,
      primeira: n.updated_at,
      ultima: n.updated_at,
      onde_investigar: [
        `/admin/notas?status=${n.status} (dados do cliente ficam só no admin)`,
        '`docs/receita-erros.md` — mapeamento dos códigos',
        '`apps/api/internal/document/dps_builder.go` se for campo da DPS',
      ],
      _empresas: new Set([dono]),
    })
  }
  return Array.from(grupos.values()).map(({ _empresas, ...a }) => ({ ...a, empresas_afetadas: _empresas.size }))
}

async function coletarTravadas(sb: SupabaseClient, ate: Date): Promise<Achado[]> {
  const limite = new Date(ate.getTime() - 2 * 3600_000)
  const { data, error } = await sb
    .from('notas_fiscais')
    .select('created_at')
    .eq('status', 'PROCESSANDO')
    .lt('created_at', limite.toISOString())
    .gte('created_at', new Date(ate.getTime() - 30 * 86400_000).toISOString())
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) throw new Error(`PROCESSANDO: ${error.message}`)
  if (!data?.length) return []
  return [{
    fp: 'nfse-processando-travada',
    fonte: 'nfse',
    severidade: 'alta',
    titulo: '[nfse] Notas presas em PROCESSANDO há mais de 2h',
    detalhe: `${data.length} nota(s) em PROCESSANDO criadas há mais de 2h (últimos 30 dias).`,
    contexto: { quantidade: String(data.length) },
    total_absoluto: data.length,
    primeira: data[0].created_at,
    ultima: data[data.length - 1].created_at,
    onde_investigar: [
      '/admin/notas?status=PROCESSANDO',
      '`apps/api/internal/nfse/poller.go` — o poller deveria resolver em minutos',
    ],
  }]
}

async function coletarSuporte(sb: SupabaseClient, desde: Date, ate: Date): Promise<Achado[]> {
  const { data, error } = await sb
    .from('support_tickets')
    .select('motivo_escalada, updated_at')
    .like('motivo_escalada', 'IA indisponível%')
    .gte('updated_at', desde.toISOString())
    .lt('updated_at', ate.toISOString())
    .limit(200)
  if (error) throw new Error(`support_tickets: ${error.message}`)
  const grupos = new Map<string, Achado>()
  for (const t of data ?? []) {
    const motivo = limpar(t.motivo_escalada, 200)
    const fp = fingerprint('suporte', motivo)
    const g = grupos.get(fp)
    if (g) { g.ocorrencias = (g.ocorrencias ?? 0) + 1; g.ultima = t.updated_at > g.ultima ? t.updated_at : g.ultima; continue }
    grupos.set(fp, {
      fp, fonte: 'suporte', severidade: 'alta',
      titulo: `[suporte] ${motivo}`.slice(0, 120),
      detalhe: motivo,
      contexto: {},
      ocorrencias: 1, primeira: t.updated_at, ultima: t.updated_at,
      onde_investigar: ['`apps/web/lib/suporte/agent.ts`', 'Vercel → Logs da rota /api/suporte', '/admin/suporte (chamados escalados)'],
    })
  }
  return Array.from(grupos.values())
}

// ─── Orquestração ────────────────────────────────────────────────────────────

export async function coletarAchados(sb: SupabaseClient, desde: Date, ate: Date) {
  const tarefas: [string, Promise<Achado[]>][] = [
    ['railway', coletarRailway(desde, ate)],
    ['web', coletarWeb(sb, desde, ate)],
    ['receita', coletarReceita(sb, desde, ate)],
    ['nfse', coletarTravadas(sb, ate)],
    ['suporte', coletarSuporte(sb, desde, ate)],
  ]
  const achados: Achado[] = []
  const falhas: string[] = []
  const resultados = await Promise.allSettled(tarefas.map(([, p]) => p))
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') achados.push(...r.value)
    else falhas.push(`${tarefas[i][0]}: ${limpar(String(r.reason?.message ?? r.reason), 200)}`)
  })
  achados.sort((a, b) => (a.severidade === b.severidade ? 0 : a.severidade === 'alta' ? -1 : 1))
  return { achados, falhas }
}
