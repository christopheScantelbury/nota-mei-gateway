// Helper server-side que monta os dados da página /precos mesclando METADATA
// de marketing (features, descrições, CTAs — que não mudam) com PREÇO/LIMITE/
// EXCEDENTE vindos do banco `planos` (editável via /admin/planos).
//
// 2026-06-25: elimina o drift dos 4 blocos hardcoded que /precos tinha (cards
// MEI, cards ME, tabela comparativa, JSON-LD). Regra do projeto: preço e limite
// vêm SEMPRE do banco. Se a query falhar, usa `fallback` congelado.

import { createAdminClient } from '@/lib/supabase/admin'

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
})

interface PlanoRow {
  nome:                string
  preco_mensal_brl:    number | null
  preco_excedente_brl: number | null
  emissoes_limite:     number | null
}

// ── Card de plano renderizado ────────────────────────────────────────────────
export interface PrecosCard {
  key:        string
  name:       string
  price:      string        // "R$ 59,99" | "R$ 5,99" | "Grátis" | "Sob consulta"
  period:     string        // "/mês" | "/nota" | ""
  limit:      string        // "30 notas/mês" | "5 notas grátis" | "Sem mensalidade"
  desc?:      string | null
  extra?:     string | null // "Excedente R$ 0,80/nota"
  highlight:  boolean
  badge?:     string | null
  features?:  string[]
  cta:        string
  ctaHref:    string
  ctaVariant?: 'primary' | 'secondary'
}

// Metadata (tudo menos preço/limite/excedente). `dbName` = nome no banco; null
// pra planos que NÃO existem no banco (Trial grátis, EPP Scale sob consulta).
interface CardMeta {
  key: string
  name: string
  dbName: string | null
  desc?: string | null
  highlight: boolean
  badge?: string | null
  features?: string[]
  cta: string
  ctaHref: string
  ctaVariant?: 'primary' | 'secondary'
  // usado quando dbName é null (plano fora do banco) ou fallback se DB falhar
  fixed?: { price: string; period: string; limit: string; extra?: string | null }
}

const MEI_META: CardMeta[] = [
  {
    key: 'trial', name: 'Trial', dbName: null, highlight: false,
    desc: 'Para experimentar a plataforma sem cartão.',
    cta: 'Começar grátis', ctaHref: '/cadastro?produto=mei&plano=trial',
    fixed: { price: 'Grátis', period: '', limit: '5 notas grátis' },
  },
  {
    key: 'avulso', name: 'Avulso', dbName: 'Avulso MEI', highlight: false,
    desc: 'Cobra só quando emite. Sem compromisso mensal.',
    cta: 'Emitir nota avulsa', ctaHref: '/cadastro?produto=mei&plano=avulso',
    fixed: { price: 'R$ 5,99', period: '/nota', limit: 'Sem mensalidade' },
  },
  {
    key: 'mensal', name: 'MEI Mensal', dbName: 'MEI Mensal', highlight: false,
    desc: 'Pra quem emite poucas notas com regularidade.',
    cta: 'Assinar MEI Mensal', ctaHref: '/cadastro?produto=mei&plano=mensal',
    fixed: { price: 'R$ 19,90', period: '/mês', limit: '10 notas/mês', extra: 'Excedente R$ 0,80/nota' },
  },
  {
    key: 'plus', name: 'MEI Plus', dbName: 'MEI Plus', highlight: true,
    desc: 'Pra MEI com fluxo regular de clientes.',
    cta: 'Assinar MEI Plus', ctaHref: '/cadastro?produto=mei&plano=plus',
    fixed: { price: 'R$ 39,90', period: '/mês', limit: '30 notas/mês', extra: 'Excedente R$ 0,50/nota' },
  },
  {
    key: 'premium', name: 'MEI Premium', dbName: 'MEI Premium', highlight: false,
    desc: 'Pra MEI com alto volume de emissões.',
    cta: 'Assinar MEI Premium', ctaHref: '/cadastro?produto=mei&plano=premium',
    fixed: { price: 'R$ 79,90', period: '/mês', limit: '100 notas/mês', extra: 'Excedente R$ 0,30/nota' },
  },
]

