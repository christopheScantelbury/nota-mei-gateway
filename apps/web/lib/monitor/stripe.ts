import type { SupabaseClient } from '@supabase/supabase-js'
import type { Achado } from './coletar'

/**
 * Monitor — Stripe (#259). O webhook passou meses recusando todo evento sem
 * ninguém perceber; estas checagens pegam isso em até 1 hora:
 *
 *  1. Evento não processado: evento dos tipos que o NotaFácil assina, criado
 *     há mais de 15 min, que não está em `stripe_events` (o handler grava
 *     todo evento que recebe com sucesso, inclusive os ignorados).
 *  2. Assinatura divergente: assinatura ATIVA no Stripe que é do NotaFácil
 *     (metadata empresa_id/mei_id ou price do catálogo `planos`) sem linha
 *     correspondente e ativa em `emissoes_mensais` — cliente pagando e
 *     continuando no Trial.
 *
 * A conta Stripe é compartilhada com EventGear e ContentAI: assinaturas e
 * eventos que não são do NotaFácil ficam de fora.
 * Saída sanitizada (repo público): só contagens e tipos de evento.
 */

// Mesma lista do endpoint we_1TUEZ6… (docs/stripe-webhooks.md).
export const EVENTOS_ASSINADOS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'price.updated',
  'price.deleted',
  'product.updated',
]

const MARGEM_MS = 15 * 60_000 // Stripe reenvia por um tempo; dá folga antes de alertar

interface StripeLista<T> { data: T[]; has_more: boolean }
interface StripeEvento { id: string; type: string; created: number }
interface StripeAssinatura {
  id: string
  status: string
  created: number
  metadata: Record<string, string> | null
  items: { data: { price: { id: string } }[] }
}

async function stripeGet<T>(path: string, params: [string, string][]): Promise<StripeLista<T>> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY ausente no Vercel')
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`https://api.stripe.com/v1/${path}?${qs}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Stripe ${path}: HTTP ${res.status}`)
  return res.json() as Promise<StripeLista<T>>
}

async function listarTudo<T extends { id: string }>(path: string, params: [string, string][], max = 5): Promise<T[]> {
  const out: T[] = []
  let depois: string | undefined
  for (let i = 0; i < max; i++) {
    const p = depois ? [...params, ['starting_after', depois] as [string, string]] : params
    const r = await stripeGet<T>(path, p)
    out.push(...r.data)
    if (!r.has_more || !r.data.length) break
    depois = r.data[r.data.length - 1].id
  }
  return out
}

async function eventosNaoProcessados(sb: SupabaseClient, desde: Date, ate: Date): Promise<Achado[]> {
  // Janela deslocada 15 min para trás: o evento criado no fim de uma janela
  // é conferido na execução seguinte, quando já teve tempo de ser entregue.
  const inicio = new Date(desde.getTime() - MARGEM_MS)
  const fim = new Date(Math.min(ate.getTime(), Date.now()) - MARGEM_MS)
  if (fim <= inicio) return []
  const params: [string, string][] = [
    ['created[gte]', String(Math.floor(inicio.getTime() / 1000))],
    ['created[lt]', String(Math.floor(fim.getTime() / 1000))],
    ['limit', '100'],
    ...EVENTOS_ASSINADOS.map((t) => ['types[]', t] as [string, string]),
  ]
  const eventos = await listarTudo<StripeEvento>('events', params)
  if (!eventos.length) return []

  const { data, error } = await sb
    .from('stripe_events')
    .select('stripe_event_id')
    .in('stripe_event_id', eventos.map((e) => e.id))
  if (error) throw new Error(`stripe_events: ${error.message}`)
  const ok = new Set((data ?? []).map((r) => r.stripe_event_id as string))
  const faltando = eventos.filter((e) => !ok.has(e.id)).sort((a, b) => a.created - b.created)
  if (!faltando.length) return []

  const porTipo = new Map<string, number>()
  for (const e of faltando) porTipo.set(e.type, (porTipo.get(e.type) ?? 0) + 1)
  return [{
    fp: 'stripe-evento-nao-processado',
    fonte: 'stripe',
    severidade: 'alta',
    titulo: '[stripe] Eventos do Stripe não processados pelo webhook',
    detalhe:
      `${faltando.length} evento(s) do Stripe criados há mais de 15 min não constam em stripe_events — ` +
      'o webhook /v1/webhooks/stripe está recusando ou falhando. Assinaturas pagas podem não estar sendo ativadas.',
    contexto: Object.fromEntries(Array.from(porTipo, ([t, n]) => [t, String(n)])),
    ocorrencias: faltando.length,
    primeira: new Date(faltando[0].created * 1000).toISOString(),
    ultima: new Date(faltando[faltando.length - 1].created * 1000).toISOString(),
    onde_investigar: [
      'Stripe Dashboard → Developers → Webhooks → endpoint api.emitirnotafacil.com.br → entregas com falha',
      'Railway → api → Logs: `stripe webhook signature invalid` / `stripe webhook processing failed`',
      '`apps/api/internal/handler/stripe_webhook.go`',
      'Depois de corrigir: reenviar os eventos pelo Stripe Dashboard (Resend)',
    ],
  }]
}

