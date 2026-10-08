'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** How long Retry shows its orb when the caller cannot report the request's own progress. */
const RETRY_FEEDBACK_MS = 1500

interface CardErrorProps {
  /** What failed, as a sentence ("Recent calls could not be loaded."). */
  message: React.ReactNode
  /** Optional detail under the message (e.g. the server's error text). */
  detail?: React.ReactNode
  onRetry?: () => void
  /** Retry in flight, when the caller knows it. Otherwise the button shows its orb briefly after a click. */
  retrying?: boolean
  /** 'alert' (default) or 'status' where the card announced its failure politely before. */
  role?: 'alert' | 'status'
  /** Padding / height of the region it replaces (default: a list row, px-5 py-4). */
  className?: string
}

/**
 * The dashboard's one card-level error: a muted row with a red icon, the
 * message and an outline Retry. Page-level failures keep the red Alert.
 */
export function CardError({ message, detail, onRetry, retrying, role = 'alert', className }: CardErrorProps) {
  const [clicked, setClicked] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function retry() {
    if (!onRetry) return
    setClicked(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setClicked(false), RETRY_FEEDBACK_MS)
    onRetry()
  }

  return (
    <div role={role} className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4', className)}>
      <div className="flex min-w-0 flex-1 basis-48 items-start gap-2 text-[13px] leading-[19px] text-muted-foreground">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-foreground">{message}</p>
          {detail && <p className="mt-0.5 text-xs leading-4 break-words">{detail}</p>}
        </div>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="xs"
          onClick={retry}
          loading={retrying ?? clicked}
          loadingText="Retrying…"
          className="tap-44 shrink-0"
        >
          <RotateCw aria-hidden="true" />
          Retry
        </Button>
      )}
    </div>
  )
}
