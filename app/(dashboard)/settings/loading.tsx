import { Skeleton } from '@/components/ui/skeleton'

// Mirrors SettingsPageClient: title, then stacked sections (business details,
// time zone, messaging, account) with labelled fields.
export default function SettingsLoading() {
  return (
    <div role="status" className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <span className="sr-only">Loading settings…</span>

      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-1 h-5 w-80 max-w-full" />
      </div>

      {Array.from({ length: 4 }, (_, section) => (
        <div key={section} className="space-y-5 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: section === 0 ? 2 : 1 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-10" />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-9 w-full sm:w-28" />
          </div>
        </div>
      ))}
    </div>
  )
}
