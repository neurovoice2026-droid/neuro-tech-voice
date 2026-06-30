import { cn } from '@/lib/utils'

interface LiveDotProps {
  active?: boolean
  className?: string
}

export function LiveDot({ active = true, className }: LiveDotProps) {
  return (
    <span className={cn('relative flex h-2.5 w-2.5', className)}>
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      )}
      <span
        className={cn(
          'relative inline-flex rounded-full h-2.5 w-2.5',
          active ? 'bg-green-500' : 'bg-gray-300'
        )}
      />
    </span>
  )
}
