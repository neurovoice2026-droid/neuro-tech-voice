// Where the platform may place calls it pays for: outbound calls, test calls
// to the owner's phone, live transfers and the on-call fallback. Twilio bills
// every one of those legs to the platform account, so a destination must be
// an ordinary number in a low-risk country, never a premium-rate, shared-cost
// or satellite range that toll fraud profits from.
//
// Allowed: the country of the organisation's own number (the one shown as
// caller id), the low-risk countries below, and any extra calling codes the
// operator lists in CALL_DESTINATION_COUNTRY_CODES. Blocked everywhere: the
// premium and special-rate prefixes below, and NANP numbers outside the US
// and Canada (Caribbean "one ring" ranges). Twilio's account-level Voice
// Geographic Permissions stay the backstop (docs/voice-platform.md).
//
// Dependency-free and client-safe: the contacts form shows the same refusal.

import { countryCallingCode, isE164 } from './e164'

export type DestinationRefusal = 'invalid_number' | 'premium_rate' | 'country_not_allowed'

/**
 * EU/EEA, the UK, Switzerland, US/Canada, Australia, New Zealand, Singapore
 * and Japan. Latvia and Lithuania are left out on purpose (common targets of
 * international revenue-share fraud); add them through the environment if a
 * customer needs them.
 */
export const DEFAULT_ALLOWED_CALLING_CODES: readonly string[] = [
  '1', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49',
  '61', '64', '65', '81',
  '351', '352', '353', '354', '356', '357', '358', '359', '372', '385', '386', '420', '421', '423',
]

/**
 * National-number prefixes (after the calling code) of premium-rate,
 * shared-cost, personal-numbering and directory ranges, per calling code.
 */
const BLOCKED_PREFIXES: Record<string, readonly string[]> = {
  '1': ['900', '976'],
  '30': ['90'],
  '31': ['84', '87', '90'],
  '32': ['70', '78', '90'],
  '33': ['81', '82', '83', '84', '85', '86', '87', '88', '89'],
  '34': ['803', '806', '807', '901', '902', '905'],
  '36': ['90', '91'],
  '39': ['12', '144', '16', '89'],
  '40': ['801', '802', '87', '9'],
  '41': ['90'],
  '43': ['90', '93'],
  '44': ['118', '70', '84', '87', '9'],
  '45': ['90'],
  '46': ['900', '939', '944'],
  '47': ['82'],
  '48': ['70'],
  '49': ['118', '137', '138', '180', '900'],
  '61': ['19'],
  '64': ['900'],
  '65': ['1900'],
  '81': ['990'],
  '351': ['6', '76'],
  '352': ['90'],
  '353': ['15'],
  '358': ['600', '700'],
  '420': ['90'],
  '421': ['900'],
  '27': ['86'],
  '55': ['300', '500', '900'],
  '91': ['1900'],
}

/** NANP area codes that are separate countries (not the US or Canada). */
const NANP_FOREIGN_AREA_CODES = new Set([
  '242', '246', '264', '268', '284', '345', '441', '473', '649', '658', '664', '721', '758', '767', '784',
  '809', '829', '849', '868', '869', '876',
])

export interface DestinationPolicyOptions {
  /** E.164 number the call is placed from (the organisation's own number), if known. */
  fromNumber?: string | null
  /** Extra calling codes allowed by the operator (digits, e.g. "371"). */
  extraCallingCodes?: readonly string[]
}

/** Parses "371, 370,+90" into calling codes; anything that isn't 1–3 digits is ignored. */
export function parseCallingCodes(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((code) => code.trim().replace(/^\+/, ''))
    .filter((code) => /^[1-9]\d{0,2}$/.test(code))
}

/** Premium-rate, shared-cost or foreign-NANP numbers: never called, whatever the country list says. */
export function isPremiumRateNumber(e164: string): boolean {
  const code = countryCallingCode(e164)
  if (!code) return false
  const national = e164.slice(1 + code.length)
  if (code === '1' && NANP_FOREIGN_AREA_CODES.has(national.slice(0, 3))) return true
  return (BLOCKED_PREFIXES[code] ?? []).some((prefix) => national.startsWith(prefix))
}

/** Why the platform won't call this number, or null when it may. */
export function destinationRefusal(to: string, options: DestinationPolicyOptions = {}): DestinationRefusal | null {
  if (!isE164(to)) return 'invalid_number'
  if (isPremiumRateNumber(to)) return 'premium_rate'
  const code = countryCallingCode(to)!
  const fromCode = options.fromNumber && isE164(options.fromNumber) ? countryCallingCode(options.fromNumber) : null
  if (code === fromCode) return null
  if (DEFAULT_ALLOWED_CALLING_CODES.includes(code)) return null
  if ((options.extraCallingCodes ?? []).includes(code)) return null
  return 'country_not_allowed'
}

/** What to tell an owner whose number was refused. */
export function destinationRefusalMessage(refusal: DestinationRefusal): string {
  switch (refusal) {
    case 'invalid_number':
      return 'Enter the number in international format, starting with + and the country code.'
    case 'premium_rate':
      return 'Premium-rate and special-rate numbers can’t be called. Please use a regular mobile or landline number.'
    case 'country_not_allowed':
      return 'Calls to this country aren’t enabled for your account. Contact support if you need them.'
  }
}
