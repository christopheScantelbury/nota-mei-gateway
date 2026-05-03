'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // base styles
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900 disabled:pointer-events-none disabled:opacity-50 select-none',
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
        outline:
          'bg-transparent border border-brand-cyan text-brand-cyan hover:bg-brand-cyan/10 active:bg-brand-cyan/20',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size }), className)}
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
