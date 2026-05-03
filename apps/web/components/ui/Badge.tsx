import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import type { NotaStatus } from '@/lib/types'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-navy-600 text-text-1',
        primary:     'bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/25',
        secondary:   'bg-navy-700 text-text-2 border border-navy-600',
        success:     'bg-nota-autorizada/15 text-nota-autorizada border border-nota-autorizada/25',
        warning:     'bg-nota-processando/15 text-nota-processando border border-nota-processando/25',
        destructive: 'bg-nota-rejeitada/15 text-nota-rejeitada border border-nota-rejeitada/25',
        neutral:     'bg-nota-cancelada/15 text-nota-cancelada border border-nota-cancelada/25',
        upgrade:     'bg-nota-upgrade/15 text-nota-upgrade border border-nota-upgrade/25',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

// ── Status badge ────────────────────────────────────────────────────────────

const statusVariantMap: Record<NotaStatus, VariantProps<typeof badgeVariants>['variant']> = {
  AUTORIZADA:      'success',
  PROCESSANDO:     'warning',
  REJEITADA:       'destructive',
  CANCELADA:       'neutral',
  ERRO_TEMPORARIO: 'destructive',
}

const statusLabelMap: Record<NotaStatus, string> = {
  AUTORIZADA:      'Autorizada',
  PROCESSANDO:     'Processando',
  REJEITADA:       'Rejeitada',
  CANCELADA:       'Cancelada',
  ERRO_TEMPORARIO: 'Erro',
}

interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: NotaStatus
}

function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const variant = statusVariantMap[status] ?? 'default'
  const label   = statusLabelMap[status] ?? status

  return (
    <Badge
      variant={variant}
      className={cn(status === 'PROCESSANDO' && 'animate-pulse', className)}
      {...props}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  )
}

export { Badge, StatusBadge, badgeVariants }
