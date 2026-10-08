import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  /** No tinted background — for use inside a white panel (e.g. an empty table body). */
  bare?: boolean
  /** Overrides the icon disc (e.g. "bg-destructive-soft text-destructive shadow-none" for an error state). */
  iconClassName?: string
  className?: string
}

/** Centred empty/zero state: icon disc, title, description and an optional action. */
export function EmptyState({ icon: Icon, title, description, action, bare = false, iconClassName, className }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl px-6 py-12 text-center',
        bare ? null : 'bg-secondary',
        className
      )}
    >
      <div
        className={cn(
          'mb-4 grid size-11 place-items-center rounded-full bg-white text-foreground shadow-hair',
          iconClassName
        )}
      >
        <Icon aria-hidden className="size-5" />
      </div>
      <h3 className="text-[15px] leading-[22px] font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-[13px] leading-[19px] text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
