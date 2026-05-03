import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Makes the skeleton a circle (for avatars) */
  circle?: boolean
}

/**
 * Shimmer skeleton for loading states.
 * Drop it wherever data is still loading.
 */
function Skeleton({ className, circle, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-navy-600/60 rounded-md',
        circle && 'rounded-full',
        className
      )}
      {...props}
    />
  )
}

/** Pre-built skeleton for a single table row */
function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  )
}

/** Pre-built skeleton for a card */
function SkeletonCard() {
  return (
    <div className="rounded-xl border border-navy-600/50 bg-navy-700 p-6 flex flex-col gap-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-8 w-full" />
    </div>
  )
}

export { Skeleton, SkeletonRow, SkeletonCard }
