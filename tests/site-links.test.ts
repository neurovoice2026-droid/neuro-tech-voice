// Every link the site header (bar, mega menus, mobile sheet) and the
// footer can draw leads somewhere real. /case-studies, /contact and the
// four /product/voice-* pages were never built, and the header linked into
// all six 404s from every page; the footer only hid its copies of them.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AUTH,
  FOOTER,
  HEADER_NAV,
  NAV_INDUSTRIES,
  PRODUCT_GROUPS,
  PRODUCT_MENU,
  SITE_HEADER,
  SOLUTIONS_MENU,
  SOLUTION_ITEMS,
} from '@/lib/site'
import { resolvesToPage } from './helpers/app-routes'

type Link = { where: string; href: string }

/** Everything components/site/header/** and components/site/footer.tsx link to. */
function siteLinks(): Link[] {
  const links: Link[] = []
  for (const entry of HEADER_NAV) {
    if (entry.kind === 'link') links.push({ where: `HEADER_NAV ${entry.id}`, href: entry.href })
  }
  links.push({ where: 'SITE_HEADER signin', href: SITE_HEADER.signin.href })
  links.push({ where: 'SITE_HEADER signup', href: SITE_HEADER.signup.href })
  links.push({ where: 'wordmark', href: '/#top' })
  for (const group of PRODUCT_GROUPS) {
    for (const item of group.items) links.push({ where: `PRODUCT_GROUPS ${item.id}`, href: item.href })
  }
  links.push({ where: 'PRODUCT_MENU demo', href: PRODUCT_MENU.demo.href })
  links.push({ where: 'PRODUCT_MENU price', href: PRODUCT_MENU.price.href })
  links.push({ where: 'industry index', href: '/industries' })
  for (const industry of NAV_INDUSTRIES) {
    links.push({ where: `NAV_INDUSTRIES ${industry.slug}`, href: `/industries/${industry.slug}` })
  }
  for (const item of SOLUTION_ITEMS) links.push({ where: `SOLUTION_ITEMS ${item.id}`, href: item.href })
  links.push({ where: 'SOLUTIONS_MENU cta', href: SOLUTIONS_MENU.cta.href(SOLUTION_ITEMS[0].id) })
  links.push({ where: 'SOLUTIONS_MENU footer', href: SOLUTIONS_MENU.footer.link.href })
  for (const column of FOOTER.columns) {
    for (const link of column.links) links.push({ where: `FOOTER ${column.title}`, href: link.href })
  }
  for (const link of FOOTER.legal) links.push({ where: 'FOOTER legal', href: link.href })
  return links
}

/** Every literal `id="…"` in the site's components, for the homepage anchors. */
function siteIds(): Set<string> {
  const ids = new Set<string>()
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.tsx')) {
        for (const match of readFileSync(path, 'utf8').matchAll(/\bid="([^"]+)"/g)) ids.add(match[1])
      }
    }
  }
  walk(join(process.cwd(), 'components', 'site'))
  return ids
}

describe('site header and footer links', () => {
  const links = siteLinks()

  it('only ever link to a path on this site or to the sales line', () => {
    for (const { where, href } of links) {
      expect(href.startsWith('/') || href === AUTH.contactSales, `${where}: ${href}`).toBe(true)
    }
  })

  it('every path resolves to a page the app serves', () => {
    for (const { where, href } of links) {
      if (!href.startsWith('/')) continue
      const path = href.split('#')[0].split('?')[0] || '/'
      expect(resolvesToPage(path), `${where}: ${href}`).toBe(true)
    }
  })

  it('every homepage anchor names a section that exists', () => {
    const ids = siteIds()
    for (const { where, href } of links) {
      if (!href.startsWith('/#')) continue
      expect(ids.has(href.slice(2)), `${where}: ${href}`).toBe(true)
    }
  })

  it('links none of the pages that were never built', () => {
    const hrefs = links.map((l) => l.href)
    for (const dead of [
      '/case-studies',
      '/contact',
      '/product/voice-library',
      '/product/voice-cloning',
      '/product/text-to-speech',
      '/product/speech-to-text',
    ]) {
      expect(hrefs).not.toContain(dead)
    }
  })

  it('Contact rings the sales line, and Case Studies is gone from the bar', () => {
    const bar = HEADER_NAV.filter((e) => e.kind === 'link')
    expect(bar.map((e) => e.id)).toEqual(['pricing', 'contact'])
    expect(bar.find((e) => e.id === 'contact')).toMatchObject({ label: 'Contact', href: AUTH.contactSales })
  })

  it('keeps the Voice group in the menu, each row on the page that covers it', () => {
    const voice = PRODUCT_GROUPS.find((g) => g.id === 'voice')
    expect(voice?.items.map((i) => i.id)).toEqual(['voice-library', 'voice-cloning', 'text-to-speech', 'speech-to-text'])
    for (const item of voice?.items ?? []) expect(item.href, item.id).toBe('/product/ai-agents')
  })

  it('draws each footer link once per column, so the shared Voice page is not listed five times', () => {
    for (const column of FOOTER.columns) {
      const hrefs = column.links.map((l) => l.href)
      expect(new Set(hrefs).size, column.title).toBe(hrefs.length)
    }
    const product = FOOTER.columns.find((c) => c.title === 'Product')
    expect(product?.links).toEqual([
      { label: 'AI Agents', href: '/product/ai-agents' },
      { label: 'Knowledge Base', href: '/product/knowledge-base' },
      { label: 'Integrations', href: '/product/integrations' },
    ])
  })
})