async function assinaturasDivergentes(sb: SupabaseClient): Promise<Achado[]> {
  const [assinaturas, planos] = await Promise.all([
    listarTudo<StripeAssinatura>('subscriptions', [['status', 'active'], ['limit', '100']]),
    sb.from('planos').select('stripe_price_id').not('stripe_price_id', 'is', null),
  ])
  if (planos.error) throw new Error(`planos: ${planos.error.message}`)
  const precos = new Set((planos.data ?? []).map((p) => p.stripe_price_id as string))

  const agora = Date.now()
  const nossas = assinaturas.filter((s) => {
    const md = s.metadata ?? {}
    const preco = s.items?.data?.[0]?.price?.id ?? ''
    // assinatura recém-criada: o webhook pode estar chegando agora
    return (md.empresa_id || md.mei_id || precos.has(preco)) && agora - s.created * 1000 > MARGEM_MS
  })
  if (!nossas.length) return []

  const { data, error } = await sb
    .from('emissoes_mensais')
    .select('stripe_subscription_id, stripe_subscription_status, competencia')
    .in('stripe_subscription_id', nossas.map((s) => s.id))
  if (error) throw new Error(`emissoes_mensais: ${error.message}`)

  // Vale a linha mais recente de cada assinatura.
  const ultima = new Map<string, { status: string; competencia: string }>()
  for (const r of data ?? []) {
    const atual = ultima.get(r.stripe_subscription_id)
    if (!atual || r.competencia > atual.competencia) {
      ultima.set(r.stripe_subscription_id, { status: r.stripe_subscription_status ?? '', competencia: r.competencia })
    }
  }
  const divergentes = nossas.filter((s) => {
    const r = ultima.get(s.id)
    return !r || !['active', 'trialing'].includes(r.status)
  })
  if (!divergentes.length) return []

  const semLinha = divergentes.filter((s) => !ultima.has(s.id)).length
  return [{
    fp: 'stripe-assinatura-divergente',
    fonte: 'stripe',
    severidade: 'alta',
    titulo: '[stripe] Assinatura ativa no Stripe sem plano ativo no NotaFácil',
    detalhe:
      `${divergentes.length} assinatura(s) ativa(s) no Stripe não estão ativas em emissoes_mensais ` +
      `(${semLinha} sem nenhuma linha). Cliente está pagando e pode continuar limitado ao Trial.`,
    contexto: { divergentes: String(divergentes.length), sem_linha: String(semLinha) },
    total_absoluto: divergentes.length,
    primeira: new Date(Math.min(...divergentes.map((s) => s.created)) * 1000).toISOString(),
    ultima: new Date().toISOString(),
    onde_investigar: [
      '/admin/usuarios → filtrar por plano Trial e conferir no Stripe Dashboard → Assinaturas ativas',
      '`apps/api/internal/handler/stripe_webhook.go` — handleSubscription / updateSubscriptionByOwner',
      'Reenviar `customer.subscription.updated` da assinatura pelo Stripe Dashboard corrige o banco',
    ],
  }]
}

export async function coletarStripe(sb: SupabaseClient, desde: Date, ate: Date): Promise<Achado[]> {
  const [a, b] = await Promise.all([eventosNaoProcessados(sb, desde, ate), assinaturasDivergentes(sb)])
  return [...a, ...b]
}
