import { Badge } from '@/components/ui/badge'
import { LiveDot, type LiveDotTone } from '@/components/shared/LiveDot'
import { cn } from '@/lib/utils'

export type StatusTone =
  | 'neutral'
  | 'muted'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline'

const TONE_TO_VARIANT = {
  neutral: 'secondary',
  muted: 'muted',
  brand: 'brand',
  success: 'success',
  warning: 'warning',
  danger: 'destructive',
  info: 'info',
  outline: 'outline',
} as const

const TONE_TO_LIVE: Record<StatusTone, LiveDotTone> = {
  neutral: 'current',
  muted: 'current',
  brand: 'current',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  outline: 'current',
}

interface StatusChipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  tone: StatusTone
  /** Small static dot in the chip's text colour before the label. */
  dot?: boolean
  /** Pinging live dot (calls in progress, ringing) instead of the static dot. */
  live?: boolean
  /** Leading icon element, e.g. <Check /> or <OrbInline state="connecting" />. */
  icon?: React.ReactNode
  children: React.ReactNode
}

/** Soft status chip: tone + dot/icon + text (status is never colour alone). */
export function StatusChip({ tone, dot, live, icon, children, className, ...props }: StatusChipProps) {
  return (
    <Badge variant={TONE_TO_VARIANT[tone]} data-tone={tone} className={cn(icon ? 'has-data-[slot=orb-inline]:pl-1' : null, className)} {...props}>
      {live ? (
        <LiveDot tone={TONE_TO_LIVE[tone]} className="size-1.5" />
      ) : dot ? (
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      ) : null}
      {icon}
      {children}
    </Badge>
  )
}
