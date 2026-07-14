import * as Flags from 'country-flag-icons/react/3x2'
import { cn } from '@/lib/utils'

type FlagComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>

interface FlagIconProps {
  /** ISO 3166-1 alpha-2 country code, e.g. 'US', 'RO', 'ES' */
  country: string
  className?: string
}

// Real SVG flags instead of Unicode flag emoji - Windows has no glyphs for
// most regional-indicator flag emoji and falls back to showing the raw
// letters (e.g. a "US" flag literally renders as the text "US").
export function FlagIcon({ country, className }: FlagIconProps) {
  const Flag = (Flags as unknown as Record<string, FlagComponent>)[country.toUpperCase()]
  if (!Flag) return null

  return (
    <Flag
      className={cn('h-3.5 w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10', className)}
    />
  )
}
