'use client'

// TurnstileChallenge — captcha Cloudflare Turnstile feature-flagged via
// NEXT_PUBLIC_TURNSTILE_SITE_KEY. Quando a env var não está setada, o
// componente vira no-op (retorna null) e onToken('') é chamado imediatamente —
// permitindo que o caller continue sem captcha em dev.
//
// Carregado dinamicamente pra não pesar bundle inicial.

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
        }
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
    onTurnstileReady?: () => void
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

interface TurnstileChallengeProps {
  onToken: (token: string) => void
  onError?: () => void
}

export function isCaptchaEnabled(): boolean {
  return !!SITE_KEY
}

export default function TurnstileChallenge({ onToken, onError }: TurnstileChallengeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef  = useRef<string | null>(null)

  useEffect(() => {
    if (!SITE_KEY) {
      // Sem captcha configurado — token vazio (Supabase aceita quando captcha
      // não está habilitado no projeto).
      onToken('')
      return
    }

    // Injeta o script do Turnstile uma única vez por página
    if (!document.querySelector('script[data-turnstile]')) {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileReady'
      script.async = true
      script.defer = true
      script.setAttribute('data-turnstile', 'true')
      document.head.appendChild(script)
    }

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current) return
      // Cleanup do widget anterior se existir
      if (widgetIdRef.current) {
        try { window.turnstile.remove(widgetIdRef.current) } catch {}
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => onToken(token),
        'error-callback': () => onError?.(),
        'expired-callback': () => onToken(''),
        theme: 'auto',
      })
    }

    if (window.turnstile) {
      renderWidget()
    } else {
      window.onTurnstileReady = renderWidget
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current) } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!SITE_KEY) return null

  return <div ref={containerRef} className="flex justify-center my-2" />
}
