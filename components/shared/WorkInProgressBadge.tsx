import { Construction } from 'lucide-react'
import { cn } from '@/lib/utils'

// Google integrations (OAuth connect + workflow/call actions) aren't
// reliably verified against live production credentials yet - this flags
// every surface that touches them so customers aren't surprised when a
// "Connect"/"Send" action doesn't do what it says.
export function WorkInProgressBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700',
        className
      )}
    >
      <Construction className="h-2.5 w-2.5" />
      Work in progress
    </span>
  )
}
