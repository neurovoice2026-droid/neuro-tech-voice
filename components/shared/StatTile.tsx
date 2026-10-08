import { isValidElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import { OrbInline } from '@/components/shared/OrbLoader'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface StatTileProps {
  /** Plain-text label; also used for the loading announcement ("Loading Calls today"). */
  label: string
  value: React.ReactNode
  /** Line under the value (comparison, unit, a StatBadge). */
  hint?: React.ReactNode
  /** Muted 16 px icon at the right of the label: a lucide component or an element (e.g. <Sparkles className="text-brand" />, <LiveDot />). */
  icon?: LucideIcon | React.ReactElement
  /** Shows a 20 px breathing orb in place of the value, keeping the value's line height. */
  loading?: boolean
  /** Usage meter under the value. tone: ≥ 80 % warning, ≥ 100 % danger. */
  meter?: { value: number; tone?: 'default' | 'warning' | 'danger'; label: string }
  size?: 'default' | 'sm'
  className?: string
}

/** Tinted metric tile: label row, tabular value (or orb while loading), hint and optional meter. */
export function StatTile({ label, value, hint, icon, loading, meter, size = 'default', className }: StatTileProps) {
  const sm = size === 'sm'
  let iconNode: React.ReactNode = null
  if (isValidElement(icon)) {
    iconNode = icon
  } else if (icon) {
    const Icon = icon
    iconNode = <Icon aria-hidden />
  }
  return (
    <div
      data-slot="stat-tile"
      data-size={size}
      className={cn('min-w-0 rounded-2xl bg-secondary', sm ? 'p-4' : 'p-5', className)}
    >
      <div className="flex items-center justify-between gap-2 text-[13px] leading-[18px] text-muted-foreground">
        <span className="min-w-0 truncate">{label}</span>
        {iconNode && (
          <span className="flex shrink-0 items-center text-muted-foreground [&>svg]:size-4">{iconNode}</span>
        )}
      </div>
      <div
        className={cn(
          'mt-2 flex items-center font-semibold tabular-nums',
          sm ? 'min-h-7 text-[22px] leading-7 tracking-[-0.02em]' : 'min-h-8 text-[28px] leading-8 tracking-[-0.02em]'
        )}
      >
        {loading ? <OrbInline state="breathing" label={`Loading ${label}`} /> : value}
      </div>
      {hint && <div className="mt-1 text-xs leading-4 text-muted-foreground">{hint}</div>}
      {meter && (
        <Progress
          value={loading ? 0 : Math.min(100, Math.max(0, meter.value))}
          tone={meter.tone}
          surface="tinted"
          aria-label={meter.label}
          className="mt-3"
        />
      )}
    </div>
  )
}
