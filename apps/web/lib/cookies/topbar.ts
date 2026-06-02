// Cookies de dismiss do UrgencyTopBar.
//
// Spec: HIST-1.1 + D-14 (cookie 7 dias, versão v1 pra invalidar via bump).

export const TOPBAR_COOKIE = 'nf_topbar_dismissed_v1'
const SEVEN_DAYS_S = 60 * 60 * 24 * 7

/** True se o user dispensou a top bar nos últimos 7 dias. */
export function isTopbarDismissed(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some(c => c.trim().startsWith(`${TOPBAR_COOKIE}=1`))
}

/** Persiste o dismiss por 7 dias. */
export function dismissTopbar(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${TOPBAR_COOKIE}=1; path=/; max-age=${SEVEN_DAYS_S}; SameSite=Lax`
}
