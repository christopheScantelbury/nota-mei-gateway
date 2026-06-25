import type { PricingPersona, PricingCta } from '@/lib/pricing/types'

// Planos ÂNCORA exibidos na home (3 cards).
//
// 2026-06-25: refatorado pra ser SÓ METADADO. Preços, limites, descrição curta
// e formatação de label vêm do banco (`planos` table — editável via /admin/planos).
// Regra: NUNCA hardcodar preço aqui ou em qualquer outro lugar do front. A fonte
// é sempre o `getAnchorPlans()` em `lib/pricing/anchor.ts`.
//
// UTM nos hrefs pra atribuir conversão por canal/card.

const UTM_HOME_PRICING = 'utm_source=home&utm_medium=pricing'

export interface PricingPlanMeta {
  /** chave única — usada em analytics + matching com o array merged */
  key: string
  /** nome exato no banco (`planos.nome`) — usado pra fetch */
  dbName: string
  persona: PricingPersona
  /** bullets exibidos no card — não vêm do banco (são copy de marketing) */
  bullets: string[]
  primaryCta: PricingCta
  secondaryCta?: PricingCta
  /** badge superior — ex: "Obrigatório a partir de Set/2026" */
  badge?: string
  /** card recebe destaque visual (border 2px, fundo, ordem mobile) */
  highlight: boolean
  /** fallback quando banco offline/erro — preço congelado no commit */
  fallback: {
    priceLabel: string
    notes: string
    description: string
  }
}

// Ordem reflete o pivô 2026-06-25: ME (foco principal, highlight) → Gateway → MEI.
// Mantém os 3 personas representadas na home, mas com peso visual proporcional.
export const ANCHOR_PLAN_META: PricingPlanMeta[] = [
  {
    key: 'me_start',
    dbName: 'ME Start',
    persona: 'me',
    bullets: [
      'Trial grátis com 5 notas',
      'Simples Nacional e Lucro Presumido',
      'Multi-empresa nativo',
    ],
    primaryCta: {
      label: 'Começar grátis',
      href: `/cadastro/me?plano=start&${UTM_HOME_PRICING}&utm_content=me_card`,
    },
    secondaryCta: { label: 'Ver todos os planos ME →', href: '/me#precos' },
    badge: 'Obrigatório a partir de Set/2026',
    highlight: true,
    fallback: {
      priceLabel: 'R$ 59,99/mês',
      notes: '10 notas/mês · R$ 0,80 por nota excedente',
      description: 'Para Microempresa que precisa estar pronta para a NFS-e Nacional.',
    },
  },
  {
    key: 'gateway_start',
    dbName: 'Gateway Start',
    persona: 'dev',
    bullets: [
      'API REST · JSON · Bearer',
      'Webhooks HMAC-SHA256',
      'SDKs Node/Python/PHP',
      'Sandbox público sem cadastro',
    ],
    primaryCta: {
      label: 'Testar no sandbox',
      href: `/sandbox?${UTM_HOME_PRICING}&utm_content=dev_card`,
    },
    secondaryCta: { label: 'Ver planos Gateway →', href: '/gateway#precos' },
    highlight: false,
    fallback: {
      priceLabel: 'Grátis · pague por uso',
      notes: 'R$ 0,89 por nota emitida em produção',
      description: 'Para desenvolvedores que integram emissão ao seu produto.',
    },
  },
  {
    key: 'mei_mensal',
    dbName: 'MEI Mensal',
    persona: 'mei',
    bullets: ['Trial grátis com 5 notas', 'PDF + XML automáticos', 'Suporte humano'],
    primaryCta: {
      label: 'Começar grátis',
      href: `/cadastro?produto=mei&plano=mensal&${UTM_HOME_PRICING}&utm_content=mei_card`,
    },
    secondaryCta: { label: 'Ver todos os planos MEI →', href: '/mei#precos' },
    highlight: false,
    fallback: {
      priceLabel: 'R$ 24,90/mês',
      notes: '5 notas/mês · R$ 0,80 por nota excedente',
      description: 'Para MEI com clientes fixos todo mês.',
    },
  },
]
