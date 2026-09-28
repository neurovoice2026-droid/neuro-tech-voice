import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HEADER_BOOT } from '@/lib/header-dock'
import {
  DYNAMIC_APP_ROUTES,
  HEADER_BOOT_HASH,
  buildCsp,
  classifyPath,
  createNonce,
  httpsOrigin,
  scriptHash,
  webSocketOrigin,
} from './csp'

const SUPABASE = 'https://abcdefghijklmnop.supabase.co'
const GATEWAY = 'wss://voice.example.com'

function directives(policy: string): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const part of policy.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/)
    if (name) map.set(name, sources)
  }
  return map
}

function build(overrides: Partial<Parameters<typeof buildCsp>[0]> = {}) {
  return buildCsp({
    nonce: null,
    dev: false,
    supabaseUrl: SUPABASE,
    gatewayUrl: GATEWAY,
    vercelPreview: false,
    ...overrides,
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('classifyPath', () => {
  it('marks every per-request dashboard and onboarding page as dynamic', () => {
    for (const route of [
      '/dashboard', '/calls', '/agent', '/phone', '/integrations', '/workflows',
      '/billing', '/inbox', '/voice-lab', '/settings', '/onboarding',
    ]) {
      expect(classifyPath(route), route).toBe('dynamic')
    }
    expect(DYNAMIC_APP_ROUTES).toHaveLength(11)
  })

  it('tolerates a trailing slash', () => {
    expect(classifyPath('/dashboard/')).toBe('dynamic')
    expect(classifyPath('/billing//')).toBe('dynamic')
  })

  it('keeps prerendered pages on the static policy', () => {
    for (const route of [
      '/', '/login', '/register', '/forgot-password', '/reset-password',
      '/product/ai-agents', '/product/knowledge-base', '/privacy', '/terms',
      '/cookies', '/refund-policy', '/_not-found',
    ]) {
      expect(classifyPath(route), route).toBe('static')
    }
  })

  it('never gives a nonce policy to a page it cannot be sure renders per request', () => {
    // Unknown nested paths render the prerendered 404 page, which has no nonce.
    expect(classifyPath('/dashboard/does-not-exist')).toBe('static')
    expect(classifyPath('/agents')).toBe('static')
    expect(classifyPath('/Dashboard')).toBe('static')
  })

  it('recognises API routes', () => {
    expect(classifyPath('/api')).toBe('api')
    expect(classifyPath('/api/agent')).toBe('api')
    expect(classifyPath('/api/telephony/inbound')).toBe('api')
    expect(classifyPath('/apikeys')).toBe('static')
  })
})

describe('createNonce', () => {
  it('returns 128 bits of base64 and never repeats', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const nonce = createNonce()
      expect(Buffer.from(nonce, 'base64')).toHaveLength(16)
      seen.add(nonce)
    }
    expect(seen.size).toBe(200)
  })
})

describe('header boot script hash', () => {
  it('is the sha256 of the exact script text app/layout.tsx inlines', () => {
    const expected = createHash('sha256').update(HEADER_BOOT, 'utf8').digest('base64')
    expect(HEADER_BOOT_HASH).toBe(`'sha256-${expected}'`)
  })

  it('changes when the script changes, so a stale hash cannot slip through', () => {
    expect(scriptHash(`${HEADER_BOOT} `)).not.toBe(HEADER_BOOT_HASH)
  })

  it('is present in the dynamic policy and absent from the static one', () => {
    expect(directives(build({ nonce: createNonce() })).get('script-src')).toContain(HEADER_BOOT_HASH)
    // A hash would make browsers ignore 'unsafe-inline' and block Next's inline scripts.
    expect(directives(build()).get('script-src')).not.toContain(HEADER_BOOT_HASH)
  })
})

describe('buildCsp: dynamic policy', () => {
  const nonce = 'AAECAwQFBgcICQoLDA0ODw=='

  it('uses the nonce with strict-dynamic and no unsafe-inline', () => {
    const script = directives(build({ nonce })).get('script-src')!
    expect(script).toEqual(["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", HEADER_BOOT_HASH])
    expect(script).not.toContain("'unsafe-inline'")
    expect(script).not.toContain("'unsafe-eval'")
  })

  it('adds unsafe-eval only in development', () => {
    expect(directives(build({ nonce, dev: true })).get('script-src')).toContain("'unsafe-eval'")
  })

  it('rejects a nonce that could inject directives', () => {
    expect(() => build({ nonce: "abc'; script-src *" })).toThrow('Invalid CSP nonce')
    expect(() => build({ nonce: 'short' })).toThrow('Invalid CSP nonce')
  })
})

describe('buildCsp: static policy', () => {
  it('allows inline scripts from self without a nonce', () => {
    const script = directives(build()).get('script-src')!
    expect(script).toEqual(["'self'", "'unsafe-inline'"])
    expect(script.some((s) => s.startsWith("'nonce-"))).toBe(false)
    expect(script).not.toContain("'strict-dynamic'")
  })
})

describe('buildCsp: shared directives', () => {
  for (const [label, nonce] of [['static', null], ['dynamic', 'AAECAwQFBgcICQoLDA0ODw==']] as const) {
    it(`locks down the ${label} policy`, () => {
      const d = directives(build({ nonce }))
      expect(d.get('default-src')).toEqual(["'self'"])
      expect(d.get('object-src')).toEqual(["'none'"])
      expect(d.get('base-uri')).toEqual(["'self'"])
      expect(d.get('frame-ancestors')).toEqual(["'none'"])
      expect(d.get('form-action')).toEqual(["'self'"])
      expect(d.get('style-src')).toEqual(["'self'", "'unsafe-inline'"])
      expect(d.get('font-src')).toEqual(["'self'", 'data:'])
      expect(d.get('media-src')).toEqual(["'self'", 'blob:', 'data:'])
      expect(d.get('worker-src')).toEqual(["'self'", 'blob:'])
      expect(d.get('img-src')).toEqual([
        "'self'", 'data:', 'blob:', 'https://*.supabase.co', 'https://lh3.googleusercontent.com',
      ])
      expect(d.get('connect-src')).toEqual([
        "'self'", SUPABASE, 'wss://abcdefghijklmnop.supabase.co', 'https://api.stripe.com', GATEWAY,
      ])
      expect(d.has('upgrade-insecure-requests')).toBe(true)
    })
  }

  it('turns an https gateway URL into its wss origin and drops the path', () => {
    const d = directives(build({ gatewayUrl: 'https://gw.example.com:8443/base/' }))
    expect(d.get('connect-src')).toContain('wss://gw.example.com:8443')
  })

  it('omits unconfigured or malformed origins instead of emitting junk', () => {
    const d = directives(build({ supabaseUrl: null, gatewayUrl: 'your-gateway-url' }))
    expect(d.get('connect-src')).toEqual(["'self'", 'https://api.stripe.com'])
  })

  it('reads the Supabase and gateway URLs from the environment by default', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://envproject.supabase.co/')
    vi.stubEnv('VOICE_GATEWAY_URL', 'https://gateway.example.org')
    vi.stubEnv('VERCEL_ENV', 'production')
    const d = directives(buildCsp({ nonce: null, dev: false }))
    expect(d.get('connect-src')).toEqual([
      "'self'",
      'https://envproject.supabase.co',
      'wss://envproject.supabase.co',
      'https://api.stripe.com',
      'wss://gateway.example.org',
    ])
  })

  it('skips upgrade-insecure-requests in development or when asked to', () => {
    expect(directives(build({ dev: true })).has('upgrade-insecure-requests')).toBe(false)
    expect(directives(build({ upgradeInsecureRequests: false })).has('upgrade-insecure-requests')).toBe(false)
  })

  it('lets the development server open its hot-reload socket', () => {
    expect(directives(build({ dev: true })).get('connect-src')).toContain('ws:')
    expect(directives(build()).get('connect-src')).not.toContain('ws:')
  })

  it('allows the Vercel toolbar only on preview deployments', () => {
    const preview = directives(build({ vercelPreview: true }))
    expect(preview.get('script-src')).toContain('https://vercel.live')
    expect(preview.get('frame-src')).toContain('https://vercel.live')
    const production = build()
    expect(production).not.toContain('vercel.live')
  })

  it('never contains wildcards for scripts or connections', () => {
    for (const nonce of [null, 'AAECAwQFBgcICQoLDA0ODw==']) {
      const d = directives(build({ nonce }))
      expect(d.get('script-src')).not.toContain('*')
      expect(d.get('connect-src')).not.toContain('*')
      expect(d.get('script-src')).not.toContain('https:')
    }
  })
})

describe('origin helpers', () => {
  it('parses http(s) origins', () => {
    expect(httpsOrigin('https://x.supabase.co/rest/v1')).toBe('https://x.supabase.co')
    expect(httpsOrigin('ftp://x')).toBeNull()
    expect(httpsOrigin('')).toBeNull()
    expect(httpsOrigin(undefined)).toBeNull()
  })

  it('maps schemes to their WebSocket counterparts', () => {
    expect(webSocketOrigin('https://a.example')).toBe('wss://a.example')
    expect(webSocketOrigin('wss://a.example/twilio')).toBe('wss://a.example')
    expect(webSocketOrigin('http://localhost:8080')).toBe('ws://localhost:8080')
    expect(webSocketOrigin('ws://localhost:8080')).toBe('ws://localhost:8080')
    expect(webSocketOrigin('mailto:a@b.c')).toBeNull()
  })
})
