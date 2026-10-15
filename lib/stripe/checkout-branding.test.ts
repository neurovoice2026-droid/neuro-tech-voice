import { beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type Stripe from 'stripe'
import { CHECKOUT_ICON_PATH, checkoutBranding, createBrandedCheckoutSession } from '@/lib/stripe/checkout-branding'

function logger() {
  const lines: Array<{ level: string; event: string; data: unknown }> = []
  const at = (level: string) => (event: string, ...rest: unknown[]) => lines.push({ level, event, data: rest[rest.length - 1] })
  return { lines, log: { info: at('info'), warn: at('warn'), error: at('error'), debug: at('debug'), child: () => logger().log } as never }
}

const create = vi.fn()
const stripe = { checkout: { sessions: { create } } } as unknown as Stripe
const params: Stripe.Checkout.SessionCreateParams = {
  mode: 'subscription',
  line_items: [{ price: 'price_plan', quantity: 1 }],
  success_url: 'https://app.example.com/billing?success=true',
}

function stripeError(param: string, type = 'StripeInvalidRequestError') {
  return Object.assign(new Error(`Invalid value for ${param}: see https://files.example/secret_ref`), { type, param, code: 'parameter_invalid' })
}

beforeEach(() => {
  create.mockReset().mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.test/s' })
})

describe('checkoutBranding', () => {
  it('dresses the page like the site: white, brand violet button, Inter, rounded, the crown from the https origin', () => {
    expect(checkoutBranding('https://www.example.com/')).toEqual({
      display_name: 'NeuroVoice',
      background_color: '#ffffff',
      button_color: '#551a89',
      border_style: 'rounded',
      font_family: 'inter',
      icon: { type: 'url', url: 'https://www.example.com/brand/checkout-icon.png' },
    })
  })

  it('keeps only the origin of the app URL for the icon', () => {
    expect(checkoutBranding('  https://app.example.com/some/path?x=1 ')?.icon).toEqual({ type: 'url', url: 'https://app.example.com/brand/checkout-icon.png' })
  })

  it('sends no icon Stripe could not fetch: http, localhost over http, or a malformed URL', () => {
    for (const url of ['http://localhost:3000', 'http://app.example.com', 'not a url', '']) {
      const branding = checkoutBranding(url)
      expect(branding?.icon).toBeUndefined()
      expect(branding?.button_color).toBe('#551a89')
    }
  })

  it('STRIPE_CHECKOUT_BRANDING=off sends nothing', () => {
    vi.stubEnv('STRIPE_CHECKOUT_BRANDING', ' OFF ')
    expect(checkoutBranding('https://www.example.com')).toBeUndefined()
  })

  it('the icon it points at ships in public/ and is a PNG', () => {
    const file = join(process.cwd(), 'public', CHECKOUT_ICON_PATH)
    expect(existsSync(file)).toBe(true)
    expect(readFileSync(file).subarray(1, 4).toString('ascii')).toBe('PNG')
  })
})

describe('createBrandedCheckoutSession', () => {
  it('creates the session once, with the branding next to the caller params', async () => {
    const { log } = logger()
    const session = await createBrandedCheckoutSession(stripe, params, 'https://www.example.com', log)
    expect(session).toEqual({ id: 'cs_1', url: 'https://checkout.stripe.test/s' })
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0]).toEqual({ ...params, branding_settings: checkoutBranding('https://www.example.com') })
  })

  it('a branding field Stripe refuses never costs the sale: created again without branding, logged by field and code only', async () => {
    create.mockRejectedValueOnce(stripeError('branding_settings[icon][url]'))
    const { log, lines } = logger()
    const session = await createBrandedCheckoutSession(stripe, params, 'https://www.example.com', log)
    expect(session.url).toBe('https://checkout.stripe.test/s')
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[1][0]).toEqual(params)
    expect(create.mock.calls[1][0]).not.toHaveProperty('branding_settings')
    expect(lines).toEqual([{ level: 'warn', event: 'stripe.checkout_branding_rejected', data: { param: 'branding_settings[icon][url]', code: 'parameter_invalid' } }])
    expect(JSON.stringify(lines)).not.toContain('secret_ref')
  })

  it('an API version that does not know branding_settings at all is handled the same way', async () => {
    create.mockRejectedValueOnce(stripeError('branding_settings'))
    const { log } = logger()
    await createBrandedCheckoutSession(stripe, params, 'https://www.example.com', log)
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('any other error is the caller\'s: no retry', async () => {
    const declined = stripeError('line_items[0][price]')
    create.mockRejectedValueOnce(declined)
    const { log, lines } = logger()
    await expect(createBrandedCheckoutSession(stripe, params, 'https://www.example.com', log)).rejects.toBe(declined)
    expect(create).toHaveBeenCalledTimes(1)
    expect(lines).toEqual([])
  })

  it('a connection error naming nothing is not mistaken for a branding refusal', async () => {
    const down = Object.assign(new Error('socket hang up'), { type: 'StripeConnectionError' })
    create.mockRejectedValueOnce(down)
    const { log } = logger()
    await expect(createBrandedCheckoutSession(stripe, params, 'https://www.example.com', log)).rejects.toBe(down)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('a branding-shaped param on another error type is not retried', async () => {
    const odd = stripeError('branding_settings[logo]', 'StripeAPIError')
    create.mockRejectedValueOnce(odd)
    const { log } = logger()
    await expect(createBrandedCheckoutSession(stripe, params, 'https://www.example.com', log)).rejects.toBe(odd)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('switched off: the caller params go to Stripe untouched', async () => {
    vi.stubEnv('STRIPE_CHECKOUT_BRANDING', 'off')
    const { log } = logger()
    await createBrandedCheckoutSession(stripe, params, 'https://www.example.com', log)
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0]).toBe(params)
  })
})
