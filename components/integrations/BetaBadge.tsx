import { cn } from '@/lib/utils'

/** Marks Google Workspace features: they work, and may still change while we refine them. */
export function BetaBadge({ className }: { className?: string }) {
  return (
    <span
      title="In beta: it works today and may still change as we refine it."
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700',
        className
      )}
    >
      Beta
    </span>
  )
}
