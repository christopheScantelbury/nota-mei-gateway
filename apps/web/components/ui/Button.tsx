'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Mobile-first: a base garante alvo de toque de 44px (WCAG 2.5.5 / Apple HIG)
// em telas pequenas. A partir de `sm` (≥640px) a altura específica do tamanho
// volta a valer, deixando os botões mais compactos no desktop.
const buttonVariants = cva(
  // base styles
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900 disabled:pointer-events-none disabled:opacity-50 select-none min-h-[44px] sm:min-h-0',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-cyan text-navy-900 hover:bg-[#00d4e8] active:bg-[#00c0d4]',
        secondary:
          'bg-navy-700 text-text-1 border border-navy-600 hover:bg-navy-600 active:bg-navy-600/80',
        ghost:
          'bg-transparent text-text-2 hover:bg-navy-700 hover:text-text-1 active:bg-navy-700/60',
        destructive:
          'bg-nota-rejeitada/10 text-nota-rejeitada border border-nota-rejeitada/30 hover:bg-nota-rejeitada/20 active:bg-nota-rejeitada/30',
        danger:
          'bg-nota-rejeitada text-white hover:bg-nota-rejeitada/90 active:bg-nota-rejeitada/80',
        upgrade:
          'bg-nota-upgrade text-white hover:bg-nota-upgrade/90 active:bg-nota-upgrade/80',
        outline:
          'bg-transparent border border-brand-cyan text-brand-cyan hover:bg-brand-cyan/10 active:bg-brand-cyan/20',
      },
      size: {
        sm: 'h-11 sm:h-9 px-3.5 text-sm',
        md: 'h-11 sm:h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-11 w-11 sm:h-10 sm:w-10 min-w-[44px] sm:min-w-0',
        'icon-sm': 'h-11 w-11 sm:h-8 sm:w-8 min-w-[44px] sm:min-w-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  /** Largura total no mobile, automática a partir de `sm` (padrão de formulário/modal). */
  fullWidth?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, fullWidth, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          buttonVariants({ variant, size }),
          fullWidth && 'w-full sm:w-auto',
          className,
        )}
        {...props}
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
