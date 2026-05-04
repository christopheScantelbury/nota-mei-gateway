'use client'

import { useEffect, useRef } from 'react'

/**
 * Fires a CSS confetti burst when the user's very first nota is AUTORIZADA.
 * Uses pure CSS + requestAnimationFrame — no external dependencies.
 */
export default function PrimeiraNotaCelebration() {
  const containerRef = useRef<HTMLDivElement>(null)
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current || !containerRef.current) return
    fired.current = true

    const container = containerRef.current
    const colors = ['#00E8FF', '#00C85A', '#7C6FFF', '#F0B414', '#EEF4FF']
    const count = 80

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div')
      el.style.cssText = `
        position: fixed;
        top: 0;
        left: ${Math.random() * 100}vw;
        width: ${4 + Math.random() * 6}px;
        height: ${4 + Math.random() * 6}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        opacity: 1;
        pointer-events: none;
        z-index: 9999;
        animation: confetti-fall ${1.5 + Math.random() * 2}s ease-in forwards;
        animation-delay: ${Math.random() * 0.5}s;
        transform: rotate(${Math.random() * 360}deg);
      `
      container.appendChild(el)
    }

    // Clean up after animation
    const timer = setTimeout(() => {
      if (container.parentNode) container.innerHTML = ''
    }, 3500)

    return () => {
      clearTimeout(timer)
    }
  }, [])

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      <div ref={containerRef} aria-hidden="true" />
    </>
  )
}
