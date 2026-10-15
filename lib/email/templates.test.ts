import { describe, expect, it } from 'vitest'
import { AUTH } from '@/lib/site'
import { autoTopUpFailedEmail, minutesExhaustedEmail, paymentSuccessEmail, usageAlertEmail } from './templates'

// The minute e-mails of the hard-cap model: no overage billing anywhere,
// calls pause when the minutes run out, extra minutes are bought on the
// billing page (#minutes) or added by auto top-up.

/** Visible text: inline tags dropped, block tags turned into spaces. */
const text = (html: string) => html.replace(/<\/?strong>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('usageAlertEmail (80% of the included minutes)', () => {
  it('tells a paid plan that calls pause at zero and links "Buy minutes" to the billing page', () => {
    const mail = usageAlertEmail({ minutesUsed: 680, minutesLimit: 850, planName: 'Pro', extraBalance: 0, canBuy: true, autoTopUpEnabled: false })
    expect(mail.subject).toBe('You’ve used 80% of your included minutes')
    const body = text(mail.html)
    expect(body).toContain('You’ve used 680 of 850 included minutes (80%) on the Pro plan this billing period.')
    expect(body).toContain('stops taking new calls until you add minutes or your included minutes reset next month.')
    expect(body).toContain('buy extra minutes or turn on auto top-up')
    expect(mail.html).toMatch(/href="[^"]*\/billing#minutes"[^>]*>Buy minutes</)
    expect(body.toLowerCase()).not.toContain('overage')
  })

  it('mentions the extra balance and an active auto top-up', () => {
    const mail = usageAlertEmail({ minutesUsed: 1400, minutesLimit: 1750, extraBalance: 500, canBuy: true, autoTopUpEnabled: true })
    const body = text(mail.html)
    expect(body).toContain('You also have 500 extra minutes')
    expect(body).toContain('Auto top-up is on')
    // It can fail (then it turns itself off): no promise that calls never pause.
    expect(body).toContain('as long as the charge to your card goes through')
    expect(body).not.toContain('before you run out')
    expect(body).not.toContain('turn on auto top-up from the billing page')
  })

  it('on the trial points to the plans instead of a pack it cannot buy', () => {
    const mail = usageAlertEmail({ minutesUsed: 4, minutesLimit: 5, planName: 'Trial', canBuy: false })
    expect(text(mail.html)).toContain('Choose a paid plan')
    // The trial's five minutes never reset: no "next month" for it.
    expect(text(mail.html)).toContain('stops taking new calls until you choose a paid plan.')
    expect(text(mail.html)).not.toContain('reset')
    expect(mail.html).toContain('>Choose a plan<')
    expect(mail.html).not.toContain('#minutes')
  })
})

describe('minutesExhaustedEmail', () => {
  /** Every link of the e-mail: [href, visible label]. */
  const links = (html: string) => [...html.matchAll(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[2]])

  it('says calls are paused and offers the next plan or 100 minutes on a paid plan', () => {
    const mail = minutesExhaustedEmail({ plan: 'pro', businessType: 'services' })
    expect(mail.subject).toBe('You’re out of minutes: calls are paused')
    const body = text(mail.html)
    expect(body).toContain('on the Pro plan')
    expect(body).toContain('isn’t taking new calls')
    expect(body).toContain('Choose how to resume calls:')
    expect(body).toContain('Upgrading to Business resumes calls as soon as the new plan is active and gives you 5,000 included minutes every month.')
    expect(body).toContain('Extra minutes never expire')
    expect(body).toContain('included minutes, which reset every month (on annual billing too).')
    expect(body).toContain('auto top-up')
    const all = links(mail.html)
    expect(all).toContainEqual([expect.stringMatching(/^https?:\/\/[^/]+\/billing#plans$/), 'Upgrade to Business (5,000 minutes for $499/mo)'])
    expect(all).toContainEqual([expect.stringMatching(/^https?:\/\/[^/]+\/billing\?buy=100#minutes$/), 'Buy 100 minutes for $20'])
    // The upgrade comes first, the pack second.
    expect(mail.html.indexOf('Upgrade to Business')).toBeLessThan(mail.html.indexOf('Buy 100 minutes'))
    expect(body.toLowerCase()).not.toContain('overage')
  })

  it('mentions scheduled store calls only to a store, with the real 24-hour wait', () => {
    const service = text(minutesExhaustedEmail({ plan: 'starter', businessType: 'services' }).html)
    expect(service).toContain('so calls are paused: it isn’t taking new calls right now.')
    expect(service).not.toContain('store calls')

    const legacy = text(minutesExhaustedEmail({ plan: 'pro' }).html)
    expect(legacy).not.toContain('store calls')

    const store = text(minutesExhaustedEmail({ plan: 'store_starter', businessType: 'ecommerce' }).html)
    expect(store).toContain('it isn’t taking new calls right now. Scheduled store calls wait up to 24 hours for minutes, then are skipped.')
    expect(store).not.toContain('wait until minutes are added')
  })

  it('prices a store from its own ladder and extra-minute rate', () => {
    const mail = minutesExhaustedEmail({ plan: 'store_growth', businessType: 'ecommerce' })
    expect(text(mail.html)).toContain('on the Store Growth plan')
    const all = links(mail.html)
    expect(all).toContainEqual([expect.stringMatching(/\/billing#plans$/), 'Upgrade to Store Scale (2,000 minutes for $500/mo)'])
    expect(all).toContainEqual([expect.stringMatching(/\/billing\?buy=100#minutes$/), 'Buy 100 minutes for $22'])
  })

  it('offers "Talk to us" when the next rung is sales-led', () => {
    const mail = minutesExhaustedEmail({ plan: 'scale' })
    const all = links(mail.html)
    expect(all).toContainEqual([AUTH.contactSales, 'Talk to us'])
    expect(all).toContainEqual([expect.stringMatching(/\/billing\?buy=100#minutes$/), 'Buy 100 minutes for $20'])
    // The tel: button does nothing in a desktop mail client: the number is printed too.
    expect(text(mail.html)).toContain('Talk to us about a plan with a larger allowance: call +40 774 566 367.')
    expect(mail.html).not.toContain('#plans')
  })

  it('sends a trial to its family’s first plan, with no pack to buy', () => {
    const services = minutesExhaustedEmail({ plan: 'trial', businessType: 'services' })
    expect(links(services.html)).toEqual(
      expect.arrayContaining([[expect.stringMatching(/\/billing#plans$/), 'Upgrade to Starter (400 minutes for $49/mo)']]),
    )
    expect(services.html).not.toContain('buy=')
    expect(services.html).not.toContain('#minutes')
    expect(text(services.html)).not.toContain('Extra minutes never expire')

    const store = minutesExhaustedEmail({ plan: 'trial', businessType: 'ecommerce' })
    expect(links(store.html)).toEqual(
      expect.arrayContaining([[expect.stringMatching(/\/billing#plans$/), 'Upgrade to Store Starter (350 minutes for $100/mo)']]),
    )
  })

  it('falls back to the generic button for a value that names no plan', () => {
    const mail = minutesExhaustedEmail({ plan: 'gold' })
    expect(mail.html).toContain('>Choose a plan<')
    expect(mail.html).not.toContain('buy=')
  })
})

describe('autoTopUpFailedEmail', () => {
  it('names the charge, the reason, and that auto top-up is now off', () => {
    const mail = autoTopUpFailedEmail({ minutes: 500, amount: 115, currency: 'usd', reason: 'Your card was declined.' })
    expect(mail.subject).toBe('Action needed: auto top-up failed')
    const body = text(mail.html)
    expect(body).toContain('We tried to charge 115.00 USD for 500 extra minutes, but the payment didn’t go through: Your card was declined.')
    expect(body).toContain('Auto top-up is now turned off')
    expect(mail.html).toContain('>Buy minutes<')
  })

  it('escapes the reason and ends the sentence when the reason has no punctuation', () => {
    const mail = autoTopUpFailedEmail({ minutes: 100, amount: 25, currency: 'usd', reason: '<b>bad</b> card' })
    expect(mail.html).toContain('&lt;b&gt;bad&lt;/b&gt; card.')
    expect(mail.html).not.toContain('<b>bad</b>')
    const generic = autoTopUpFailedEmail({ minutes: 1000, amount: 230, currency: 'usd' })
    expect(text(generic.html)).toContain('for 1,000 extra minutes, but the payment didn’t go through.')
  })
})

describe('paymentSuccessEmail', () => {
  it('names a one-time purchase instead of a plan', () => {
    const mail = paymentSuccessEmail({ amount: 25, currency: 'usd', planName: 'Pro', itemDescription: '100 extra minutes' })
    const body = text(mail.html)
    expect(body).toContain('payment of 25.00 USD for 100 extra minutes.')
    expect(body).not.toContain('Pro plan')
  })

  it('still names the plan for a subscription payment', () => {
    expect(text(paymentSuccessEmail({ amount: 249, currency: 'usd', planName: 'Pro' }).html)).toContain('for the Pro plan.')
  })
})
