'use client'

import { ChevronDown, Search, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CardError } from '@/components/dashboard/CardError'
import { EmptyState } from '@/components/shared/EmptyState'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { cn } from '@/lib/utils'
import { formatCount } from './format'

// The pieces every Store list shares: the search pill, the white panel that
// holds a table through its loading / error / empty / filled states, and the
// "Load more" footer of a cursor-paged list.

/** The dashboard's CardError with the Store section's retry wording. */
export function CommerceCardError(props: Omit<React.ComponentProps<typeof CardError>, 'retryLabel' | 'retryingLabel'>) {
  return <CardError retryLabel="Try again" retryingLabel="Reloading…" {...props} />
}

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  /** Accessible name of the field. */
  label: string
  className?: string
}

export function SearchField({ value, onChange, placeholder, label, className }: SearchFieldProps) {
  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        maxLength={120}
        className="h-9 rounded-full pr-10 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="tap-44 absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X />
        </Button>
      )}
    </div>
  )
}

interface RecordsPanelProps {
  isLoading: boolean
  error: string | null
  onRetry: () => void
  /** No rows after loading. */
  isEmpty: boolean
  /** A search or filter narrows the list: an empty result is a filter miss, not an empty store. */
  filtered?: boolean
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription?: React.ReactNode
  emptyAction?: React.ReactNode
  loadingLabel: string
  /** Height reserved while the first page loads, so the page does not jump. */
  minHeightClassName?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

/** White panel around a table: orb while loading, CardError with retry, EmptyState, or the rows plus a footer. */
export function RecordsPanel({
  isLoading, error, onRetry, isEmpty, filtered = false, emptyIcon, emptyTitle, emptyDescription, emptyAction,
  loadingLabel, minHeightClassName = 'min-h-[320px]', children, footer, className,
}: RecordsPanelProps) {
  let body: React.ReactNode
  if (isLoading) {
    body = <OrbLoader label={loadingLabel} className={minHeightClassName} />
  } else if (error && isEmpty) {
    body = <CommerceCardError message="The list could not be loaded." detail={error} onRetry={onRetry} className="py-10" />
  } else if (isEmpty) {
    body = (
      <EmptyState
        bare
        icon={filtered ? Search : emptyIcon}
        title={filtered ? 'No results' : emptyTitle}
        description={filtered ? 'No row matches the search or the selected filters.' : emptyDescription}
        action={filtered ? undefined : emptyAction}
      />
    )
  } else {
    body = (
      <>
        {error && (
          <CommerceCardError
            role="status"
            message="The list could not be refreshed; the rows shown may be out of date."
            detail={error}
            onRetry={onRetry}
            className="border-b border-rule"
          />
        )}
        {children}
        {footer}
      </>
    )
  }
  return <Card className={cn('@container/records gap-0 py-0', className)}>{body}</Card>
}

interface LoadMoreFooterProps {
  shown: number
  total: number | null
  hasMore: boolean
  isLoadingMore: boolean
  loadMoreError: string | null
  onLoadMore: () => void
}

/** "25 of 1,240" plus the next-page button; a failed page shows its error with the button as the retry. */
export function LoadMoreFooter({ shown, total, hasMore, isLoadingMore, loadMoreError, onLoadMore }: LoadMoreFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-5 py-3">
      <p className="text-[13px] text-muted-foreground tabular-nums" aria-live="polite">
        {typeof total === 'number' ? `${formatCount(shown)} of ${formatCount(total)}` : `${formatCount(shown)} shown`}
        {loadMoreError && <span className="ml-2 text-destructive">{loadMoreError}</span>}
      </p>
      {hasMore ? (
        <Button variant="outline" size="sm" onClick={onLoadMore} loading={isLoadingMore} loadingText="Loading…">
          <ChevronDown aria-hidden="true" />
          {loadMoreError ? 'Try again' : 'Load more'}
        </Button>
      ) : (
        shown > 0 && <span className="text-xs leading-4 text-muted-foreground">All rows are shown</span>
      )}
    </div>
  )
}

/** Filter pill helper for the Select triggers: an active filter reads in bold ink, like the calls toolbar. */
export function filterPillClass(active: boolean): string {
  return cn('max-w-full', active ? 'font-medium text-foreground' : 'text-foreground/85')
}
