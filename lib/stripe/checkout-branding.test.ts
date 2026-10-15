import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CHECKOUT_LOGO_PATH, checkoutBranding, createBrandedCheckoutSession } from '@/lib/stripe/checkout-branding'

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
  it('dresses the page like the site, simply: white, brand violet button, Inter, rounded, the name alone in the header', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://www.example.com/')
    expect(checkoutBranding()).toEqual({
      display_name: 'NeuroVoice',
      background_color: '#ffffff',
      button_color: '#551a89',
      border_style: 'rounded',
      font_family: 'inter',
      // The name as an image: with a logo Checkout drops its generic shop glyph.
      logo: { type: 'url', url: 'https://www.example.com/brand/checkout-logo.png' },
    })
  })

  it('never sends an icon (it would sit before the name)', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://www.example.com')
    expect(checkoutBranding()).not.toHaveProperty('icon')
  })

  it('keeps only the origin of the app URL for the logo', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '  https://app.example.com/some/path?x=1 ')
    expect(checkoutBranding()?.logo).toEqual({ type: 'url', url: 'https://app.example.com/brand/checkout-logo.png' })
  })

  it('sends no logo Stripe could not fetch: http, localhost, malformed or unset app URL; the rest stays', () => {
    for (const url of ['http://localhost:3000', 'http://app.example.com', 'not a url', '']) {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', url)
      const branding = checkoutBranding()
      expect(branding).not.toHaveProperty('logo')
      expect(branding?.display_name).toBe('NeuroVoice')
      expect(branding?.button_color).toBe('#551a89')
    }
  })

  it('the logo it points at ships in public/: a wide PNG within Stripe\'s 512 KB, drawn at 4x the 28px header', () => {
    const file = join(process.cwd(), 'public', CHECKOUT_LOGO_PATH)
    expect(existsSync(file)).toBe(true)
    const bytes = readFileSync(file)
    expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG')
    const width = bytes.readUInt32BE(16)
    const height = bytes.readUInt32BE(20)
    expect(height).toBe(112)
    expect(width).toBeGreaterThan(height)
    expect(bytes.length).toBeLessThanOrEqual(512 * 1024)
  })

  it('STRIPE_CHECKOUT_BRANDING=off sends nothing', () => {
    vi.stubEnv('STRIPE_CHECKOUT_BRANDING', ' OFF ')
    expect(checkoutBranding()).toBeUndefined()
  })
})

describe('createBrandedCheckoutSession', () => {
  it('creates the session once, with the branding next to the caller params', async () => {
    const { log } = logger()
    const session = await createBrandedCheckoutSession(stripe, params, log)
    expect(session).toEqual({ id: 'cs_1', url: 'https://checkout.stripe.test/s' })
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0]).toEqual({ ...params, branding_settings: checkoutBranding() })
  })

  it('a branding field Stripe refuses never costs the sale: created again without branding, logged by field and code only', async () => {
    create.mockRejectedValueOnce(stripeError('branding_settings[font_family]'))
    const { log, lines } = logger()
    const session = await createBrandedCheckoutSession(stripe, params, log)
    expect(session.url).toBe('https://checkout.stripe.test/s')
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[1][0]).toEqual(params)
    expect(create.mock.calls[1][0]).not.toHaveProperty('branding_settings')
    expect(lines).toEqual([{ level: 'warn', event: 'stripe.checkout_branding_rejected', data: { param: 'branding_settings[font_family]', code: 'parameter_invalid' } }])
    expect(JSON.stringify(lines)).not.toContain('secret_ref')
  })

  it('an API version that does not know branding_settings at all is handled the same way', async () => {
    create.mockRejectedValueOnce(stripeError('branding_settings'))
    const { log } = logger()
    await createBrandedCheckoutSession(stripe, params, log)
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('any other error is the caller\'s: no retry', async () => {
    const declined = stripeError('line_items[0][price]')
    create.mockRejectedValueOnce(declined)
    const { log, lines } = logger()
    await expect(createBrandedCheckoutSession(stripe, params, log)).rejects.toBe(declined)
    expect(create).toHaveBeenCalledTimes(1)
    expect(lines).toEqual([])
  })

  it('a connection error naming nothing is not mistaken for a branding refusal', async () => {
    const down = Object.assign(new Error('socket hang up'), { type: 'StripeConnectionError' })
    create.mockRejectedValueOnce(down)
    const { log } = logger()
    await expect(createBrandedCheckoutSession(stripe, params, log)).rejects.toBe(down)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('a branding-shaped param on another error type is not retried', async () => {
    const odd = stripeError('branding_settings[logo]', 'StripeAPIError')
    create.mockRejectedValueOnce(odd)
    const { log } = logger()
    await expect(createBrandedCheckoutSession(stripe, params, log)).rejects.toBe(odd)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('switched off: the caller params go to Stripe untouched', async () => {
    vi.stubEnv('STRIPE_CHECKOUT_BRANDING', 'off')
    const { log } = logger()
    await createBrandedCheckoutSession(stripe, params, log)
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0]).toBe(params)
  })
})
