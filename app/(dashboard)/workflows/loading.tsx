import { Skeleton } from '@/components/ui/skeleton'

// Mirrors WorkflowsClient: title with "New workflow", four summary tiles, then
// the workflow cards.
export default function WorkflowsLoading() {
  return (
    <div role="status" className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <span className="sr-only">Loading workflows…</span>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="mt-1 h-5 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-full shrink-0 sm:w-36" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-3 w-14 max-w-full" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-5 w-48 max-w-full" />
              <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
