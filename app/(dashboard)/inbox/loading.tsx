import { Skeleton } from '@/components/ui/skeleton'

// Mirrors InboxPageClient: title, the Messages / Bookings / Waitlist tab strip,
// then the message cards of the first tab.
export default function InboxLoading() {
  return (
    <div role="status" className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <span className="sr-only">Loading your inbox…</span>

      <div>
        <Skeleton className="h-8 w-24" />
        <Skeleton className="mt-1 h-5 w-96 max-w-full" />
      </div>

      <div>
        <div className="flex h-11 items-center gap-6 overflow-hidden border-b px-3 sm:px-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-20 shrink-0" />
          ))}
        </div>

        <div className="space-y-3 pt-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="min-w-0 space-y-1.5">
                    <Skeleton className="h-4 w-36 max-w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
