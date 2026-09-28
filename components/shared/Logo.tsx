import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** @deprecated — logo.png already includes the brand name */
  showText?: boolean
  /** 'white' inverts the logo for dark backgrounds */
  variant?: 'default' | 'white'
  className?: string
}

// public/logo.png is 600×430 (crown over the wordmark), at least 3× the
// largest size below. Passing the rendered size as width/height lets
// next/image serve a 1x/2x pair of small files instead of the full image, and
// reserves the right box before it loads (no layout shift).
const LOGO_WIDTH = 600
const LOGO_HEIGHT = 430

const sizeConfig = {
  xs: 52,
  sm: 80,
  md: 120,
  lg: 170,
}

export function Logo({ size = 'md', variant = 'default', className }: LogoProps) {
  const width = sizeConfig[size]
  const height = Math.round((width * LOGO_HEIGHT) / LOGO_WIDTH)

  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/logo.png"
        alt="Neuro Tech Voice"
        width={width}
        height={height}
        // Always above the fold wherever it appears, but never the page's
        // largest paint, so eager loading beats a <head> preload.
        loading="eager"
        className={cn(
          // On a dark purple background (variant="white") the dark logo would
          // disappear: brightness-0 turns it black, invert turns that white.
          variant === 'white' && 'brightness-0 invert'
        )}
      />
    </div>
  )
}
