// Countries offered for instant number purchase. Client-safe (the Phone page
// renders the list; /api/phone/search and /api/phone/checkout validate
// against it). These typically have local numbers with no address or
// regulatory bundle requirement; the search route still keeps only numbers
// whose address_requirements is "none", so a country here never guarantees a
// result. Romania is left out on purpose: its numbers need a regulatory bundle.
// `code` is ISO 3166-1 alpha-2, reused for <FlagIcon />.

export interface PhoneCountry {
  code: string
  label: string
}

export const PHONE_NUMBER_COUNTRIES: readonly PhoneCountry[] = [
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'AT', label: 'Austria' },
  { code: 'BE', label: 'Belgium' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'CZ', label: 'Czechia' },
  { code: 'DK', label: 'Denmark' },
  { code: 'FI', label: 'Finland' },
  { code: 'HU', label: 'Hungary' },
  { code: 'LU', label: 'Luxembourg' },
  { code: 'NO', label: 'Norway' },
  { code: 'PT', label: 'Portugal' },
  { code: 'SE', label: 'Sweden' },
  { code: 'SK', label: 'Slovakia' },
  { code: 'SG', label: 'Singapore' },
  { code: 'JP', label: 'Japan' },
  { code: 'IN', label: 'India' },
  { code: 'BR', label: 'Brazil' },
  { code: 'ZA', label: 'South Africa' },
] as const

export const PHONE_COUNTRY_CODES: readonly string[] = PHONE_NUMBER_COUNTRIES.map((c) => c.code)

export function isPhoneCountry(code: string): boolean {
  return PHONE_COUNTRY_CODES.includes(code)
}
