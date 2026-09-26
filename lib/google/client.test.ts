import { randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Google OAuth client: consent URL parameters, encrypted token storage, lazy
// encryption of legacy plaintext tokens and revocation, against an in-memory
// integrations table. No network: revokeToken is stubbed.

interface Row {
  id: string
  org_id: string
  type: string
  is_active: boolean
  config: Record<string, unknown>
  scopes?: string[]
  account_email?: string | null
  google_refresh_token: string | null
  google_refresh_token_encrypted: string | null
}

const table: Row[] = []
const updates: Record<string, unknown>[] = []

function query() {
  const filters: ((row: Row) => boolean)[] = []
  let pendingUpdate: Record<string, unknown> | null = null
  let pendingDelete = false
  const matching = () => table.filter((row) => filters.every((f) => f(row)))
  const run = () => {
    if (pendingUpdate) {
      updates.push(pendingUpdate)
      for (const row of matching()) Object.assign(row, pendingUpdate)
      return { data: null, error: null }
    }
    if (pendingDelete) {
      for (const row of matching()) table.splice(table.indexOf(row), 1)
      return { data: null, error: null }
    }
    return { data: matching().map((row) => ({ ...row })), error: null }
  }
  const chain = {
    select: () => chain,
    eq: (column: keyof Row, value: unknown) => {
      filters.push((row) => row[column] === value)
      return chain
    },
    in: (column: keyof Row, values: unknown[]) => {
      filters.push((row) => values.includes(row[column]))
      return chain
    },
    not: () => chain,
    limit: () => chain,
    update: (values: Record<string, unknown>) => {
      pendingUpdate = values
      return chain
    },
    delete: () => {
      pendingDelete = true
      return chain
    },
    upsert: (values: Partial<Row> & Pick<Row, 'org_id' | 'type' | 'is_active'>) => {
      const existing = table.find((row) => row.org_id === values.org_id && row.type === values.type)
      if (existing) Object.assign(existing, values)
      else table.push({ id: `row-${table.length + 1}`, google_refresh_token: null, google_refresh_token_encrypted: null, config: {}, ...values })
      return Promise.resolve({ data: null, error: null })
    },
    maybeSingle: async () => ({ data: matching()[0] ? { ...matching()[0] } : null, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  }
  return chain
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => query() }) }))

const kv = new Map<string, unknown>()
vi.mock('@/lib/kv', () => ({
  kvGet: async (key: string) => kv.get(key) ?? null,
  kvSet: async (key: string, value: unknown) => {
    kv.set(key, value)
  },
}))

const client = await import('@/lib/google/client')
const { decryptSecret, encryptSecret } = await import('@/lib/security/crypto')

const ORG = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  table.length = 0
  updates.length = 0
  kv.clear()
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', randomBytes(32).toString('base64'))
  vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id.apps.googleusercontent.com')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'client-secret-value')
  vi.stubEnv('GOOGLE_REDIRECT_URI', '')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-value')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('getGoogleOAuthUrl', () => {
  it('asks for offline access, fresh consent and only the integration’s scopes', () => {
    const url = new URL(client.getGoogleOAuthUrl('google_calendar.nonce-value-1234567', { loginHint: 'owner@example.com' }))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    const params = url.searchParams
    expect(params.get('access_type')).toBe('offline')
    expect(params.get('prompt')).toBe('consent')
    expect(params.get('include_granted_scopes')).toBe('true')
    expect(params.get('state')).toBe('google_calendar.nonce-value-1234567')
    expect(params.get('login_hint')).toBe('owner@example.com')
    expect(params.get('redirect_uri')).toBe('https://app.example.com/api/integrations/google/callback')
    expect(params.get('scope')?.split(' ')).toEqual([
      'openid',
      'email',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.freebusy',
      'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    ])
  })
})

describe('storeGoogleConnection', () => {
  it('stores the refresh token encrypted and never in plaintext', async () => {
    await client.storeGoogleConnection({ orgId: ORG, type: 'google_calendar', refreshToken: '1//refresh', scopes: ['openid'], accountEmail: 'owner@example.com' })
    expect(table).toHaveLength(1)
    const row = table[0]
    expect(row.google_refresh_token).toBeNull()
    expect(row.google_refresh_token_encrypted).not.toContain('1//refresh')
    expect(decryptSecret(row.google_refresh_token_encrypted as string)).toBe('1//refresh')
    expect(row).toMatchObject({ is_active: true, account_email: 'owner@example.com', scopes: ['openid'] })
  })

  it('refuses to connect without an encryption key', async () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', '')
    await expect(
      client.storeGoogleConnection({ orgId: ORG, type: 'gmail', refreshToken: '1//refresh', scopes: [], accountEmail: null })
    ).rejects.toMatchObject({ code: 'encryption_not_configured' })
    expect(table).toHaveLength(0)
  })

  it('keeps the stored token when Google returns none, and clears an old error note', async () => {
    table.push({
      id: 'row-1', org_id: ORG, type: 'gmail', is_active: false, config: { last_error: 'revoked', sheet: 'x' },
      google_refresh_token: null, google_refresh_token_encrypted: encryptSecret('1//old'),
    })
    await client.storeGoogleConnection({ orgId: ORG, type: 'gmail', refreshToken: null, scopes: ['https://www.googleapis.com/auth/gmail.send'], accountEmail: null })
    expect(decryptSecret(table[0].google_refresh_token_encrypted as string)).toBe('1//old')
    expect(table[0].config).toEqual({ sheet: 'x' })
    expect(table[0].is_active).toBe(true)
  })

  it('fails clearly when there is no token at all', async () => {
    await expect(
      client.storeGoogleConnection({ orgId: ORG, type: 'gmail', refreshToken: null, scopes: [], accountEmail: null })
    ).rejects.toMatchObject({ code: 'no_refresh_token' })
  })
})

