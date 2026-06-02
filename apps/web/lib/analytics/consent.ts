// LGPD consent management for GA4 (Consent Mode v2).
//
// Spec: HIST-7.1 do pacote NotaFacil-Specs-v1.
// Cookie `nf_consent` persiste a escolha do usuário por 12 meses.
// Antes do aceite, GA4 fica em `analytics_storage='denied'` e não envia eventos.

export type ConsentState = 'granted' | 'denied'

export const CONSENT_COOKIE = 'nf_consent'
const ONE_YEAR_S = 60 * 60 * 24 * 365

declare global {
  interface Window {
    // gtag injetado pelo script GA4. Tipado de forma laxa pra acomodar a
    // assinatura variádica oficial (event, command, set, consent, etc.).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag?: (...args: any[]) => void
    dataLayer?: unknown[]
  }
}

/**
 * Atualiza o consent state do GA4 e persiste em cookie.
 * Chamado pelo CookieBanner após o user clicar em "Aceitar" ou "Rejeitar".
 */
export function setConsent(state: ConsentState): void {
  if (typeof window === 'undefined') return

  window.gtag?.('consent', 'update', {
    analytics_storage: state,
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })

  document.cookie = `${CONSENT_COOKIE}=${state}; path=/; max-age=${ONE_YEAR_S}; SameSite=Lax`
}

/** Lê o estado de consent persistido (server-safe). */
export function getConsent(): ConsentState | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=(granted|denied)`))
  return (match?.[1] as ConsentState) ?? null
}
