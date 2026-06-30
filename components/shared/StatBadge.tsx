import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatBadgeProps {
  value: number   // positive = up, negative = down, 0 = neutral
  suffix?: string
  className?: string
}

export function StatBadge({ value, suffix = '%', className }: StatBadgeProps) {
  const isUp = value > 0
  const isDown = value < 0

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
        isUp && 'bg-green-50 text-green-700',
        isDown && 'bg-red-50 text-red-700',
        !isUp && !isDown && 'bg-gray-100 text-gray-600',
        className
      )}
    >
      {isUp && <TrendingUp className="h-3 w-3" />}
      {isDown && <TrendingDown className="h-3 w-3" />}
      {!isUp && !isDown && <Minus className="h-3 w-3" />}
      {isUp ? '+' : ''}{value}{suffix}
    </span>
  )
}
