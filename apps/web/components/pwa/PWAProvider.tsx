'use client'

import { useEffect, useState, useCallback } from 'react'

// ── Tipos do beforeinstallprompt (não tipado por padrão no DOM) ─────────────
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'pwa-install-dismissed-at'
const DISMISS_TTL   = 7 * 24 * 60 * 60 * 1000 // 7 dias

/**
 * PWAProvider — registra o Service Worker e oferece um banner de instalação
 * customizado (Android/Chrome). iOS não dispara beforeinstallprompt — usuário
 * adiciona via "Compartilhar → Adicionar à Tela de Início", mostramos uma
 * dica diferente quando detectamos iOS Safari.
 *
 * Banner é fechável e não mostra de novo por 7 dias.
 * Já está dentro de um app instalado (display-mode standalone) → nunca aparece.
 */
export default function PWAProvider() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner,   setShowBanner]   = useState(false)
  const [isIOS,        setIsIOS]        = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  // Registra o service worker + detecta novas versões
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return // SW só em produção

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((reg) => {
          // Listener: quando novo SW é encontrado, espera ele instalar e
          // recarrega a página automaticamente quando ele assume controle.
          // Sem isso, usuário fica vendo UI antiga até fechar/abrir a aba.
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (!newWorker) return
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nova versão pronta — recarrega após pequeno delay
                setTimeout(() => window.location.reload(), 100)
              }
            })
          })

          // Também: checa por updates a cada 60s (em sessões longas)
          setInterval(() => reg.update().catch(() => {}), 60_000)
        })
        .catch((err) => console.warn('[PWA] SW register falhou:', err))

      // Recarrega quando o SW assume controle (cobre o caso de outro tab
      // ter ativado a nova versão).
      let reloaded = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return
        reloaded = true
        window.location.reload()
      })
    }
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })
  }, [])

  // Detecta iOS + standalone + escuta beforeinstallprompt
  useEffect(() => {
    if (typeof window === 'undefined') return

    const ua  = navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true

    setIsIOS(ios)
    setIsStandalone(standalone)
    if (standalone) return // já instalado, não mostra banner

    // Verifica dismiss recente
    const dismissed = Number(localStorage.getItem(DISMISSED_KEY) ?? 0)
    if (Date.now() - dismissed < DISMISS_TTL) return

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Se iOS Safari, mostra dica manual (sem evento programático)
    if (ios) {
      // Pequeno delay pra não atrapalhar carregamento
      const t = setTimeout(() => setShowBanner(true), 2500)
      return () => {
        clearTimeout(t)
        window.removeEventListener('beforeinstallprompt', handler)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = useCallback(() => {
    setShowBanner(false)
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
  }, [])

  const install = useCallback(async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') {
      setShowBanner(false)
    } else {
      dismiss()
    }
    setInstallEvent(null)
  }, [installEvent, dismiss])

  if (!showBanner || isStandalone) return null

  return (
    <div
      role="dialog"
      aria-labelledby="pwa-install-title"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md
                 rounded-2xl border border-navy-600 bg-navy-700 shadow-2xl
                 p-4 sm:p-5 animate-fade-up"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-brand-blue/15 flex items-center justify-center text-xl" aria-hidden="true">
          📱
        </div>
        <div className="flex-1 min-w-0">
          <p id="pwa-install-title" className="font-semibold text-text-1 text-sm mb-1">
            Instale o NotaFácil no seu celular
          </p>
          {isIOS ? (
            <p className="text-text-2 text-xs leading-relaxed">
              Toque em <strong>Compartilhar</strong> e depois em
              <strong> Adicionar à Tela de Início</strong>. Vira um app — abre direto, sem barra do navegador.
            </p>
          ) : (
            <p className="text-text-2 text-xs leading-relaxed">
              Acesso rápido na tela inicial, abre instantaneamente, funciona até offline.
            </p>
          )}
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 text-text-2 hover:text-text-1 transition-colors"
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>
      {!isIOS && installEvent && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={install}
            className="flex-1 bg-brand-blue text-white text-sm font-semibold py-2 rounded-lg hover:bg-brand-blue-dark transition-colors"
          >
            Instalar
          </button>
          <button
            onClick={dismiss}
            className="px-4 text-text-2 text-sm hover:text-text-1 transition-colors"
          >
            Agora não
          </button>
        </div>
      )}
    </div>
  )
}
