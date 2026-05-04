import { Skeleton } from '@/components/ui/Skeleton'

export default function BillingLoading() {
  return (
    <div className="p-8 max-w-4xl">
      <Skeleton className="h-8 w-56 mb-2" />
      <Skeleton className="h-4 w-48 mb-8" />
      {/* Usage card */}
      <div className="rounded-xl border border-navy-600 bg-navy-700 p-6 mb-6">
        <Skeleton className="h-4 w-24 mb-4" />
        <Skeleton className="h-7 w-32 mb-2" />
        <Skeleton className="h-2 w-full rounded-full mb-1" />
        <Skeleton className="h-3 w-40" />
      </div>
      {/* Chart skeleton */}
      <div className="rounded-xl border border-navy-600 bg-navy-700 p-6 mb-6">
        <Skeleton className="h-5 w-64 mb-4" />
        <div className="flex items-end gap-3 h-40">
          {[70, 40, 90, 55, 80, 100].map((h, i) => (
            <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      {/* Plan cards */}
      <Skeleton className="h-6 w-40 mb-4" />
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl border border-navy-600 p-5">
            <Skeleton className="h-5 w-20 mb-2" />
            <Skeleton className="h-8 w-28 mb-2" />
            <Skeleton className="h-4 w-36" />
          </div>
        ))}
      </div>
    </div>
  )
}
