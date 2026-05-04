'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, disabled, id, 'aria-describedby': ariaDescribedby, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId     = id ?? generatedId
    const errorId     = `${inputId}-error`
    const hintId      = `${inputId}-hint`

    const describedBy = [
      ariaDescribedby,
      error ? errorId : null,
      hint && !error ? hintId : null,
    ].filter(Boolean).join(' ') || undefined

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text-1"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 text-text-2" aria-hidden="true">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              'w-full rounded-lg border bg-navy-700 px-3 py-2 text-sm text-text-1 placeholder:text-text-2/60',
              'transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-brand-cyan/60 focus:border-brand-cyan/60',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error
                ? 'border-nota-rejeitada focus:ring-nota-rejeitada/40 focus:border-nota-rejeitada'
                : 'border-navy-600 hover:border-navy-600/80',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="pointer-events-none absolute right-3 text-text-2" aria-hidden="true">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-xs text-nota-rejeitada">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-xs text-text-2">{hint}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
