import { Skeleton } from '@/components/ui/skeleton'

// Mirrors VoiceLabClient: title, the two tool tabs, then the text-to-speech
// panel (script and settings beside the voice and the result).
export default function VoiceLabLoading() {
  return (
    <div role="status" className="min-w-0 space-y-6 p-4 sm:p-6">
      <span className="sr-only">Loading the Voice Lab…</span>

      <div>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="mt-1 h-5 w-full max-w-2xl" />
      </div>

      <div>
        <Skeleton className="h-9 w-full rounded-lg sm:w-80" />

        <div className="grid min-w-0 gap-6 pt-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-40" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
          <div className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5">
            <Skeleton className="h-5 w-28" />
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32 max-w-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
            <Skeleton className="h-14" />
          </div>
        </div>
      </div>
    </div>
  )
}
