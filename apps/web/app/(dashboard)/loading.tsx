import { Skeleton } from '@/components/ui/Skeleton'

export default function DashboardLoading() {
  return (
    <div className="p-8 max-w-5xl animate-pulse">
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-4 w-64 mb-8" />
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 rounded-xl border border-navy-600 bg-navy-700 p-6">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-8 w-36 mb-2" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="rounded-xl border border-navy-600 bg-navy-700 p-6 space-y-3">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
      <div className="rounded-xl border border-navy-600 overflow-hidden">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-navy-600 last:border-0">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
