'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  value:        string
  onChange:    (value: string) => void
  options:      SelectOption[]
  placeholder?: string
  className?:   string
  disabled?:    boolean
  /** Mantido por compat com chamadas antigas. Hoje todos os Selects usam portal,
   *  então essa prop não muda mais nada (sempre renderiza fora do fluxo). */
  inline?:      boolean
  'aria-label'?: string
}

/**
 * Select padronizado pra identidade visual do Nota Fácil.
 *
 * Renderiza o dropdown via React Portal (document.body) com position:fixed,
 * calculando posição a partir do botão trigger. Vantagens:
 *  - Em modais com overflow-y-auto, não é cortado pela borda
 *  - Não empurra conteúdo abaixo (modal não "respira" ao abrir/fechar)
 *  - Funciona igual em qualquer contexto (página, modal, etc.)
 *  - Reposiciona automaticamente em scroll/resize
 *
 * A11y:
 *  - role="listbox" no menu, role="option" nas opções
 *  - ArrowDown/Up navega, Enter seleciona, Escape fecha
 *  - aria-expanded, aria-selected, aria-disabled
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = '— Selecionar —',
  className = '',
  disabled,
  'aria-label': ariaLabel,
}: SelectProps) {
  const [open, setOpen]               = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [pos, setPos]                 = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef   = useRef<HTMLUListElement>(null)

  // Calcula posição do dropdown a partir do botão. Abre pra baixo por default;
  // se não couber, abre pra cima.
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const dropdownMaxH = 240 // bate com max-h-60
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openUp = spaceBelow < dropdownMaxH && spaceAbove > spaceBelow

    setPos({
      top:   openUp ? rect.top - 4 : rect.bottom + 4,
      left:  rect.left,
      width: rect.width,
      openUp,
    })
  }, [])

  // Recalcula em open + em scroll/resize
  useEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    updatePosition()
    const opts = { capture: true, passive: true } as const
    window.addEventListener('scroll', updatePosition, opts)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, opts)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  // Fechar ao clicar fora (botão OU menu)
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      const target = e.target as Node
      const inButton = buttonRef.current?.contains(target)
      const inMenu   = menuRef.current?.contains(target)
      if (!inButton && !inMenu) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Highlight inicial sincroniza com o value ao abrir
  useEffect(() => {
    if (open) {
      const idx = options.findIndex(o => o.value === value)
      setHighlighted(idx >= 0 ? idx : 0)
    }
  }, [open, options, value])

  // Keyboard nav
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        buttonRef.current?.focus()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlighted(h => Math.min(options.length - 1, h + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlighted(h => Math.max(0, h - 1))
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (highlighted >= 0 && highlighted < options.length) {
          const opt = options[highlighted]
          if (!opt.disabled) {
            onChange(opt.value)
            setOpen(false)
            buttonRef.current?.focus()
          }
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, highlighted, options, onChange])

  const selected = options.find(o => o.value === value)

  function onButtonKey(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      setOpen(true)
    }
  }

  return (
    <div className={className}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        onKeyDown={onButtonKey}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="w-full flex items-center justify-between gap-2 bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-cyan transition disabled:opacity-50 disabled:cursor-not-allowed text-left"
      >
        <span className={`truncate ${selected ? 'text-text-1' : 'text-text-2'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 16 16"
          className={`text-text-2 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <ul
          ref={menuRef}
          role="listbox"
          style={{
            position: 'fixed',
            top:    pos.openUp ? 'auto' : pos.top,
            bottom: pos.openUp ? (window.innerHeight - pos.top) : 'auto',
            left:   pos.left,
            width:  pos.width,
            zIndex: 1000,
          }}
          className="rounded-xl border border-navy-600 bg-navy-900 shadow-2xl max-h-60 overflow-y-auto py-1"
        >
          {options.length === 0 && (
            <li className="px-3 py-2 text-xs text-text-2">Nenhuma opção disponível</li>
          )}
          {options.map((opt, i) => {
            const isSelected    = opt.value === value
            const isHighlighted = i === highlighted
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled}
              >
                <button
                  type="button"
                  disabled={opt.disabled}
                  onMouseEnter={() => setHighlighted(i)}
                  // onMouseDown + preventDefault + stopPropagation: o menu é
                  // portal pra body. Dentro de Radix Dialog, o Dialog
                  // intercepta cliques fora via onPointerDownOutside e o
                  // onClick nunca dispara. mousedown roda antes.
                  onMouseDown={(e) => {
                    if (opt.disabled) return
                    e.preventDefault()
                    e.stopPropagation()
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  onClick={(e) => {
                    if (opt.disabled) return
                    e.preventDefault()
                    e.stopPropagation()
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={[
                    'w-full text-left px-3 py-2 text-sm transition',
                    isHighlighted ? 'bg-navy-700' : '',
                    isSelected   ? 'text-brand-cyan font-medium' : 'text-text-1',
                    opt.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                  ].filter(Boolean).join(' ')}
                >
                  {opt.label}
                </button>
              </li>
            )
          })}
        </ul>,
        document.body,
      )}
    </div>
  )
}

export default Select
