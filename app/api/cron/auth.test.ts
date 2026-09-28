import { describe, expect, it } from 'vitest'
import { checkCronAuthorization, MIN_CRON_SECRET_LENGTH } from './auth'

const SECRET = 'cron-secret-0123456789abcdef'

describe('checkCronAuthorization', () => {
  it('accepts the exact bearer token', () => {
    expect(checkCronAuthorization(`Bearer ${SECRET}`, SECRET)).toBe('ok')
  })

  it('accepts a lowercase scheme and surrounding whitespace', () => {
    expect(checkCronAuthorization(`bearer ${SECRET}`, SECRET)).toBe('ok')
    expect(checkCronAuthorization(`  Bearer ${SECRET}  `, SECRET)).toBe('ok')
    expect(checkCronAuthorization(`Bearer ${SECRET}`, `  ${SECRET}\n`)).toBe('ok')
  })

  it('rejects a wrong, partial, longer or missing token', () => {
    expect(checkCronAuthorization('Bearer wrong-secret-0123456789', SECRET)).toBe('unauthorized')
    expect(checkCronAuthorization(`Bearer ${SECRET.slice(0, -1)}`, SECRET)).toBe('unauthorized')
    expect(checkCronAuthorization(`Bearer ${SECRET}x`, SECRET)).toBe('unauthorized')
    expect(checkCronAuthorization(null, SECRET)).toBe('unauthorized')
    expect(checkCronAuthorization('', SECRET)).toBe('unauthorized')
  })

  it('rejects other schemes and malformed headers', () => {
    expect(checkCronAuthorization(SECRET, SECRET)).toBe('unauthorized')
    expect(checkCronAuthorization(`Basic ${SECRET}`, SECRET)).toBe('unauthorized')
    expect(checkCronAuthorization(`Bearer ${SECRET} extra`, SECRET)).toBe('unauthorized')
    expect(checkCronAuthorization('Bearer', SECRET)).toBe('unauthorized')
  })

  it('is not configured without a secret, or with a short one, whatever the header says', () => {
    expect(checkCronAuthorization(`Bearer ${SECRET}`, undefined)).toBe('not_configured')
    expect(checkCronAuthorization('Bearer ', '')).toBe('not_configured')
    const short = 'x'.repeat(MIN_CRON_SECRET_LENGTH - 1)
    expect(checkCronAuthorization(`Bearer ${short}`, short)).toBe('not_configured')
  })

  it('an empty bearer never matches an empty secret', () => {
    expect(checkCronAuthorization('Bearer ', '   ')).toBe('not_configured')
  })
})
