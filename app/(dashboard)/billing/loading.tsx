import { Skeleton } from '@/components/ui/skeleton'
import { BillingSkeleton } from '@/components/billing/BillingSkeleton'

// The billing page's frame (title and description) around the placeholder it
// streams behind its own Suspense boundary.
export default function BillingLoading() {
  return (
    <div role="status" className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <span className="sr-only">Loading billing…</span>
      <div>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-1 h-5 w-80 max-w-full" />
      </div>
      <BillingSkeleton />
    </div>
  )
}
