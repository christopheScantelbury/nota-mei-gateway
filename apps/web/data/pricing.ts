import type { PricingPlan } from '@/lib/pricing/types'

// Planos ÂNCORA exibidos na home (3 cards). Preços fechados em D-01.
// Spec: 03-Copies-Finais.md + 04-Modelos-Dados.md migration 005.
// UTM nos hrefs pra atribuir conversão por canal/card.

const UTM_HOME_PRICING = 'utm_source=home&utm_medium=pricing'

export const ANCHOR_PLANS: PricingPlan[] = [
  {
    key: 'mei_mensal',
    persona: 'mei',
    name: 'MEI Mensal',
    description: 'Para MEI com clientes fixos todo mês.',
    priceLabel: 'R$ 19/mês',
    notes: '30 notas/mês',
    bullets: ['Sem cartão no trial', 'PDF + XML automáticos', 'Suporte humano'],
    primaryCta: {
      label: 'Começar trial grátis',
      href: `/cadastro?produto=mei&plano=mensal&${UTM_HOME_PRICING}&utm_content=mei_card`,
    },
    secondaryCta: { label: 'Ver todos os planos MEI →', href: '/mei#precos' },
    highlight: false,
  },
  {
    key: 'me_start',
    persona: 'me',
    name: 'ME Start',
    description: 'Para Microempresa que precisa estar pronta para a NFS-e Nacional.',
    priceLabel: 'R$ 79/mês',
    notes: '50 notas/mês · R$ 0,60 por nota excedente',
    bullets: [
      '30 dias grátis · sem cartão',
      'Simples Nacional e Lucro Presumido',
      'Multi-empresa nativo',
    ],
    primaryCta: {
      label: 'Começar trial grátis',
      href: `/cadastro/me?plano=start&${UTM_HOME_PRICING}&utm_content=me_card`,
    },
    secondaryCta: { label: 'Ver todos os planos ME →', href: '/me#precos' },
    badge: 'Obrigatório a partir de Set/2026',
    highlight: true,
  },
  {
    key: 'gateway_start',
    persona: 'dev',
    name: 'Gateway Start',
    description: 'Para desenvolvedores que integram emissão ao seu produto.',
    priceLabel: 'Grátis · pague por uso',
    notes: 'R$ 0,89 por nota emitida em produção',
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
  },
]
