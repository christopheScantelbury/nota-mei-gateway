'use client'

import { forwardRef, useEffect, useState } from 'react'

interface MoneyInputProps {
  /** Valor como string no formato BR (ex.: "1.234,56" ou "0,00"). Pode também
   *  ser passado em formato US ("1234.56") — o componente normaliza pra BR
   *  internamente. O `onChange` sempre devolve no formato US sem separadores
   *  de milhar (ex.: "1234.56"), pronto pra `parseFloat()`. */
  value: string
  /** Callback recebe sempre o valor em formato US ("1234.56"). Use parseFloat
   *  direto, sem `.replace(',', '.')`. */
  onChange: (valorUS: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  id?: string
  name?: string
  'aria-label'?: string
}

/** Limita a apenas dígitos + uma vírgula com no máx 2 decimais. Aceita
 *  ponto como atalho (vira vírgula). */
function sanitizeInput(raw: string): string {
  // 1. Substitui ponto por vírgula (atalho pra teclado numérico mobile)
  const normalized = raw.replace(/\./g, ',')
  // 2. Remove tudo que não é dígito ou vírgula
  const onlyValid = normalized.replace(/[^\d,]/g, '')
  // 3. Só permite uma vírgula
  const parts = onlyValid.split(',')
  if (parts.length === 1) return parts[0]
  return `${parts[0]},${parts.slice(1).join('').slice(0, 2)}`
}

/** Converte string interna ("1234,56") pra formato exibido com milhar
 *  ("1.234,56"). Só agrupa os dígitos antes da vírgula. */
function toBRDisplay(internal: string): string {
  if (!internal) return ''
  const [int, dec] = internal.split(',')
  const intFormatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return dec !== undefined ? `${intFormatted},${dec}` : intFormatted
}

/** Recebe valor (US ou BR), devolve internal BR ("1234,56" sem milhar). */
function parseIncoming(value: string): string {
  if (!value) return ''
  // Se tem ponto e vírgula, é formato BR com milhar — usa direto
  if (value.includes('.') && value.includes(',')) {
    return value.replace(/\./g, '')
  }
  // Se tem ponto sem vírgula, é formato US — converte
  if (value.includes('.') && !value.includes(',')) {
    return value.replace('.', ',')
  }
  // Senão, já é BR (só vírgula ou só dígitos)
  return value
}

/** Converte internal BR ("1234,56") pra formato US sem milhar ("1234.56"). */
function toUS(internal: string): string {
  return internal.replace(',', '.')
}

const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onChange, placeholder = '0,00', required, disabled, className, id, name, ...rest },
  ref,
) {
  // Estado interno: valor em BR sem separador de milhar ("1234,56").
  // Display formata com milhar só quando o input não está focado.
  const [internal, setInternal] = useState(() => parseIncoming(value))
  const [focused, setFocused] = useState(false)

  // Sincroniza quando o pai muda o value de fora (ex.: aplicar template)
  useEffect(() => {
    const incoming = parseIncoming(value)
    if (incoming !== internal && !focused) {
      setInternal(incoming)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = sanitizeInput(e.target.value)
    setInternal(next)
    onChange(toUS(next))
  }

  function handleBlur() {
    setFocused(false)
    if (!internal) return
    // Normaliza pra 2 casas decimais (sem arredondar pra cima)
    const n = parseFloat(toUS(internal))
    if (!isNaN(n) && n >= 0) {
      const normalized = n.toFixed(2).replace('.', ',')
      setInternal(normalized)
      onChange(toUS(normalized))
    }
  }

  const displayed = focused ? internal : toBRDisplay(internal)

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={displayed}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={className}
      id={id}
      name={name}
      {...rest}
    />
  )
})

export default MoneyInput