const ME_META: CardMeta[] = [
  {
    key: 'trial', name: 'Trial ME', dbName: null, highlight: false, badge: null,
    features: ['5 notas grátis pra testar', 'Dashboard de gerenciamento', 'Certificado A1 (upload único)', 'Suporte por e-mail'],
    cta: 'Começar grátis', ctaHref: '/cadastro/me?plano=trial', ctaVariant: 'secondary',
    fixed: { price: 'Grátis', period: '', limit: '5 notas grátis' },
  },
  {
    key: 'start', name: 'ME Start', dbName: 'ME Start', highlight: false, badge: null,
    features: ['Dashboard de gerenciamento', 'Simples Nacional e Lucro Presumido', 'Multi-empresa nativo', 'Suporte por e-mail'],
    cta: 'Assinar Start', ctaHref: '/cadastro/me?plano=start', ctaVariant: 'secondary',
    fixed: { price: 'R$ 59,99', period: '/mês', limit: '30 notas/mês' },
  },
  {
    key: 'pro', name: 'ME Pro', dbName: 'ME Pro', highlight: true, badge: 'Mais popular',
    features: ['Tudo do Start', 'Modelos de nota', 'Notas recorrentes', 'Links de cobrança', 'Suporte prioritário'],
    cta: 'Assinar Pro', ctaHref: '/cadastro/me?plano=pro', ctaVariant: 'primary',
    fixed: { price: 'R$ 129,90', period: '/mês', limit: '100 notas/mês' },
  },
  {
    key: 'business', name: 'ME Business', dbName: 'ME Business', highlight: false, badge: 'Alto volume',
    features: ['Tudo do Pro', 'Chaves de API (integração)', 'Notificações automáticas (webhooks)', 'SLA 99,9% contratual', 'Suporte por chat'],
    cta: 'Assinar Business', ctaHref: '/cadastro/me?plano=business', ctaVariant: 'secondary',
    fixed: { price: 'R$ 299,90', period: '/mês', limit: '300 notas/mês' },
  },
  {
    key: 'scale', name: 'EPP Scale', dbName: null, highlight: false, badge: null,
    features: ['Volume sob consulta (300+)', 'Tudo do Business', 'IP dedicado na Receita Federal', 'Onboarding técnico dedicado', 'SLA com crédito por descumprimento', 'Suporte 24/7'],
    cta: 'Falar com vendas', ctaHref: 'mailto:vendas@emitirnotafacil.com.br?subject=EPP Scale - Cotação', ctaVariant: 'secondary',
    fixed: { price: 'Sob consulta', period: '', limit: '300+ notas/mês' },
  },
]

function buildCard(meta: CardMeta, row: PlanoRow | undefined, includeNotesInFeatures: boolean): PrecosCard {
  // Plano fora do banco (trial/scale) OU DB indisponível → usa fixed.
  if (!meta.dbName || !row) {
    const f = meta.fixed!
    return {
      key: meta.key, name: meta.name, price: f.price, period: f.period, limit: f.limit,
      desc: meta.desc, extra: f.extra ?? null, highlight: meta.highlight, badge: meta.badge,
      features: meta.features, cta: meta.cta, ctaHref: meta.ctaHref, ctaVariant: meta.ctaVariant,
    }
  }
  const mensal = row.preco_mensal_brl ?? 0
  const exced  = row.preco_excedente_brl ?? 0
  const limit  = row.emissoes_limite ?? 0

  const isAvulso = mensal === 0 && exced > 0
  const price  = isAvulso ? BRL.format(exced) : mensal > 0 ? BRL.format(mensal) : 'Grátis'
  const period = isAvulso ? '/nota' : mensal > 0 ? '/mês' : ''
  const limitLabel = isAvulso ? 'Sem mensalidade' : `${limit} notas/mês`
  const excedLabel = (!isAvulso && exced > 0) ? `Excedente ${BRL.format(exced)}/nota` : null

  // ME cards mostram as notas incluídas como 1º feature; MEI cards mostram como `extra`.
  const features = meta.features && includeNotesInFeatures && !isAvulso
    ? [`${limit} notas/mês incluídas`, ...(excedLabel ? [excedLabel] : []), ...meta.features]
    : meta.features

  return {
    key: meta.key, name: meta.name, price, period, limit: limitLabel,
    desc: meta.desc, extra: meta.features ? null : excedLabel, highlight: meta.highlight,
    badge: meta.badge, features, cta: meta.cta, ctaHref: meta.ctaHref, ctaVariant: meta.ctaVariant,
  }
}

