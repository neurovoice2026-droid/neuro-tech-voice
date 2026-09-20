import {
  AE, AR, AT, AU, BE, BR, CA, CH, CL, CN, CO, CZ, DE, DK, EG, ES, FI, FR, GB, GR,
  HK, HU, IE, IL, IN, IT, JP, KR, LU, MA, MD, MX, NL, NO, NZ, PL, PT, RO, RU, SA,
  SE, SG, SK, TR, TW, UA, US, ZA,
} from 'country-flag-icons/string/3x2'
import { cn } from '@/lib/utils'

interface FlagIconProps {
  /** ISO 3166-1 alpha-2 country code, e.g. 'US', 'RO', 'ES' */
  country: string
  className?: string
}

// Real SVG flags instead of Unicode flag emoji - Windows has no glyphs for
// most regional-indicator flag emoji and falls back to showing the raw
// letters (e.g. a "US" flag literally renders as the text "US").
//
// Only the flags the app shows are bundled (agent languages, phone number
// countries, and the common accent countries of voices), as tiny SVG strings
// from per-file modules. Importing the whole set added ~250 KB of JavaScript
// to every page with a flag. Add a code here when a new country appears.
const FLAGS: Record<string, string> = {
  AE, AR, AT, AU, BE, BR, CA, CH, CL, CN, CO, CZ, DE, DK, EG, ES, FI, FR, GB, GR,
  HK, HU, IE, IL, IN, IT, JP, KR, LU, MA, MD, MX, NL, NO, NZ, PL, PT, RO, RU, SA,
  SE, SG, SK, TR, TW, UA, US, ZA,
}

const BASE = 'inline-block h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10'

export function FlagIcon({ country, className }: FlagIconProps) {
  const code = country.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return null

  const svg = FLAGS[code]
  if (!svg) {
    // A country without a bundled flag still gets a same-sized marker, so
    // lists keep their alignment. The label next to it names the country.
    return (
      <span
        aria-hidden="true"
        className={cn(
          BASE,
          'inline-flex items-center justify-center bg-muted text-[8px] font-semibold leading-none text-muted-foreground',
          className
        )}
      >
        {code}
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(BASE, '[&>svg]:block [&>svg]:h-full [&>svg]:w-full', className)}
      // Static strings shipped with country-flag-icons, never user input.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
