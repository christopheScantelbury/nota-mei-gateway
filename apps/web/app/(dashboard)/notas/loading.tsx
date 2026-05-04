import { Skeleton } from '@/components/ui/Skeleton'

export default function NotasLoading() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton className="h-8 w-40 mb-1.5" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>
      {/* Filter bar skeleton */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
      </div>
      {/* Table skeleton */}
      <div className="rounded-xl border border-navy-600 overflow-hidden">
        <div className="bg-navy-700 border-b border-navy-600 flex gap-4 px-4 py-3">
          {[60, 200, 100, 80, 100, 120, 40].map((w, i) => (
            <Skeleton key={i} className={`h-3 w-[${w}px]`} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-navy-600 last:border-0">
            <Skeleton className="h-4 w-14 font-mono" />
            <div className="flex-1">
              <Skeleton className="h-4 w-40 mb-1" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
