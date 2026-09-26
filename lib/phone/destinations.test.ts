import { describe, expect, it } from 'vitest'
import { destinationRefusal, destinationRefusalMessage, isPremiumRateNumber, parseCallingCodes } from './destinations'

describe('call destination policy', () => {
  it('allows ordinary numbers in the org number’s country and in low-risk countries', () => {
    expect(destinationRefusal('+40712345678', { fromNumber: '+40312345678' })).toBeNull()
    expect(destinationRefusal('+447911123456', { fromNumber: '+14155550123' })).toBeNull()
    expect(destinationRefusal('+14155550199', { fromNumber: '+447911123456' })).toBeNull()
    // A country outside the default list is fine when the business's own number is there.
    expect(destinationRefusal('+27821234567', { fromNumber: '+27211234567' })).toBeNull()
  })

  it('refuses premium-rate, shared-cost and Caribbean NANP numbers whatever the country list says', () => {
    for (const number of ['+19005550123', '+18095551234', '+18765551234', '+447011223344', '+448712345678', '+40900123456', '+33899123456', '+4990012345678', '+61190012345']) {
      expect(isPremiumRateNumber(number), number).toBe(true)
      expect(destinationRefusal(number, { fromNumber: number.startsWith('+1') ? '+14155550123' : '+447911123456' }), number).toBe('premium_rate')
    }
    // Ordinary mobiles and landlines around those ranges.
    for (const number of ['+14155550123', '+16475550123', '+447911123456', '+40712345678', '+33612345678', '+4915112345678', '+61412345678']) {
      expect(isPremiumRateNumber(number), number).toBe(false)
    }
  })

  it('refuses high-risk and satellite destinations unless the operator allows the country', () => {
    expect(destinationRefusal('+37120000000', { fromNumber: '+40312345678' })).toBe('country_not_allowed')
    expect(destinationRefusal('+881612345678', { fromNumber: '+40312345678' })).toBe('country_not_allowed')
    expect(destinationRefusal('+5358123456', { fromNumber: '+14155550123' })).toBe('country_not_allowed')
    expect(destinationRefusal('+37120000000', { fromNumber: '+40312345678', extraCallingCodes: parseCallingCodes('371, +370') })).toBeNull()
    expect(destinationRefusal('not a number')).toBe('invalid_number')
  })

  it('parses the operator list and words every refusal for owners', () => {
    expect(parseCallingCodes(' 371,+370, abc, 0, 1234 ,44')).toEqual(['371', '370', '44'])
    expect(parseCallingCodes(undefined)).toEqual([])
    expect(destinationRefusalMessage('premium_rate')).toMatch(/Premium-rate/)
    expect(destinationRefusalMessage('country_not_allowed')).toMatch(/country/)
    expect(destinationRefusalMessage('invalid_number')).toMatch(/international format/)
  })
})
