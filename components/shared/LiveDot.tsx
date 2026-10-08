import { cn } from '@/lib/utils'

export type LiveDotTone = 'success' | 'warning' | 'danger' | 'info' | 'idle' | 'current'

interface LiveDotProps {
  /** Pinging ring on (live). Inactive dots default to the idle grey. */
  active?: boolean
  /** Dot colour; defaults to success when active, idle when not. 'current' follows the text colour. */
  tone?: LiveDotTone
  /** On the dark .app-cover surface (success becomes the cover's mint). */
  onDark?: boolean
  className?: string
}

const TONE_BG: Record<LiveDotTone, string> = {
  success: 'bg-success-dot',
  warning: 'bg-warning-dot',
  danger: 'bg-destructive',
  info: 'bg-info',
  idle: 'bg-[#a19dac]',
  current: 'bg-current',
}

/** 8 px status dot; active dots get a ping ring (hidden under reduced motion). Decorative: pair it with text. */
export function LiveDot({ active = true, tone, onDark = false, className }: LiveDotProps) {
  const resolved: LiveDotTone = tone ?? (active ? 'success' : 'idle')
  const bg = onDark && resolved === 'success' ? 'bg-[#93d3ae]' : TONE_BG[resolved]
  return (
    <span aria-hidden data-slot="live-dot" className={cn('relative inline-flex size-2 shrink-0', className)}>
      {active && resolved !== 'idle' && (
        <span className={cn('absolute inset-0 animate-ping rounded-full opacity-50 motion-reduce:hidden', bg)} />
      )}
      <span className={cn('relative inline-flex size-full rounded-full', bg)} />
    </span>
  )
}
