'use client'

import { resetConsent } from '@/lib/analytics/consent'

/**
 * Link que revoga o consentimento e reabre o banner de cookies.
 *
 * Existe como componente próprio (e não inline no rodapé) porque precisa
 * aparecer também em `/privacidade` e `/termos` — que são Server Components
 * com rodapé inline, sem o `LandingFooter`. A política de privacidade instrui
 * o usuário a "usar o link Preferências de cookies no rodapé", então a página
 * que dá a instrução precisa ter o link.
 *
 * Revogar tem que ser tão fácil quanto consentir (LGPD Art. 8º, §5º).
 */
export default function CookiePreferencesLink({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={resetConsent}
      className={`hover:text-text-1 transition text-left ${className}`}
    >
      Preferências de cookies
    </button>
  )
}
