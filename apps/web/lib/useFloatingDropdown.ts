'use client'

import { useState, useRef, useEffect, useCallback, MutableRefObject } from 'react'

interface FloatingPos {
  top:    number | 'auto'
  bottom: number | 'auto'
  left:   number
  width:  number
  openUp: boolean
}

interface UseFloatingDropdownReturn<T extends HTMLElement> {
  triggerRef: MutableRefObject<T | null>
  menuRef:    MutableRefObject<HTMLDivElement | null>
  pos:        FloatingPos | null
}

/**
 * Hook que calcula posição absoluta (position: fixed) pra um dropdown,
 * a partir das coordenadas do elemento trigger. Pra usar em conjunto com
 * createPortal(...) renderizando o menu em document.body.
 *
 * Por que portal: dropdowns dentro de modais com overflow-y-auto são
 * cortados na borda do modal. Também, dropdowns inline empurram o
 * conteúdo abaixo, fazendo o modal "respirar" (grow/shrink) ao
 * abrir/fechar. Portal + position:fixed resolve os dois problemas.
 *
 * Decide automaticamente abrir pra cima ou pra baixo conforme espaço
 * disponível no viewport.
 *
 * Recalcula em scroll + resize (passive + capture pra pegar scrolls
 * de containers internos do app, não só window).
 *
 * Uso:
 *   const { triggerRef, menuRef, pos } = useFloatingDropdown(open, { menuMaxH: 240 })
 *
 *   <button ref={triggerRef} onClick={() => setOpen(true)}>...</button>
 *   {open && pos && createPortal(
 *     <div ref={menuRef} style={{ position:'fixed', top:pos.top, ... }} />,
 *     document.body
 *   )}
 */
export function useFloatingDropdown<T extends HTMLElement>(
  open: boolean,
  opts: { menuMaxH?: number } = {},
): UseFloatingDropdownReturn<T> {
  const menuMaxH = opts.menuMaxH ?? 240
  const [pos, setPos] = useState<FloatingPos | null>(null)
  const triggerRef = useRef<T | null>(null)
  const menuRef    = useRef<HTMLDivElement | null>(null)

  const update = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openUp = spaceBelow < menuMaxH && spaceAbove > spaceBelow
    setPos({
      top:    openUp ? 'auto' : rect.bottom + 4,
      bottom: openUp ? (window.innerHeight - rect.top + 4) : 'auto',
      left:   rect.left,
      width:  rect.width,
      openUp,
    })
  }, [menuMaxH])

  useEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    update()
    const passiveCapture = { capture: true, passive: true } as const
    window.addEventListener('scroll', update, passiveCapture)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, passiveCapture)
      window.removeEventListener('resize', update)
    }
  }, [open, update])

  return { triggerRef, menuRef, pos }
}
