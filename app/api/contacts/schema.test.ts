import { describe, expect, it } from 'vitest'
import { contactFieldErrors, contactInputSchema } from './schema'

describe('contactInputSchema', () => {
  it('refuses premium-rate and special-rate numbers (toll fraud through transfers)', () => {
    for (const phone of ['+447011223344', '+40900123456', '+19005551234', '+18765551234', '+49900123456']) {
      const result = contactInputSchema.safeParse({ name: 'Dana', phone, transfer_enabled: true })
      expect(result.success, phone).toBe(false)
      if (!result.success) expect(contactFieldErrors(result.error).phone).toMatch(/Premium-rate/)
    }
    expect(contactInputSchema.safeParse({ name: 'Dana', phone: '+40712345678', transfer_enabled: true }).success).toBe(true)
  })

  it('normalises phone numbers typed with spaces or 00 and blanks optional fields', () => {
    const result = contactInputSchema.parse({
      name: '  Dana Popescu ',
      role: '   ',
      phone: '0040 712-345 678',
      email: '',
      transfer_enabled: true,
    })
    expect(result).toEqual({
      name: 'Dana Popescu',
      role: null,
      phone: '+40712345678',
      email: null,
      transfer_enabled: true,
      notify_sms: false,
      notify_email: false,
      is_on_call: false,
      conditions: null,
    })
  })

  it('rejects national numbers without a country code', () => {
    const result = contactInputSchema.safeParse({ name: 'Dana', phone: '0712 345 678' })
    expect(result.success).toBe(false)
    expect(contactFieldErrors(result.error!)).toHaveProperty('phone')
  })

  it('needs a phone or an email', () => {
    const result = contactInputSchema.safeParse({ name: 'Dana' })
    expect(result.success).toBe(false)
    expect(contactFieldErrors(result.error!).phone).toMatch(/phone number or an email/)
  })

  it('ties each channel to the detail it needs', () => {
    const noPhone = contactInputSchema.safeParse({
      name: 'Dana',
      email: 'dana@example.com',
      transfer_enabled: true,
      notify_sms: true,
    })
    expect(noPhone.success).toBe(false)
    const errors = contactFieldErrors(noPhone.error!)
    expect(errors.transfer_enabled).toBeDefined()
    expect(errors.notify_sms).toBeDefined()

    const noEmail = contactInputSchema.safeParse({ name: 'Dana', phone: '+40712345678', notify_email: true })
    expect(contactFieldErrors(noEmail.error!).notify_email).toBeDefined()

    expect(
      contactInputSchema.safeParse({
        name: 'Dana',
        phone: '+40712345678',
        email: 'dana@example.com',
        transfer_enabled: true,
        notify_sms: true,
        notify_email: true,
        is_on_call: true,
        conditions: 'Emergencies after 6 pm',
      }).success
    ).toBe(true)
  })

  it('validates email format and field lengths', () => {
    expect(contactInputSchema.safeParse({ name: 'Dana', email: 'not-an-email' }).success).toBe(false)
    expect(contactInputSchema.safeParse({ name: 'x'.repeat(81), email: 'a@b.co' }).success).toBe(false)
    expect(contactInputSchema.safeParse({ name: 'Dana', email: 'a@b.co', conditions: 'x'.repeat(501) }).success).toBe(false)
    expect(contactInputSchema.safeParse({ name: '   ', email: 'a@b.co' }).success).toBe(false)
  })

  it('rejects non-boolean switches instead of coercing them', () => {
    expect(contactInputSchema.safeParse({ name: 'Dana', phone: '+40712345678', transfer_enabled: 'yes' }).success).toBe(false)
  })
})
