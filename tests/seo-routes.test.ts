// robots.txt, sitemap.xml and the canonical origin (app/robots.ts,
// app/sitemap.ts, app/layout.tsx). Before these, /robots.txt and
// /sitemap.xml were 404s and no page named its canonical URL.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import { FOOTER, SITE_URL, SOLUTION_ITEMS } from '@/lib/site'
import { INDUSTRY_SLUGS } from '@/lib/pages/industries'
import { resolvesToPage } from './helpers/app-routes'

const paths = () => sitemap().map((entry) => new URL(entry.url).pathname)

function disallowed(): string[] {
  const rules = robots().rules
  const rule = Array.isArray(rules) ? rules[0] : rules
  const list = rule.disallow ?? []
  return Array.isArray(list) ? list : [list]
}

const isDisallowed = (path: string) => disallowed().some((prefix) => path.startsWith(prefix))

describe('sitemap.xml', () => {
  it('lists absolute URLs on the canonical origin, each once', () => {
    const urls = sitemap().map((entry) => entry.url)
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) expect(url === SITE_URL || url.startsWith(`${SITE_URL}/`), url).toBe(true)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('lists only pages the app serves, and no anchors or phone links', () => {
    for (const entry of sitemap()) {
      expect(entry.url).not.toMatch(/[#?]|tel:/)
      expect(resolvesToPage(new URL(entry.url).pathname), entry.url).toBe(true)
    }
  })

  it('lists the homepage, every product, solution and industry page, and the policies', () => {
    const listed = paths()
    expect(listed).toContain('/')
    for (const path of [
      '/product/ai-agents',
      '/product/knowledge-base',
      '/product/integrations',
      ...SOLUTION_ITEMS.map((item) => item.href),
      '/industries',
      ...INDUSTRY_SLUGS.map((slug) => `/industries/${slug}`),
      ...FOOTER.legal.map((link) => link.href),
    ]) {
      expect(listed, path).toContain(path)
    }
  })

  it('leaves out the app: no dashboard, store, onboarding, API or sign-in pages', () => {
    for (const path of paths()) {
      expect(isDisallowed(path), path).toBe(false)
      expect(['/login', '/register']).not.toContain(path)
    }
  })
})

describe('robots.txt', () => {
  it('opens the site, points at the sitemap on www, and closes the API', () => {
    const result = robots()
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules
    expect(rules.userAgent).toBe('*')
    expect(rules.allow).toBe('/')
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`)
    expect(isDisallowed('/api/billing/webhook')).toBe(true)
    expect(isDisallowed('/auth/callback')).toBe(true)
  })

  it('closes every page behind a sign-in, including one added later', () => {
    const dashboard = readdirSync(join(process.cwd(), 'app', '(dashboard)'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `/${entry.name}`)
    expect(dashboard.length).toBeGreaterThan(0)
    for (const path of [...dashboard, '/onboarding', '/store/orders', '/forgot-password', '/reset-password/confirm']) {
      expect(isDisallowed(path), path).toBe(true)
    }
  })

  it('does not hide a marketing page that shares a word with the app', () => {
    for (const path of ['/', '/product/integrations', '/industries/retail', '/privacy', '/login', '/register']) {
      expect(isDisallowed(path), path).toBe(false)
    }
  })
})

describe('the canonical origin', () => {
  // Read as text: the layout loads next/font, which only runs under Next.
  const layout = readFileSync(join(process.cwd(), 'app', 'layout.tsx'), 'utf8')

  it('is the same in the root layout as in lib/site.ts', () => {
    expect(layout).toContain(`metadataBase: new URL('${SITE_URL}')`)
  })

  it("gives every page its own path as canonical, not the homepage's", () => {
    expect(layout).toContain("alternates: { canonical: './' }")
  })
})
