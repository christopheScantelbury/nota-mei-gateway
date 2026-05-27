'use client'

import { useState, useRef, useEffect } from 'react'

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
  /** Quando true, o dropdown abre INLINE (empurra conteúdo). Use em modais
   *  com overflow-y-auto. Default = false (absolute, overlay). */
  inline?:      boolean
  'aria-label'?: string
}

/**
 * Select padronizado pra identidade visual do Nota Fácil.
 *
 * Substituto pra `<select>` nativo, que renderiza um dropdown quadrado
 * (sistema operacional) e quebra a estética arredondada do app.
 *
 * Padrão visual:
 *  - bg-navy-900, border border-navy-600, rounded-lg
 *  - focus: border-brand-cyan
 *  - dropdown: bg-navy-900, border-navy-600, rounded-xl, shadow-xl
 *  - opção destacada: bg-navy-700
 *  - opção selecionada: text-brand-cyan
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
  inline = false,
  'aria-label': ariaLabel,
}: SelectProps) {
  const [open, setOpen]               = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const boxRef    = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Fechar ao clicar fora
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

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

  // Open via teclado quando o botão tem foco
  function onButtonKey(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      setOpen(true)
    }
  }

  const menuCls = inline
    ? 'mt-1 w-full rounded-xl border border-navy-600 bg-navy-900 shadow-xl max-h-60 overflow-y-auto py-1'
    : 'absolute z-30 mt-1 w-full rounded-xl border border-navy-600 bg-navy-900 shadow-xl max-h-60 overflow-y-auto py-1'

  return (
    <div className={`${inline ? '' : 'relative'} ${className}`} ref={boxRef}>
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

      {open && (
        <ul role="listbox" className={menuCls}>
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
                  onClick={() => {
                    if (opt.disabled) return
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
        </ul>
      )}
    </div>
  )
}

export default Select