describe('getAuthorizedClient', () => {
  it('returns null when the integration is missing or disconnected', async () => {
    expect(await client.getAuthorizedClient(ORG, 'google_calendar')).toBeNull()
    table.push({ id: 'row-1', org_id: ORG, type: 'google_calendar', is_active: false, config: {}, google_refresh_token: null, google_refresh_token_encrypted: encryptSecret('1//x') })
    expect(await client.getAuthorizedClient(ORG, 'google_calendar')).toBeNull()
  })

  it('decrypts stored tokens', async () => {
    table.push({ id: 'row-1', org_id: ORG, type: 'google_calendar', is_active: true, config: {}, google_refresh_token: null, google_refresh_token_encrypted: encryptSecret('1//secret') })
    const auth = await client.getAuthorizedClient(ORG, 'google_calendar')
    expect(auth?.credentials.refresh_token).toBe('1//secret')
    expect(updates).toHaveLength(0)
  })

  it('encrypts a legacy plaintext token on first use and clears the plaintext', async () => {
    table.push({ id: 'row-1', org_id: ORG, type: 'google_sheets', is_active: true, config: {}, google_refresh_token: '1//legacy', google_refresh_token_encrypted: null })
    const auth = await client.getAuthorizedClient(ORG, 'google_sheets')
    expect(auth?.credentials.refresh_token).toBe('1//legacy')
    expect(table[0].google_refresh_token).toBeNull()
    expect(decryptSecret(table[0].google_refresh_token_encrypted as string)).toBe('1//legacy')
  })

  it('reuses a cached access token instead of refreshing', async () => {
    table.push({ id: 'row-1', org_id: ORG, type: 'google_calendar', is_active: true, config: {}, google_refresh_token: null, google_refresh_token_encrypted: encryptSecret('1//secret') })
    const first = await client.getAuthorizedClient(ORG, 'google_calendar')
    first?.emit('tokens', { access_token: 'ya29.cached', expiry_date: Date.now() + 3_600_000 })
    await new Promise((resolve) => setTimeout(resolve, 0))
    const [key, sealed] = [...kv.entries()][0]
    expect(key).toMatch(/^google:at:/)
    expect(String(sealed)).not.toContain('ya29.cached')
    const second = await client.getAuthorizedClient(ORG, 'google_calendar')
    expect(second?.credentials.access_token).toBe('ya29.cached')
  })
})

describe('revokeGoogleAccess', () => {
  it('revokes each distinct grant once and clears every stored token', async () => {
    const revoke = vi.spyOn(Object.getPrototypeOf(client.getGoogleOAuthClient()), 'revokeToken').mockResolvedValue({} as never)
    const shared = encryptSecret('1//shared')
    table.push(
      { id: 'a', org_id: ORG, type: 'google_calendar', is_active: true, config: {}, google_refresh_token: null, google_refresh_token_encrypted: shared },
      { id: 'b', org_id: ORG, type: 'gmail', is_active: true, config: {}, google_refresh_token: null, google_refresh_token_encrypted: encryptSecret('1//shared') },
      { id: 'c', org_id: ORG, type: 'google_docs', is_active: true, config: {}, google_refresh_token: '1//legacy', google_refresh_token_encrypted: null },
      { id: 'other-org', org_id: 'someone-else', type: 'gmail', is_active: true, config: {}, google_refresh_token: '1//theirs', google_refresh_token_encrypted: null }
    )
    const result = await client.revokeGoogleAccess(ORG)
    expect(result).toEqual({ revoked: 2, failed: 0 })
    expect(revoke).toHaveBeenCalledTimes(2)
    for (const row of table.filter((r) => r.org_id === ORG)) {
      expect(row).toMatchObject({ is_active: false, google_refresh_token: null, google_refresh_token_encrypted: null })
    }
    expect(table.find((r) => r.id === 'other-org')?.google_refresh_token).toBe('1//theirs')
  })

  it('counts failures but still clears tokens', async () => {
    vi.spyOn(Object.getPrototypeOf(client.getGoogleOAuthClient()), 'revokeToken').mockRejectedValue(
      Object.assign(new Error('boom'), { response: { status: 500, data: {} } })
    )
    table.push({ id: 'a', org_id: ORG, type: 'gmail', is_active: true, config: {}, google_refresh_token: null, google_refresh_token_encrypted: encryptSecret('1//x') })
    expect(await client.revokeGoogleAccess(ORG)).toEqual({ revoked: 0, failed: 1 })
    expect(table[0].google_refresh_token_encrypted).toBeNull()
  })
})

describe('isGoogleAuthError', () => {
  it('recognises revoked grants and missing permissions, not rate limits', () => {
    expect(client.isGoogleAuthError({ response: { status: 400, data: { error: 'invalid_grant' } } })).toBe(true)
    expect(client.isGoogleAuthError({ response: { status: 403, data: { error: { errors: [{ reason: 'insufficientPermissions' }] } } } })).toBe(true)
    expect(client.isGoogleAuthError({ response: { status: 403, data: { error: { errors: [{ reason: 'rateLimitExceeded' }] } } } })).toBe(false)
    expect(client.isGoogleAuthError(new Error('socket hang up'))).toBe(false)
  })
})
