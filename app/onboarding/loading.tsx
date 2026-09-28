import { Skeleton } from '@/components/ui/skeleton'

// Sits inside the onboarding layout's centered column (the top bar stays
// put): step heading, a few fields and the step buttons.
export default function OnboardingLoading() {
  return (
    <div role="status" aria-busy="true" className="space-y-8">
      <span className="sr-only">Loading your setup…</span>

      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="space-y-5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className={i === 3 ? 'h-24' : 'h-11'} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}
