// E.164 helpers. Dependency-free and safe to import from client components
// (form validation, masked numbers in lists).

/** `+` then 7–15 digits, no leading zero. Same rule as the database CHECK constraints. */
export const E164_REGEX = /^\+[1-9]\d{6,14}$/

export function isE164(value: string): boolean {
  return typeof value === 'string' && E164_REGEX.test(value)
}

/**
 * Normalises a human-typed international number ("+40 712-345 678",
 * "0040 (712) 345678") to E.164. National formats without a country prefix are
 * rejected rather than guessed: we can't know which country the caller meant.
 */
export function normalizeE164(raw: string): string | null {
  if (typeof raw !== 'string') return null
  let value = raw.trim().replace(/[\s\-().]/g, '')
  if (value.startsWith('00')) value = `+${value.slice(2)}`
  if (!value.startsWith('+')) return null
  return isE164(value) ? value : null
}

// ITU-T E.164 calling codes are prefix-free: 1 and 7 are one digit, this set
// is two digits, and everything else is three digits.
const TWO_DIGIT_COUNTRY_CODES = new Set([
  '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45',
  '46', '47', '48', '49', '51', '52', '53', '54', '55', '56', '57', '58', '60', '61',
  '62', '63', '64', '65', '66', '81', '82', '84', '86', '90', '91', '92', '93', '94',
  '95', '98',
])

export function countryCallingCode(e164: string): string | null {
  if (!isE164(e164)) return null
  const digits = e164.slice(1)
  if (digits[0] === '1' || digits[0] === '7') return digits[0]
  const two = digits.slice(0, 2)
  return TWO_DIGIT_COUNTRY_CODES.has(two) ? two : digits.slice(0, 3)
}

/**
 * Masks a number for logs and lists: "+40712345123" → "+40 7** *** 123".
 * Keeps the country code, the first national digit and the last three digits.
 */
export function maskPhone(e164: string): string {
  const cc = countryCallingCode(e164)
  if (!cc) {
    // Not E.164: never echo it back, only its tail.
    const digits = typeof e164 === 'string' ? e164.replace(/\D/g, '') : ''
    return digits.length >= 6 ? `***${digits.slice(-3)}` : '***'
  }
  const national = e164.slice(1 + cc.length)
  if (national.length <= 4) return `+${cc} ${'*'.repeat(national.length - 2)}${national.slice(-2)}`
  const masked = national[0] + '*'.repeat(national.length - 4) + national.slice(-3)
  // Group in threes from the right so the visible tail stays together.
  const groups: string[] = []
  for (let end = masked.length; end > 0; end -= 3) {
    groups.unshift(masked.slice(Math.max(0, end - 3), end))
  }
  return `+${cc} ${groups.join(' ')}`
}
