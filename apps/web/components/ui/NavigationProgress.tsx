'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// ── Barra de progresso global pra navegação SPA do Next.js ───────────────────
//
// Problema que resolve: no App Router, clicar num <Link> faz o Next.js buscar
// o RSC payload da nova rota antes de renderizar. Durante essa janela (300ms-2s
// dependendo da query no banco) o user fica olhando pra mesma tela sem nenhum
// feedback. Pior: se a rota lança erro/redirect, o user pode achar que o app
// travou.
//
// Como funciona:
//   1. Listener global de click em <a> dispara a barra imediatamente
//   2. Barra cresce assintoticamente até 90% (curva ease-out)
//   3. Quando o pathname/searchParams muda → completa em 100% e some
//   4. Safety timeout de 8s caso a navegação nunca complete
//   5. Ignora: links externos, anchors (#), modificadores (ctrl/cmd), target=_blank,
//      download, mesma URL (não-navegação)

function NavigationProgressInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const safetyRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearTimers() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (safetyRef.current)   { clearTimeout(safetyRef.current);   safetyRef.current = null }
    if (hideRef.current)     { clearTimeout(hideRef.current);     hideRef.current = null }
  }

  function startProgress() {
    clearTimers()
    setVisible(true)
    setProgress(15)
    intervalRef.current = setInterval(() => {
      setProgress(p => (p >= 90 ? p : p + (90 - p) * 0.1))
    }, 200)
    // Safety: nunca deixa a barra travada — se em 8s a rota não mudar, força hide.
    safetyRef.current = setTimeout(() => completeProgress(), 8_000)
  }

  function completeProgress() {
    clearTimers()
    setProgress(100)
    hideRef.current = setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 250)
  }

  // ── Listener de clicks globais ──────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (e.defaultPrevented) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      if (e.button !== 0) return

      const link = (e.target as HTMLElement | null)?.closest('a')
      if (!link) return

      const href = link.getAttribute('href')
      if (!href) return
      if (href.startsWith('#')) return
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return
      if (link.hasAttribute('download')) return
      if (link.target && link.target !== '_self') return

      // Link externo (host diferente) → deixa o browser cuidar
      try {
        const url = new URL(href, window.location.href)
        if (url.host !== window.location.host) return
        // Mesma URL completa → não há navegação, não mostra barra
        if (url.pathname + url.search === window.location.pathname + window.location.search) return
      } catch {
        return
      }

      startProgress()
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  // ── Completa quando a rota muda ─────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (visible) completeProgress() }, [pathname, searchParams])

  // Cleanup
  useEffect(() => () => clearTimers(), [])

  if (!visible) return null

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[100] h-[3px] pointer-events-none"
    >
      <div
        className="h-full bg-brand-cyan transition-[width] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          boxShadow: '0 0 10px rgba(0, 232, 255, 0.7), 0 0 5px rgba(0, 232, 255, 0.5)',
        }}
      />
    </div>
  )
}

// useSearchParams precisa de Suspense boundary no Next.js 14
export default function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  )
}
