'use client'

import { Loader2, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { playPreview, usePreviewState } from './preview-player'

interface AudioPreviewButtonProps {
  /** Identifies the audio; the same key toggles play/stop. */
  previewKey: string
  load: (signal: AbortSignal) => Promise<Blob>
  /** What is being previewed, for screen readers ("Skylar"). */
  label: string
  /** Visible text next to the icon; icon-only when omitted. */
  text?: string
  size?: 'sm' | 'default'
  variant?: 'outline' | 'ghost' | 'secondary'
  disabled?: boolean
  className?: string
}

/** Play/stop control wired to the page-wide preview player. */
export function AudioPreviewButton({
  previewKey,
  load,
  label,
  text,
  size = 'sm',
  variant = 'outline',
  disabled,
  className,
}: AudioPreviewButtonProps) {
  const preview = usePreviewState()
  const active = preview.key === previewKey
  const loading = active && preview.status === 'loading'
  const playing = active && preview.status === 'playing'

  const Icon = loading ? Loader2 : playing ? Square : Play
  const action = playing || loading ? 'Stop preview' : 'Play preview'

  return (
    <Button
      type="button"
      variant={variant}
      size={text ? size : size === 'sm' ? 'icon-sm' : 'icon'}
      disabled={disabled}
      aria-label={`${action} of ${label}`}
      aria-pressed={playing}
      onClick={(event) => {
        event.stopPropagation()
        void playPreview(previewKey, load)
      }}
      // Icon-only on phones: a slightly larger invisible hit area around the 28 px button.
      className={cn(!text && 'relative after:absolute after:-inset-1', playing && 'border-primary/40 bg-primary/5 text-primary', className)}
    >
      <Icon className={cn(loading && 'animate-spin', playing && 'fill-current')} aria-hidden="true" />
      {text && <span>{loading ? 'Loading…' : playing ? 'Stop' : text}</span>}
    </Button>
  )
}