export interface PrecosData {
  mei:     PrecosCard[]
  empresa: PrecosCard[]
  /** linhas dinâmicas da FEATURE_TABLE (notas + excedente por coluna) */
  featureNotes:  Record<'starter'|'basic'|'pro'|'business', string>
  featureExced:  Record<'starter'|'basic'|'pro'|'business', string>
  /** planos pro JSON-LD (nome, descricao, precoBRL inteiro) */
  seo: { nome: string; descricao: string; precoBRL: number }[]
}

export async function getPrecosData(): Promise<PrecosData> {
  const names = [...MEI_META, ...ME_META].map(m => m.dbName).filter((n): n is string => !!n)
  let byName = new Map<string, PlanoRow>()
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('planos')
      .select('nome, preco_mensal_brl, preco_excedente_brl, emissoes_limite')
      .in('nome', names)
    if (error) throw error
    byName = new Map((data as PlanoRow[]).map(r => [r.nome, r]))
  } catch {
    byName = new Map() // buildCard cai no fallback fixed onde houver, ou sem preço
  }

  const mei     = MEI_META.map(m => buildCard(m, m.dbName ? byName.get(m.dbName) : undefined, false))
  const empresa = ME_META.map(m => buildCard(m, m.dbName ? byName.get(m.dbName) : undefined, true))

  const notes = (n: string) => { const r = byName.get(n); return r?.emissoes_limite != null ? String(r.emissoes_limite) : '—' }
  const exc   = (n: string) => { const r = byName.get(n); return r?.preco_excedente_brl ? BRL.format(r.preco_excedente_brl) : '—' }

  // Colunas: starter=ME Start · basic=ME Pro · pro=ME Business · business=EPP Scale
  const featureNotes = { starter: notes('ME Start'), basic: notes('ME Pro'), pro: notes('ME Business'), business: '300+' }
  const featureExced = { starter: exc('ME Start'),   basic: exc('ME Pro'),   pro: exc('ME Business'),   business: 'sob consulta' }

  const seoRow = (nome: string, desc: string): { nome: string; descricao: string; precoBRL: number } => {
    const r = byName.get(nome)
    return { nome, descricao: desc, precoBRL: r?.preco_mensal_brl ? Math.round(r.preco_mensal_brl) : 0 }
  }
  const seo = [
    { nome: 'Trial MEI',   descricao: '5 notas grátis pra testar',         precoBRL: 0 },
    { nome: 'Avulso MEI',  descricao: 'Por nota emitida, sem mensalidade', precoBRL: byName.get('Avulso MEI')?.preco_excedente_brl ? Math.round(byName.get('Avulso MEI')!.preco_excedente_brl!) : 6 },
    seoRow('MEI Mensal',  `${notes('MEI Mensal')} notas/mês para MEI`),
    seoRow('MEI Plus',    `${notes('MEI Plus')} notas/mês para MEI`),
    seoRow('MEI Premium', `${notes('MEI Premium')} notas/mês para MEI`),
    { nome: 'Trial ME',   descricao: '5 notas grátis pra ME/EPP',          precoBRL: 0 },
    seoRow('ME Start',    `${notes('ME Start')} notas/mês, ME/EPP`),
    seoRow('ME Pro',      `${notes('ME Pro')} notas/mês, ME/EPP`),
    seoRow('ME Business', `${notes('ME Business')} notas/mês, ME/EPP`),
  ]

  return { mei, empresa, featureNotes, featureExced, seo }
}
