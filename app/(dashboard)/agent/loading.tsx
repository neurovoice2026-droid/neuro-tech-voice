import { Skeleton } from '@/components/ui/skeleton'

// Mirrors AgentPageClient: the agent header (avatar, name, status, the on/off
// switch), the settings tab strip, then the first tab's form sections.
export default function AgentLoading() {
  return (
    <div role="status" className="flex h-full flex-col">
      <span className="sr-only">Loading your agent…</span>

      <div className="border-b bg-card px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
            <Skeleton className="size-11 shrink-0 rounded-full sm:size-12" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-7 w-40 max-w-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="mt-1.5 h-5 w-64 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-10 w-24 shrink-0 rounded-lg" />
        </div>
      </div>

      <div className="border-b bg-card px-2 sm:px-6">
        <div className="mx-auto flex h-11 max-w-3xl items-center gap-6 overflow-hidden px-3 sm:px-4">
          {/* One per tab: General, Conversation, Voice, Knowledge, Skills. */}
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-20 shrink-0" />
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-6 sm:px-6">
        {Array.from({ length: 3 }, (_, section) => (
          <div key={section} className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
            <Skeleton className="h-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
