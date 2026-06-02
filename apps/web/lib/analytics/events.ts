// Taxonomia GA4 canônica.
//
// Spec: HIST-7.2 + 06-Eventos-Analytics.md.
// Toda chamada de tracking PASSA por estes helpers — não chamar `gtag` direto
// em componentes.
//
// PII: nunca enviar e-mail, nome, CNPJ, etc. como prop de evento.

export type Persona = 'mei' | 'me' | 'dev' | 'unknown'

export type CtaLocation =
  | 'topbar'
  | 'header'
  | 'hero_main_cta'
  | 'hero_card_mei'
  | 'hero_card_me'
  | 'hero_card_dev'
  | 'sandbox_hero'
  | 'gateway_hero'
  | 'pricing_card_mei'
  | 'pricing_card_me'
  | 'pricing_card_dev'
  | 'pricing_main_cta'
  | 'comparativo_hero'
  | 'comparativo_table'
  | 'comparativo_faq'
  | 'comparativo_final'
  | 'blog_inline'
  | 'blog_cta_banner'
  | 'blog_migration_cta'
  | 'footer'
  | 'email_onboarding'
  | 'email_urgency'
  | '404_page'

interface CtaClickParams {
  persona: Persona
  location: CtaLocation
  plan?: string
  experiment_id?: string
  variant?: string
}

/** Clique em qualquer CTA principal. */
export function trackCtaClick(params: CtaClickParams): void {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'cta_click', {
    persona: params.persona,
    cta_location: params.location,
    plan: params.plan ?? 'none',
    experiment_id: params.experiment_id ?? 'none',
    variant: params.variant ?? 'none',
  })
}

/** Visualização de seção de preços (intersection observer). */
export function trackPricingView(params: { persona_focus?: Persona } = {}): void {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'pricing_view', {
    persona_focus: params.persona_focus ?? 'unknown',
  })
}

/** Visualização da tabela comparativa. */
export function trackComparisonView(params: {
  view_type: 'page' | 'home_embed' | 'blog_embed'
}): void {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'comparison_view', params)
}

/** Entrada no sandbox público. */
export function trackSandboxOpen(params: {
  entry_point: 'header' | 'hero' | 'pricing' | 'gateway' | 'direct'
}): void {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'sandbox_open', params)
}

/** Início de fluxo de cadastro (clique no botão antes do form). */
export function trackSignupStart(params: {
  persona: Persona
  plan?: string
  source_page?: string
}): void {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'signup_start', {
    persona: params.persona,
    plan: params.plan ?? 'none',
    source_page: params.source_page ?? 'unknown',
  })
}

/** Cadastro concluído (sucesso no submit). */
export function trackSignupComplete(params: {
  persona: Persona
  plan?: string
}): void {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'signup_complete', {
    persona: params.persona,
    plan: params.plan ?? 'none',
  })
}

/** Visualização do top bar de urgência (uma vez por sessão). */
export function trackTopbarView(): void {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'topbar_view')
}

/** Clique no X do top bar. */
export function trackTopbarDismiss(): void {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'topbar_dismiss')
}

/** Countdown Set/2026 entrou no viewport. */
export function trackCountdownView(params: {
  location: 'hero' | 'pilar' | 'me_page'
}): void {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'countdown_view', params)
}
