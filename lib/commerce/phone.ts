// Phone numbers as stores return them ("0722 123 456", "+40 722 123 456",
// "0040722123456", "722123456" with a country) normalized to E.164 for the
// dialer. Client-safe and pure. Only numbers that normalize are ever called.

import { normalizeE164 } from '@/lib/phone/e164'

/** ISO 3166-1 alpha-2 → calling code, for the countries the product serves plus common EU neighbours. */
const COUNTRY_CALLING_CODES: Record<string, string> = {
  RO: '40', MD: '373', HU: '36', BG: '359', DE: '49', AT: '43', IT: '39', ES: '34', FR: '33', GB: '44', IE: '353',
  NL: '31', BE: '32', PL: '48', CZ: '420', SK: '421', GR: '30', PT: '351', SE: '46', DK: '45', NO: '47', FI: '358',
  CH: '41', US: '1', CA: '1', TR: '90', RS: '381', HR: '385', SI: '386', UA: '380', LT: '370', LV: '371', EE: '372',
}

export function callingCodeOf(countryCode: string | null | undefined): string | null {
  const cc = (countryCode ?? '').trim().toUpperCase()
  return cc && Object.hasOwn(COUNTRY_CALLING_CODES, cc) ? COUNTRY_CALLING_CODES[cc] : null
}

/**
 * E.164 of a store phone number, or null. `countryCode` (the order's shipping
 * or billing country, else the store's) resolves national formats: a leading
 * 0 is a trunk prefix in every listed country except US/CA.
 */
export function normalizeStorePhone(raw: string | null | undefined, countryCode: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  let value = raw.trim()
  if (!value) return null
  // Extensions and labels ("ext. 12", "mobil:") never belong to the number.
  value = value.replace(/\s*(ext\.?|x|#).*$/i, '').replace(/^[a-z\s:.-]+(?=[+\d(])/i, '')
  const direct = normalizeE164(value)
  if (direct) return direct
  const digits = value.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return normalizeE164(digits)
  if (digits.startsWith('00')) return normalizeE164(`+${digits.slice(2)}`)
  const cc = callingCodeOf(countryCode)
  if (!cc) return null
  const national = cc === '1' ? digits.replace(/^1/, '') : digits.replace(/^0/, '')
  if (!/^\d{6,12}$/.test(national)) return null
  return normalizeE164(`+${cc}${national}`)
}
