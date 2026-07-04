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

// width-ul controlează dimensiunea — height e auto ca să păstreze aspect ratio-ul corect
const sizeConfig = {
  xs: 52,
  sm: 80,
  md: 120,
  lg: 170,
}

export function Logo({ size = 'md', variant = 'default', className }: LogoProps) {
  const width = sizeConfig[size]

  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/logo.png"
        alt="NeuroVoice"
        width={500}
        height={380}
        style={{ width: `${width}px`, height: 'auto' }}
        className={cn(
          // Pe fundal mov închis (variant="white") logo-ul negru devine invizibil.
          // brightness-0 face totul negru, invert îl face alb — logo alb pe dark.
          variant === 'white' && 'brightness-0 invert'
        )}
        priority
      />
    </div>
  )
}
