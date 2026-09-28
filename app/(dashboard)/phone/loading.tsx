import { Skeleton } from '@/components/ui/skeleton'
import { PhoneNumbersSkeleton } from '@/components/phone/PhoneNumbersView'

// Mirrors PhoneNumbersView: title with the "Get a number" button, the count
// line, then the number cards.
export default function PhoneLoading() {
  return (
    <div role="status" className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <span className="sr-only">Loading phone numbers…</span>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-1 h-5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-full shrink-0 sm:w-36" />
      </div>

      <div className="mb-4">
        <Skeleton className="h-5 w-32" />
      </div>

      <PhoneNumbersSkeleton />
    </div>
  )
}
