// Tipos do catálogo de planos. Spec: 05-Componentes-React.md + 03-Copies-Finais.md.

export type PricingPersona = 'mei' | 'me' | 'dev'

export interface PricingCta {
  label: string
  href: string
}

export interface PricingPlan {
  /** chave única — usada em analytics e Stripe price IDs */
  key: string
  persona: PricingPersona
  name: string
  description: string
  /** texto pronto para exibição — ex: "R$ 79/mês" ou "Grátis · pague por uso" */
  priceLabel: string
  /** ex: "50 notas/mês · R$ 0,60 por nota excedente" */
  notes: string
  bullets: string[]
  primaryCta: PricingCta
  secondaryCta?: PricingCta
  /** badge superior — ex: "Obrigatório a partir de Set/2026" */
  badge?: string
  /** card recebe destaque visual (border 2px, fundo, ordem mobile) */
  highlight: boolean
}
