import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { StatusChip } from '@/components/shared/StatusChip'

interface StatBadgeProps {
  value: number   // positive = up, negative = down, 0 = neutral
  suffix?: string
  className?: string
}

/** Trend chip: up = success, down = danger, flat = muted; the arrow icon carries the direction too. */
export function StatBadge({ value, suffix = '%', className }: StatBadgeProps) {
  const isUp = value > 0
  const isDown = value < 0
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus

  return (
    <StatusChip
      tone={isUp ? 'success' : isDown ? 'danger' : 'muted'}
      icon={<Icon aria-hidden />}
      className={className}
    >
      <span className="tabular-nums">
        {isUp ? '+' : ''}{value}{suffix}
      </span>
    </StatusChip>
  )
}
