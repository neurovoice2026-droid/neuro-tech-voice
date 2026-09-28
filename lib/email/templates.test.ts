import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  accountDeletedEmail,
  overageNoticeEmail,
  phoneNumberRefundEmail,
  trialMinutesUsedUpEmail,
  usageAlertEmail,
} from './templates'

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com')
  vi.stubEnv('NEXT_PUBLIC_APP_NAME', 'Neuro Tech Voice')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('usage emails', () => {
  it('80 % on a paid plan mentions the invoice line only when overage is invoiced automatically', () => {
    const base = { minutesUsed: 120, minutesLimit: 150, planName: 'Starter', overageRate: 0.25, periodEnd: '2026-10-03T14:00:00Z', timeZone: 'Europe/Bucharest' }
    const invoiced = usageAlertEmail({ ...base, overageInvoiced: true })
    expect(invoiced.subject).toBe('You’ve used 80% of your included minutes')
    expect(invoiced.html).toContain('$0.25/min')
    expect(invoiced.html).toContain('as their own line on your invoice')
    expect(invoiced.html).toContain('October 3, 2026')

    const manual = usageAlertEmail({ ...base, overageInvoiced: false })
    expect(manual.html).toContain('$0.25/min')
    expect(manual.html).not.toContain('own line')
  })

  it('80 % on the trial explains that calls pause at the limit', () => {
    const email = usageAlertEmail({ minutesUsed: 4, minutesLimit: 5, isTrial: true })
    expect(email.subject).toBe('You’ve used 80% of your trial minutes')
    expect(email.html).toContain('stops answering calls until you choose a plan')
  })

  it('100 % emails: trial pauses, paid plans continue', () => {
    expect(trialMinutesUsedUpEmail({ minutesUsed: 5, minutesLimit: 5 }).subject).toContain('calls are paused')
    const paid = overageNoticeEmail({ planName: 'Pro', minutesLimit: 850, overageRate: 0.25 })
    expect(paid.subject).toContain('calls continue')
    expect(paid.html).not.toContain('own line')
    expect(overageNoticeEmail({ planName: 'Pro', minutesLimit: 850, overageRate: 0.25, overageInvoiced: true }).html).toContain(
      'own line on your next invoice'
    )
  })
})

describe('phoneNumberRefundEmail', () => {
  it('confirms the refund amount and the cancellation', () => {
    const email = phoneNumberRefundEmail({ number: '+40312345678', amount: 1.15, currency: 'usd', refunded: true, cancelled: true })
    expect(email.subject).toContain('you’ve been refunded')
    expect(email.html).toContain('$1.15')
    expect(email.html).toContain('cancelled the subscription')
  })

  it('never claims a cancellation that failed', () => {
    const email = phoneNumberRefundEmail({ number: '+40312345678', amount: 1.15, currency: 'usd', refunded: true, cancelled: false })
    expect(email.html).not.toContain('cancelled the subscription')
    expect(email.html).toContain('stopping the subscription')
  })

  it('asks the customer to reply when the automatic refund failed', () => {
    const email = phoneNumberRefundEmail({ number: '+40312345678', amount: null, refunded: false, cancelled: true })
    expect(email.subject).toContain('refund on its way')
    expect(email.html).toContain('refund you by hand')
  })

  it('escapes the number in the body', () => {
    const email = phoneNumberRefundEmail({ number: '<b>x</b>', amount: 0, refunded: true })
    expect(email.html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(email.html).not.toContain('<b>x</b>')
  })
})

describe('accountDeletedEmail', () => {
  it('only lists what really happened and escapes the organization name', () => {
    const minimal = accountDeletedEmail({ organizationName: 'Acme <Dental>', deletedAt: '2026-09-17T10:00:00Z' })
    expect(minimal.html).toContain('Acme &lt;Dental&gt;')
    expect(minimal.html).not.toContain('released')
    expect(minimal.html).not.toContain('cancelled')

    const full = accountDeletedEmail({ numbersReleased: 2, subscriptionsCancelled: true })
    expect(full.html).toContain('Your 2 phone numbers have been released.')
    expect(full.html).toContain('subscriptions have been cancelled')
  })
})
