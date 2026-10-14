// The sign-up intent: a store plan's "Start free" carries ?intent=store to
// the register page, the page keeps it in a cookie, and Step 0 of the
// onboarding pre-selects "Online store" from it, in English.

import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}))

import { BUSINESS_INTENT_COOKIE } from '@/lib/commerce/business-type'
import {
  BUSINESS_INTENT_MAX_AGE_SECONDS,
  STORE_INTENT,
  businessIntentCookie,
  businessTypeFromIntent,
  expiredBusinessIntentCookie,
  readBusinessIntent,
} from '@/lib/auth/business-intent'
import { REGISTER_INTRO } from '@/components/auth/register-intro'
import RegisterPage from '@/app/(auth)/register/page'
import { STEP0_COPY, Step0BusinessType } from '@/components/onboarding/Step0BusinessType'

describe('the intent cookie', () => {
  it('is named as the onboarding expects and lasts thirty days, site wide, lax', () => {
    expect(BUSINESS_INTENT_COOKIE).toBe('ntv_business_intent')
    expect(BUSINESS_INTENT_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60)
    expect(businessIntentCookie('ecommerce')).toBe('ntv_business_intent=ecommerce; Path=/; Max-Age=2592000; SameSite=Lax')
    expect(businessIntentCookie('ecommerce', true)).toBe('ntv_business_intent=ecommerce; Path=/; Max-Age=2592000; SameSite=Lax; Secure')
    // Readable by the page: Step 0 reads it from document.cookie.
    expect(businessIntentCookie('ecommerce')).not.toMatch(/httponly/i)
    expect(expiredBusinessIntentCookie()).toBe('ntv_business_intent=; Path=/; Max-Age=0; SameSite=Lax')
  })

  it('maps the store sign-up intent to the ecommerce business type and nothing else', () => {
    expect(STORE_INTENT).toBe('store')
    expect(businessTypeFromIntent('store')).toBe('ecommerce')
    expect(businessTypeFromIntent(['store', 'other'])).toBe('ecommerce')
    expect(businessTypeFromIntent('services')).toBeNull()
    expect(businessTypeFromIntent('ecommerce')).toBeNull()
    expect(businessTypeFromIntent(undefined)).toBeNull()
    expect(businessTypeFromIntent(null)).toBeNull()
    expect(businessTypeFromIntent([])).toBeNull()
  })

  it('reads the cookie out of a header or document.cookie, and refuses values it never wrote', () => {
    expect(readBusinessIntent('ntv_business_intent=ecommerce')).toBe('ecommerce')
    expect(readBusinessIntent('a=b; ntv_business_intent=ecommerce; c=d')).toBe('ecommerce')
    expect(readBusinessIntent('ntv_business_intent=services')).toBe('services')
    expect(readBusinessIntent('ntv_business_intent=%65commerce')).toBe('ecommerce')
    expect(readBusinessIntent('ntv_business_intent=plumbing')).toBeNull()
    expect(readBusinessIntent('ntv_business_intent=%E0%A4%A')).toBeNull()
    expect(readBusinessIntent('other_ntv_business_intent=ecommerce')).toBeNull()
    expect(readBusinessIntent('')).toBeNull()
    expect(readBusinessIntent(null)).toBeNull()
    expect(readBusinessIntent(undefined)).toBeNull()
  })
})

describe('the register page', () => {
  async function page(intent?: string) {
    const element = await RegisterPage({ searchParams: Promise.resolve(intent === undefined ? {} : { intent }) })
    return renderToString(element)
  }

  it('says it is a store sign-up when the store plans sent the visitor', async () => {
    const out = await page('store')
    expect(out).toContain(REGISTER_INTRO.ecommerce)
    expect(out).not.toContain(REGISTER_INTRO.services)
    expect(out).toContain('Create your account')
  })

  it('is the plain sign-up otherwise, including for an intent it does not know', async () => {
    for (const intent of [undefined, 'plumbing', 'ecommerce']) {
      const out = await page(intent)
      expect(out).toContain(REGISTER_INTRO.services)
      expect(out).not.toContain(REGISTER_INTRO.ecommerce)
    }
  })
})

describe('Step 0 of the onboarding', () => {
  const render = (suggested?: 'services' | 'ecommerce' | null) =>
    renderToString(createElement(Step0BusinessType, { suggested }))

  it('is in English, title to button', () => {
    const out = render()
    for (const text of [
      STEP0_COPY.eyebrow,
      STEP0_COPY.title,
      STEP0_COPY.description,
      STEP0_COPY.options.services.title,
      STEP0_COPY.options.ecommerce.title,
      STEP0_COPY.options.ecommerce.description,
      STEP0_COPY.continue,
    ]) {
      expect(out).toContain(text)
    }
    expect(STEP0_COPY.options.ecommerce.title).toBe('Online store')
    expect(STEP0_COPY.title).toBe('What kind of business do you run?')
    expect(STEP0_COPY.errors.save).toBe('Your choice could not be saved. Please try again.')
    expect(STEP0_COPY.errors.network).toBe('Network error. Check your connection and try again.')
    // Nothing Romanian is left, in the copy table or in the markup.
    const romanian = /Magazin|Pasul|Continuă|afacer|Alege|Eroare|Se salvează|[ăâîșț]/i
    expect(JSON.stringify(STEP0_COPY)).not.toMatch(romanian)
    expect(out).not.toMatch(romanian)
  })

  it('pre-selects nothing without an intent: the owner picks, then continues', () => {
    const out = render()
    expect(out).not.toContain('aria-checked="true"')
    expect(out).not.toContain(STEP0_COPY.suggested)
    // The continue button waits for a choice.
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Continue/)
  })

  it('pre-selects the online store from the sign-up intent, says so, and still waits for the click', () => {
    const out = render('ecommerce')
    expect(out).toMatch(/aria-checked="true"[^>]*>[\s\S]*?Online store/)
    expect(out).toMatch(/aria-checked="false"[^>]*>[\s\S]*?Service business/)
    expect(out).toContain(STEP0_COPY.suggested)
    expect(out).not.toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Continue/)
  })

  it('reads the suggestion from nothing on the server when no intent is handed in', () => {
    // The browser's cookie read happens after hydration (useSyncExternalStore); the server never pre-selects on its own.
    expect(render(null)).not.toContain('aria-checked="true"')
  })
})
