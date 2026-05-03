import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const spinnerVariants = cva(
  'animate-spin rounded-full border-2 border-t-transparent',
  {
    variants: {
      size: {
        sm:  'h-4 w-4',
        md:  'h-6 w-6',
        lg:  'h-8 w-8',
        xl:  'h-12 w-12',
      },
      color: {
        brand:   'border-brand-cyan',
        white:   'border-white',
        muted:   'border-text-2',
        current: 'border-current',
      },
    },
    defaultVariants: {
      size:  'md',
      color: 'brand',
    },
  }
)

export interface SpinnerProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'>,
    VariantProps<typeof spinnerVariants> {
  label?: string
}

function Spinner({ className, size, color, label = 'Carregando...', ...props }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex', className)} {...props}>
      <span className={cn(spinnerVariants({ size, color }))} />
      <span className="sr-only">{label}</span>
    </span>
  )
}

/** Full-page centered spinner overlay */
function SpinnerPage({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size="lg" label={label} />
    </div>
  )
}

export { Spinner, SpinnerPage }
