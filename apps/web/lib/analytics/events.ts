// Taxonomia GA4 canônica.
//
// Spec: HIST-7.2 + 06-Eventos-Analytics.md.
// Toda chamada de tracking PASSA por estes helpers — não chamar `gtag` direto
// em componentes.
//
// PII: nunca enviar e-mail, nome, CNPJ, etc. como prop de evento.

import { ADS_ID } from './gtag'

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

// ───── Conversions canônicas do funil (pack Manaus 2026-06-22) ──────────────
// As 4 conversões do plano:
//   1. signup_complete (já existe acima) — cadastro concluído
//   2. trial_start                       — trial iniciado (usuário ativou)
//   3. first_emission                    — 1ª NFS-e AUTORIZADA
//   4. subscribe                         — assinatura paga (Stripe webhook)
//
// `subscribe` é a conversão PRIMÁRIA no Google Ads; as demais são secundárias.

/** Trial iniciado — usuário ativou o trial após cadastro
 *  (geralmente significa que emitiu a 1ª nota de homologação ou logou). */
export function trackTrialStart(params: { persona: Persona; plan?: string }): void {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'trial_start', {
    persona: params.persona,
    plan: params.plan ?? 'trial',
  })
}

/** Primeira nota emitida em produção (AUTORIZADA). */
export function trackFirstEmission(params: { persona: Persona }): void {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'first_emission', {
    persona: params.persona,
  })
}

/** Assinatura paga (Stripe checkout.session.completed → thank-you page). */
export function trackSubscribe(params: {
  persona: Persona
  plan: string
  /** Valor mensal em BRL (ex: 19.90 para MEI Mensal). */
  value: number
  /** Stripe session ID — pra dedup. */
  transaction_id?: string
}): void {
  if (typeof window === 'undefined') return
  // Usa o evento PADRÃO do GA4 e-commerce (`purchase`) — Google Ads,
  // GA4 Monetization reports e Looker Studio reconhecem nativamente
  // (ROAS, AOV, receita por canal). Evento custom `subscribe` quebraria
  // esses relatórios prontos.
  window.gtag?.('event', 'purchase', {
    persona: params.persona,
    plan: params.plan,
    value: params.value,
    currency: 'BRL',
    transaction_id: params.transaction_id ?? 'none',
  })
}

// ───── Google Ads conversion helpers ────────────────────────────────────────
// Cada conversion action no Google Ads tem um label específico (AW-XXX/LABEL).
// O Chris precisa cadastrar 4 conversion actions na UI do Ads e popular as
// envs. Sem env, o helper é no-op (não polui dev).

type AdsConversionEnv =
  | 'NEXT_PUBLIC_ADS_CONV_SIGNUP'      // signup_complete
  | 'NEXT_PUBLIC_ADS_CONV_TRIAL'       // trial_start
  | 'NEXT_PUBLIC_ADS_CONV_FIRST_NOTE'  // first_emission
  | 'NEXT_PUBLIC_ADS_CONV_SUBSCRIBE'   // subscribe (primária)

const ADS_CONV_LABELS: Record<AdsConversionEnv, string | undefined> = {
  NEXT_PUBLIC_ADS_CONV_SIGNUP:     process.env.NEXT_PUBLIC_ADS_CONV_SIGNUP,
  NEXT_PUBLIC_ADS_CONV_TRIAL:      process.env.NEXT_PUBLIC_ADS_CONV_TRIAL,
  NEXT_PUBLIC_ADS_CONV_FIRST_NOTE: process.env.NEXT_PUBLIC_ADS_CONV_FIRST_NOTE,
  NEXT_PUBLIC_ADS_CONV_SUBSCRIBE:  process.env.NEXT_PUBLIC_ADS_CONV_SUBSCRIBE,
}

/** Dispara conversion no Google Ads. Idempotente via transaction_id (dedup
 *  no Ads). Chame após o evento GA4 correspondente. */
export function sendAdsConversion(
  conv: AdsConversionEnv,
  params: { value?: number; transactionId?: string } = {},
): void {
  if (typeof window === 'undefined') return
  if (!ADS_ID) return
  const label = ADS_CONV_LABELS[conv]
  if (!label) return // env não setada → no-op

  window.gtag?.('event', 'conversion', {
    send_to: `${ADS_ID}/${label}`,
    ...(params.value != null ? { value: params.value, currency: 'BRL' } : {}),
    ...(params.transactionId ? { transaction_id: params.transactionId } : {}),
  })
}
