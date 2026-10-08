import { CornerDot } from '@/components/site/corner-dot'
import { cn } from '@/lib/utils'

interface EyebrowProps {
  children: React.ReactNode
  className?: string
  /** 'brand' (violet) on white; 'cover' (lilac) on the dark .app-cover surface. */
  tone?: 'brand' | 'cover'
}

/** Uppercase tracked section opener with the site's corner-dot mark (purple policy #1). */
export function Eyebrow({ children, className, tone = 'brand' }: EyebrowProps) {
  return (
    <p
      data-slot="eyebrow"
      className={cn(
        'flex items-center gap-2 text-[11px] leading-4 font-medium tracking-[0.14em] uppercase',
        tone === 'cover' ? 'text-[#c0ace0]' : 'text-brand',
        className
      )}
    >
      <CornerDot className="size-2.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  )
}
