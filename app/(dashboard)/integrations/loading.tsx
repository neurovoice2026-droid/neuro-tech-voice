import { Skeleton } from '@/components/ui/skeleton'

// Mirrors IntegrationsClient: title, then groups of integration cards, each
// with a logo, name, description and a connect button.
export default function IntegrationsLoading() {
  return (
    <div role="status" className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <span className="sr-only">Loading integrations…</span>

      <div className="mb-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-1 h-5 w-96 max-w-full" />
      </div>

      {Array.from({ length: 2 }, (_, group) => (
        <div key={group} className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
            <Skeleton className="h-4 w-36" />
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: group === 0 ? 3 : 2 }, (_, i) => (
              <div
                key={i}
                className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-5 w-40 max-w-full" />
                    <Skeleton className="h-4 w-full max-w-sm" />
                  </div>
                </div>
                <Skeleton className="h-9 w-full shrink-0 sm:w-28" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
