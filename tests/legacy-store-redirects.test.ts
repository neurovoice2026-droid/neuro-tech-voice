// The removed Romanian store dashboard paths (/magazin/...) redirect for good
// to the English pages that replaced them (next.config.ts).

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import nextConfig from '@/next.config'

/** Every page the Romanian section had (app/(dashboard)/magazin before the rename) and its English successor. */
const EXPECTED: Record<string, string> = {
  '/magazin': '/store',
  '/magazin/conexiuni': '/store/connections',
  '/magazin/comenzi': '/store/orders',
  '/magazin/clienti': '/store/customers',
  '/magazin/produse': '/store/products',
  '/magazin/automatizari': '/store/automations',
  '/magazin/nu-suna': '/store/do-not-call',
  '/magazin/setari': '/store/settings',
}

describe('legacy /magazin redirects', () => {
  it('every removed path redirects permanently to its /store page', async () => {
    const redirects = (await nextConfig.redirects?.()) ?? []
    const legacy = redirects.filter((r) => r.source === '/magazin' || r.source.startsWith('/magazin/'))
    expect(Object.fromEntries(legacy.map((r) => [r.source, r.destination]))).toEqual(EXPECTED)
    for (const r of legacy) expect('permanent' in r && r.permanent, r.source).toBe(true)
  })

  it('every destination is a page that exists, and no old page is left behind', () => {
    const root = join(process.cwd(), 'app', '(dashboard)')
    for (const destination of Object.values(EXPECTED)) {
      expect(existsSync(join(root, ...destination.split('/').filter(Boolean), 'page.tsx')), destination).toBe(true)
    }
    expect(existsSync(join(root, 'magazin'))).toBe(false)
  })
})
