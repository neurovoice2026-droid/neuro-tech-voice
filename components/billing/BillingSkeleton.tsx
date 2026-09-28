import { Skeleton } from '@/components/ui/skeleton'

// Placeholder with the same footprint as the billing overview, so nothing
// jumps when the data arrives.

export function BillingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading billing">
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-7 w-full sm:w-24" />
        </div>
        <div className="space-y-5 p-5">
          <Skeleton className="h-4 w-72 max-w-full" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border bg-card p-5">
          <Skeleton className="h-4 w-48" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        <div className="space-y-3 rounded-2xl border bg-card p-5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-full sm:w-52" />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border bg-card p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  )
}
