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

  // Os quatro sinais seguem o MESMO estado.
  //
  // Bug corrigido em 2026-07-21: aqui `ad_storage`/`ad_user_data`/
  // `ad_personalization` estavam fixos em 'denied' mesmo quando o usuário
  // aceitava — mas o caminho de visitante recorrente (gtag.ts, que lê o cookie
  // `nf_consent` já salvo) concedia os quatro. Os dois discordavam.
  //
  // Como `ad_storage` é o que autoriza guardar o GCLID (cookie `_gcl_*`), a
  // atribuição clique→conversão ficava quebrada exatamente na PRIMEIRA visita,
  // que é a que vem do anúncio. Só passava a funcionar se a pessoa voltasse
  // depois — o inverso do necessário. Como a conversão chega no Google Ads por
  // importação do GA4, isso inutilizava a medição da campanha.
  const value = state
  window.gtag?.('consent', 'update', {
    analytics_storage: value,
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
  })

  document.cookie = `${CONSENT_COOKIE}=${state}; path=/; max-age=${ONE_YEAR_S}; SameSite=Lax`
}

/** Lê o estado de consent persistido (server-safe). */
export function getConsent(): ConsentState | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=(granted|denied)`))
  return (match?.[1] as ConsentState) ?? null
}

/**
 * Evento disparado quando a escolha é revogada, pra o banner voltar a aparecer.
 *
 * O banner (root layout) e o link "Preferências de cookies" (rodapé) são
 * componentes irmãos, sem estado compartilhado — um evento no window é a ponte
 * mais simples, sem precisar de context só pra isso.
 */
export const CONSENT_RESET_EVENT = 'nf:consent-reset'

/**
 * Revoga a escolha e volta ao estado negado, reexibindo o banner.
 *
 * A LGPD exige que revogar seja tão fácil quanto consentir (Art. 8º, §5º).
 * Antes disto o banner sumia após a primeira interação e não havia como mudar
 * de ideia sem apagar cookies na mão — o que efetivamente prendia a escolha.
 *
 * Nega os sinais no gtag ANTES de apagar o cookie: se o usuário sair da página
 * em seguida, o estado que vale já é o restritivo.
 */
export function resetConsent(): void {
  if (typeof window === 'undefined') return

  window.gtag?.('consent', 'update', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })

  document.cookie = `${CONSENT_COOKIE}=; path=/; max-age=0; SameSite=Lax`
  window.dispatchEvent(new Event(CONSENT_RESET_EVENT))
}
