import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** @deprecated Ignored — the wordmark is the logo. */
  showText?: boolean
  /** 'white' for dark surfaces (.app-cover). */
  variant?: 'default' | 'white'
  className?: string
}

const SIZE_CLASS = {
  xs: 'text-[15px]',
  sm: 'text-[17px]',
  md: 'text-[20px]',
  lg: 'text-[26px]',
} as const

/**
 * The text wordmark NEUROVOICE, set like the site header's (Inter Tight 500,
 * tracking −0.07em). Renders a <span>; callers that wrap it in a link add
 * aria-label="NeuroVoice home". The visible caps are hidden from screen readers,
 * which read the name instead (as the old image's alt text did).
 */
export function Logo({ size = 'md', variant = 'default', className }: LogoProps) {
  return (
    <span
      data-slot="logo"
      className={cn(
        'inline-flex items-center font-medium leading-none tracking-[-0.07em] whitespace-nowrap select-none [font-family:var(--font-display),var(--font-header),ui-sans-serif,system-ui,sans-serif]',
        SIZE_CLASS[size],
        variant === 'white' ? 'text-white' : 'text-foreground',
        className
      )}
    >
      <span aria-hidden>NEUROVOICE</span>
      <span className="sr-only">NeuroVoice</span>
    </span>
  )
}
