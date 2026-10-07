// Account deletion job (lib/account/delete.ts) end to end, against an
// in-memory database and mocked providers (ElevenLabs and Cartesia through a
// mocked fetch; Stripe, Twilio and the Supabase admin APIs as fakes). Covers
// the dry-run plan, the full run, 404 tolerance, resuming after a failure in
// the middle, the lease, the time budget, cross-tenant safety and the
// invoices kept by law.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import { installFetch, type FetchMock } from '@/tests/helpers/fetch'

vi.mock('server-only', () => ({}))

const state = vi.hoisted(() => ({
  db: null as unknown,
  stripe: null as unknown,
  twilio: null as unknown,
  kbCalls: [] as string[],
  kbFailed: 0,
  pronunciationCalls: [] as string[],
  historyCalls: [] as string[],
  emails: [] as string[],
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/observability/telemetry', () => ({ emitProviderEvent: () => {}, deferBackground: () => {} }))
vi.mock('@/lib/stripe/client', () => ({ isStripeConfigured: () => true, getStripeClient: () => state.stripe }))
vi.mock('@/lib/twilio/client', () => ({ isTwilioConfigured: () => true, getTwilioClient: () => state.twilio }))
vi.mock('@/lib/voice-providers/knowledge', () => ({ KNOWLEDGE_BUCKET: 'knowledge-documents' }))
vi.mock('@/lib/voice-providers/knowledge-delete', () => ({
  deleteAllOrgKnowledge: async (orgId: string) => {
    state.kbCalls.push(orgId)
    return { documents: 2, websites: 1, folder: true, deleted: 3, alreadyGone: 1, failed: state.kbFailed }
  },
}))
vi.mock('@/lib/voice-providers/pronunciation', () => ({
  deleteOrgPronunciation: async (orgId: string) => {
    state.pronunciationCalls.push(orgId)
    return { archived: 1, gone: 0, failed: 0 }
  },
}))
vi.mock('@/lib/voice-providers/tts-history', () => ({
  purgeVoiceHistory: async (voiceId: string) => {
    state.historyCalls.push(voiceId)
    return { deleted: 1, failed: 0 }
  },
}))
vi.mock('@/lib/email/client', () => ({
  sendEmail: async (p: { to: string }) => {
    state.emails.push(p.to)
    return true
  },
}))

import { requestAccountDeletion, resumeAccountDeletions, runAccountDeletion } from './delete'
import { planAccountDeletion } from './plan'
import { DELETION_ORDER, JOB_STEPS } from './deletion-plan'

const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER_A = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
const USER_B = 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1'
const AGENT_A = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2'
const AGENT_B = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'
const hex = (c: string) => c.repeat(32)
const PN_A = `PN${hex('a')}`
const PN_B = `PN${hex('b')}`
const CA_A = `CA${hex('a')}`
const SM_A = `SM${hex('a')}`
const EMAIL_A = 'owner-a@example.com'

// ─── Fakes ────────────────────────────────────────────────────────────────────

interface Sub { id: string; customer: string; status: string; metadata: Record<string, string> }

function stripeFake(subs: Sub[]) {
  const byId = new Map(subs.map((s) => [s.id, { ...s }]))
  const missing = () => Object.assign(new Error('No such subscription'), { code: 'resource_missing', statusCode: 404, type: 'StripeInvalidRequestError' })
  return {
    byId,
    checkout: {
      sessions: {
        list: vi.fn(async (p: { customer: string }) => ({ data: p.customer === 'cus_a' ? [{ id: 'cs_open_a' }] : [], has_more: false })),
        expire: vi.fn(async () => ({})),
      },
    },
    subscriptions: {
      list: vi.fn(async (p: { customer: string }) => ({ data: [...byId.values()].filter((s) => s.customer === p.customer && s.status !== 'canceled'), has_more: false })),
      retrieve: vi.fn(async (id: string) => {
        const s = byId.get(id)
        if (!s) throw missing()
        return s
      }),
      cancel: vi.fn(async (id: string) => {
        const s = byId.get(id)
        if (!s) throw missing()
        s.status = 'canceled'
        return s
      }),
    },
  }
}

function twilioFake() {
  const removed: string[] = []
  const handle = (sid: string) => ({ remove: vi.fn(async () => (removed.push(sid), true)) })
  return { removed, incomingPhoneNumbers: vi.fn(handle), calls: vi.fn(handle), messages: vi.fn(handle) }
}

type Db = Omit<MemoryDb, 'rpc'> & {
  rpc: (fn: string, args: unknown) => Promise<{ data: unknown; error: null }>
  storage: { from: (bucket: string) => { list: (prefix: string, o?: { limit?: number; offset?: number }) => Promise<unknown>; remove: (paths: string[]) => Promise<unknown> } }
  auth: { admin: { updateUserById: ReturnType<typeof vi.fn>; getUserById: ReturnType<typeof vi.fn>; deleteUser: ReturnType<typeof vi.fn> } }
  files: Set<string>
}

function storageFake(files: Set<string>) {
  return {
    from: () => ({
      list: async (prefix: string, o: { limit?: number; offset?: number } = {}) => {
        const children = new Map<string, boolean>()
        for (const f of files) {
          if (!f.startsWith(`${prefix}/`)) continue
          const rest = f.slice(prefix.length + 1).split('/')
          children.set(rest[0], rest.length === 1 || children.get(rest[0]) === true)
        }
        const entries = [...children.entries()].map(([name, isFile]) => ({ name, id: isFile ? `id-${name}` : null }))
        const offset = o.offset ?? 0
        return { data: entries.slice(offset, offset + (o.limit ?? 100)), error: null }
      },
      remove: async (paths: string[]) => {
        for (const p of paths) files.delete(p)
        return { data: paths.map((name) => ({ name })), error: null }
      },
    }),
  }
}

function seed(): Db {
  const mem = memoryDb({
    organizations: [
      { id: ORG_A, user_id: USER_A, name: 'Smile Clinic', stripe_customer_id: 'cus_a', stripe_subscription_id: 'sub_plan_a', deletion_requested_at: null },
      { id: ORG_B, user_id: USER_B, name: 'Other Co', stripe_customer_id: 'cus_b', stripe_subscription_id: 'sub_plan_b', deletion_requested_at: null },
    ],
    agents: [
      { id: AGENT_A, org_id: ORG_A, is_active: true, elevenlabs_agent_id: 'agent_a1', pronunciation: { dictionary_id: 'dict_a' } },
      { id: AGENT_B, org_id: ORG_B, is_active: true, elevenlabs_agent_id: 'agent_b1', pronunciation: null },
    ],
    agent_provider_resources: [
      { id: 'res-a-el', org_id: ORG_A, agent_id: AGENT_A, provider: 'elevenlabs', external_id: 'agent_a1' },
      { id: 'res-a-ct', org_id: ORG_A, agent_id: AGENT_A, provider: 'cartesia', external_id: 'ct_a1' },
      { id: 'res-b-el', org_id: ORG_B, agent_id: AGENT_B, provider: 'elevenlabs', external_id: 'agent_b1' },
    ],
    phone_numbers: [
      { id: 'pn-a', org_id: ORG_A, number: '+40312345678', twilio_sid: PN_A, elevenlabs_phone_number_id: 'phn_a1', cartesia_phone_number_id: 'ctn_a1', stripe_subscription_id: 'sub_num_a', is_active: true },
      { id: 'pn-b', org_id: ORG_B, number: '+40312345999', twilio_sid: PN_B, elevenlabs_phone_number_id: 'phn_b1', cartesia_phone_number_id: null, stripe_subscription_id: 'sub_num_b', is_active: true },
    ],
    calls: [
      { id: 'call-a1', org_id: ORG_A, provider: 'elevenlabs', provider_call_id: 'conv_row_1', elevenlabs_conversation_id: 'conv_row_1', cartesia_call_id: null, twilio_call_sid: CA_A },
      { id: 'call-a2', org_id: ORG_A, provider: 'cartesia', provider_call_id: 'ct_call_1', elevenlabs_conversation_id: null, cartesia_call_id: 'ct_call_1', twilio_call_sid: null },
      { id: 'call-b1', org_id: ORG_B, provider: 'elevenlabs', provider_call_id: 'conv_b_1', elevenlabs_conversation_id: 'conv_b_1', cartesia_call_id: null, twilio_call_sid: null },
    ],
    sms_messages: [
      { id: 'sms-a1', org_id: ORG_A, twilio_sid: SM_A },
      { id: 'sms-b1', org_id: ORG_B, twilio_sid: `SM${hex('b')}` },
    ],
    provider_voices: [
      { id: 'pv-a', provider: 'elevenlabs', voice_id: 'VoiceAclone1', source: 'cloned', owner_org_id: ORG_A, status: 'ready' },
      { id: 'pv-a-designed', provider: 'elevenlabs', voice_id: 'VoiceAdesign1', source: 'designed', owner_org_id: ORG_A, status: 'ready' },
      { id: 'pv-lib', provider: 'elevenlabs', voice_id: 'LibraryVoice1', source: 'library', owner_org_id: null, status: 'ready' },
      { id: 'pv-b', provider: 'elevenlabs', voice_id: 'VoiceBclone1', source: 'cloned', owner_org_id: ORG_B, status: 'ready' },
    ],
    integrations: [
      { id: 'int-a', org_id: ORG_A, type: 'google_calendar', google_refresh_token: 'refresh-token-a', is_active: true },
      { id: 'int-b', org_id: ORG_B, type: 'google_calendar', google_refresh_token: 'refresh-token-b', is_active: true },
    ],
    invoices: [
      { id: 'inv-a1', org_id: ORG_A, smartbill_number: '1', amount: 49, issued_at: '2026-05-01T00:00:00Z' },
      { id: 'inv-a2', org_id: ORG_A, smartbill_number: '2', amount: 49, issued_at: '2026-06-01T00:00:00Z' },
      { id: 'inv-b1', org_id: ORG_B, smartbill_number: '3', amount: 99, issued_at: '2026-06-01T00:00:00Z' },
    ],
    usage_ledger: [{ id: 'u1', org_id: ORG_A, minutes: 3 }],
    knowledge_documents: [],
    account_deletions: [],
    account_deletion_items: [],
    invoices_archive: [],
    maintenance_state: [{ key: `conversation_sweep:${AGENT_A}`, last_run_at: '2026-10-01T00:00:00Z' }],
  })
  const files = new Set([`${ORG_A}/${AGENT_A}/menu.pdf`, `${ORG_A}/${AGENT_A}/faq.txt`, `${ORG_B}/${AGENT_B}/prices.pdf`])
  const db = mem as unknown as Db
  db.files = files
  db.storage = storageFake(files)
  db.auth = {
    admin: {
      updateUserById: vi.fn(async () => ({ data: { user: {} }, error: null })),
      getUserById: vi.fn(async (id: string) => ({ data: { user: { id, email: id === USER_A ? EMAIL_A : 'b@example.com' } }, error: null })),
      deleteUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
  }
  // archive_org_billing_records (migration 021): copies the org's invoices into the archive.
  db.rpc = (fn: string, args: unknown) => {
    db.rpcCalls.push({ fn, args })
    if (fn !== 'archive_org_billing_records') return Promise.resolve({ data: null, error: null })
    const orgId = (args as { p_org_id: string }).p_org_id
    const invoices = (db.tables.invoices ?? []).filter((i) => i.org_id === orgId)
    for (const inv of invoices) if (!db.tables.invoices_archive.some((a) => a.id === inv.id)) db.tables.invoices_archive.push({ ...inv, retain_until: '2036-12-31' })
    return Promise.resolve({ data: [{ invoices_total: invoices.length, invoices_archived: invoices.length, usage_months: 1 }], error: null })
  }
  return db
}

// ─── Provider HTTP ───────────────────────────────────────────────────────────

interface Seen { method: string; url: URL; body?: string }
let seen: Seen[]
let fetchMock: FetchMock
let overrides: Array<(s: Seen) => Response | null>

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const notFound = () => json({ detail: { status: 'not_found', message: 'not found' } }, 404)

function defaultRoute(s: Seen): Response {
  const p = s.url.pathname
  if (s.url.hostname === 'oauth2.googleapis.com') return new Response('', { status: 200 })
  if (s.url.hostname === 'api.cartesia.ai') {
    if (s.method === 'GET' && p === '/v1/agents/ct_a1') return json({ id: 'ct_a1', name: 'a', description: `ntv-agent:${AGENT_A}`, config: {} })
    if (s.method === 'GET' && p === '/agents/calls') {
      return json({ data: [{ id: 'ct_call_1', agent_id: 'ct_a1' }, { id: 'ct_call_2', agent_id: 'ct_a1' }, { id: 'ct_call_x', agent_id: 'ct_other' }], has_more: false })
    }
    if (s.method === 'DELETE') return new Response(null, { status: 204 })
  }
  if (s.url.hostname === 'api.elevenlabs.io') {
    if (s.method === 'GET' && p === '/v1/convai/phone-numbers/phn_a1') return json({ phone_number_id: 'phn_a1', phone_number: '+40312345678', label: `ntv:test:${ORG_A}` })
    if (s.method === 'DELETE' && p === '/v1/convai/phone-numbers/phn_a1') return notFound() // already gone: tolerated
    if (s.method === 'GET' && p === '/v1/convai/agents/agent_a1') return json({ agent_id: 'agent_a1', name: 'a', tags: ['ntv', `ntv-org:${ORG_A}`, `ntv-agent:${AGENT_A}`, 'ntv-env:test'], conversation_config: {} })
    if (s.method === 'DELETE' && p === '/v1/convai/agents/agent_a1') return new Response(null, { status: 204 })
    if (s.method === 'GET' && p === '/v1/convai/conversations') {
      if (s.url.searchParams.get('cursor') === 'c2') return json({ conversations: [{ agent_id: 'agent_a1', conversation_id: 'conv_list_2', status: 'done' }], has_more: false })
      return json({
        conversations: [
          { agent_id: 'agent_a1', conversation_id: 'conv_list_1', status: 'done' },
          // An item of another agent in the page is never collected.
          { agent_id: 'agent_b1', conversation_id: 'conv_b_leak', status: 'done' },
        ],
        has_more: true,
        next_cursor: 'c2',
      })
    }
    if (s.method === 'DELETE' && p === '/v1/convai/conversations/conv_row_1') return notFound() // already gone: tolerated
    if (s.method === 'DELETE' && p.startsWith('/v1/convai/conversations/')) return json({})
    if (s.method === 'DELETE' && p.startsWith('/v1/voices/')) return json({ status: 'ok' })
  }
  return json({ detail: 'unexpected route' }, 418)
}

function installRoutes() {
  seen = []
  overrides = []
  fetchMock = installFetch()
  fetchMock.mockImplementation(async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const s: Seen = { method: (init?.method ?? 'GET').toUpperCase(), url: new URL(href), body: typeof init?.body === 'string' ? init.body : undefined }
    seen.push(s)
    for (const o of overrides) {
      const r = o(s)
      if (r) return r
    }
    return defaultRoute(s)
  })
}

const calledPaths = () => seen.map((s) => `${s.method} ${s.url.hostname === 'api.elevenlabs.io' ? 'el' : s.url.hostname === 'api.cartesia.ai' ? 'ct' : 'google'}${s.url.pathname}`)

let db: Db
let stripe: ReturnType<typeof stripeFake>
let twilio: ReturnType<typeof twilioFake>

beforeEach(() => {
  vi.stubEnv('ELEVENLABS_API_KEY', 'test-el-key')
  vi.stubEnv('CARTESIA_API_KEY', 'test-cartesia-key')
  vi.stubEnv('ELEVENLABS_API_BASE_URL', '')
  db = seed()
  state.db = db
  stripe = stripeFake([
    { id: 'sub_plan_a', customer: 'cus_a', status: 'active', metadata: { org_id: ORG_A } },
    { id: 'sub_num_a', customer: 'cus_a', status: 'active', metadata: { type: 'phone_number' } },
    { id: 'sub_lost_a', customer: 'cus_a', status: 'past_due', metadata: {} },
    { id: 'sub_plan_b', customer: 'cus_b', status: 'active', metadata: { org_id: ORG_B } },
    { id: 'sub_num_b', customer: 'cus_b', status: 'active', metadata: { type: 'phone_number' } },
  ])
  state.stripe = stripe
  twilio = twilioFake()
  state.twilio = twilio
  state.kbCalls = []
  state.kbFailed = 0
  state.pronunciationCalls = []
  state.historyCalls = []
  state.emails = []
  installRoutes()
})

async function openJob(via: 'self_service' | 'admin' = 'self_service') {
  const { job } = await requestAccountDeletion({ orgId: ORG_A, requestedBy: USER_A, via })
  return job
}

const jobRow = (id: string) => db.tables.account_deletions.find((j) => j.id === id) as Record<string, unknown>

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('dry-run plan', () => {
  it('reports every step with counts for the organization only, and changes nothing', async () => {
    const plan = await planAccountDeletion(ORG_A, db as never)
    expect(plan.org_exists).toBe(true)
    expect(plan.steps.map((s) => s.step)).toEqual([...JOB_STEPS])
    const by = Object.fromEntries(plan.steps.map((s) => [s.step, s.counts]))
    expect(by.cancel_subscriptions).toEqual({ stored_subscriptions: 2, stripe_customer: 1 })
    expect(by.release_numbers).toMatchObject({ numbers: 1, twilio_numbers: 1, elevenlabs_imports: 1, cartesia_imports: 1 })
    expect(by.delete_agents).toEqual({ elevenlabs_agents: 1, cartesia_agents: 1 })
    expect(by.delete_voices).toEqual({ custom_voices: 2 })
    expect(by.revoke_google).toEqual({ grants: 1 })
    expect(by.delete_storage).toEqual({ top_level_entries: 1 })
    expect(plan.retained.find((r) => r.what === 'invoices')?.source_rows).toBe(2)
    expect(plan.never_touched.join(' ')).toMatch(/owner_org_id NULL/)
    // Counts and ids only: no names, numbers, emails or tokens.
    const text = JSON.stringify(plan)
    for (const pii of ['Smile Clinic', '+4031', EMAIL_A, 'refresh-token-a', 'cus_a']) expect(text).not.toContain(pii)
    // Nothing was written or called.
    expect(db.log.filter((l) => l.op !== 'select')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(db.tables.account_deletions).toHaveLength(0)
  })

  it('404 for an unknown organization without a deletion record', async () => {
    await expect(planAccountDeletion('cccccccc-cccc-4ccc-8ccc-cccccccccccc', db as never)).rejects.toMatchObject({ status: 404 })
  })
})

describe('request', () => {
  it('opens one job per organization and marks it as being deleted', async () => {
    const first = await requestAccountDeletion({ orgId: ORG_A, requestedBy: USER_A, via: 'self_service' })
    const second = await requestAccountDeletion({ orgId: ORG_A, requestedBy: USER_A, via: 'self_service' })
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.job.id).toBe(first.job.id)
    expect(db.tables.account_deletions).toHaveLength(1)
    expect(first.job).toMatchObject({ org_id: ORG_A, user_id: USER_A, requested_by: USER_A, requested_via: 'self_service', status: 'pending', step: 'block_activity' })
    expect(db.tables.organizations.find((o) => o.id === ORG_A)?.deletion_requested_at).toBeTruthy()
    expect(db.tables.organizations.find((o) => o.id === ORG_B)?.deletion_requested_at).toBeNull()
  })
})

describe('full run', () => {
  it('deletes everything of the organization in order, tolerates 404s, keeps the invoices and leaves a tombstone', async () => {
    const job = await openJob()
    const report = await runAccountDeletion(job.id, { budgetMs: 60_000 })
    expect(report).toMatchObject({ ran: true, outcome: 'completed', status: 'completed' })

    const row = jobRow(job.id)
    expect(row).toMatchObject({ status: 'completed', step: null, attempts: 0, last_error: null, state: {} })
    expect(Object.keys(row.counts as object)).toEqual([...JOB_STEPS])

    // Billing first: open checkout expired, plan + number + lost subscription cancelled; never org B's.
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_open_a')
    expect(stripe.subscriptions.cancel.mock.calls.map((c) => c[0]).sort()).toEqual(['sub_lost_a', 'sub_num_a', 'sub_plan_a'])
    expect(stripe.byId.get('sub_plan_b')?.status).toBe('active')
    expect(stripe.byId.get('sub_num_b')?.status).toBe('active')

    // Numbers: imports removed (404 = done), Twilio released, row forgotten.
    expect(calledPaths()).toEqual(expect.arrayContaining(['DELETE el/v1/convai/phone-numbers/phn_a1', 'DELETE ct/agents/phone-numbers/ctn_a1']))
    expect(twilio.removed).toContain(PN_A)
    expect(db.tables.phone_numbers.find((n) => n.id === 'pn-a')).toMatchObject({ twilio_sid: null, elevenlabs_phone_number_id: null, is_active: false })

    // Conversations listed while the agent existed, then the agent deleted, then the records.
    const paths = calledPaths()
    const listedAt = paths.indexOf('GET el/v1/convai/conversations')
    const agentDeletedAt = paths.indexOf('DELETE el/v1/convai/agents/agent_a1')
    const firstConvDelete = paths.findIndex((p) => p.startsWith('DELETE el/v1/convai/conversations/'))
    expect(listedAt).toBeGreaterThan(-1)
    expect(listedAt).toBeLessThan(agentDeletedAt)
    expect(agentDeletedAt).toBeLessThan(firstConvDelete)
    expect(seen.find((s) => s.url.pathname === '/v1/convai/conversations')?.url.searchParams.get('agent_id')).toBe('agent_a1')
    for (const id of ['conv_row_1', 'conv_list_1', 'conv_list_2']) expect(paths).toContain(`DELETE el/v1/convai/conversations/${id}`)
    for (const id of ['ct_call_1', 'ct_call_2']) expect(paths).toContain(`DELETE ct/agents/calls/${id}`)
    expect(paths).toContain('DELETE ct/v1/agents/ct_a1')
    expect(twilio.removed).toEqual(expect.arrayContaining([CA_A, SM_A]))
    expect((row.counts as Record<string, Record<string, number>>).delete_call_records).toMatchObject({ deleted: 6, already_gone: 1, gave_up: 0 })
    expect(db.tables.account_deletion_items).toHaveLength(0)
    expect(db.tables.agent_provider_resources.filter((r) => r.org_id === ORG_A)).toHaveLength(0)
    expect(db.tables.maintenance_state).toHaveLength(0)

    // Knowledge, pronunciation, own voices (+ history), Google, storage.
    expect(state.kbCalls).toEqual([ORG_A])
    expect(state.pronunciationCalls).toEqual([ORG_A])
    expect(paths).toEqual(expect.arrayContaining(['DELETE el/v1/voices/VoiceAclone1', 'DELETE el/v1/voices/VoiceAdesign1']))
    expect(state.historyCalls.sort()).toEqual(['VoiceAclone1', 'VoiceAdesign1'])
    const revoke = seen.filter((s) => s.url.hostname === 'oauth2.googleapis.com')
    expect(revoke).toHaveLength(1)
    expect(revoke[0].body).toBe('token=refresh-token-a')
    expect(db.tables.integrations.find((i) => i.id === 'int-a')).toMatchObject({ google_refresh_token: null, is_active: false })
    expect([...db.files]).toEqual([`${ORG_B}/${AGENT_B}/prices.pdf`])

    // Invoices archived before the organization row went; sign-in deleted last, confirmation sent.
    expect(db.tables.invoices_archive.map((i) => i.id).sort()).toEqual(['inv-a1', 'inv-a2'])
    expect(db.tables.organizations.map((o) => o.id)).toEqual([ORG_B])
    expect(db.auth.admin.updateUserById).toHaveBeenCalledWith(USER_A, { ban_duration: '876000h' })
    expect(db.auth.admin.deleteUser).toHaveBeenCalledWith(USER_A)
    expect(state.emails).toEqual([EMAIL_A])
  })

  it('never touches another organization or platform-wide resources (cross-tenant safety)', async () => {
    // A stored id that points at ANOTHER organization's agent (tagged ntv-org:B) is never listed or deleted.
    db.tables.agent_provider_resources.push({ id: 'res-a-bad', org_id: ORG_A, agent_id: AGENT_A, provider: 'elevenlabs', external_id: 'agent_b1' })
    overrides.push((s) =>
      s.method === 'GET' && s.url.pathname === '/v1/convai/agents/agent_b1'
        ? json({ agent_id: 'agent_b1', name: 'b', tags: ['ntv', `ntv-org:${ORG_B}`, `ntv-agent:${AGENT_B}`, 'ntv-env:test'], conversation_config: {} })
        : null,
    )
    const job = await openJob()
    expect((await runAccountDeletion(job.id, { budgetMs: 60_000 })).outcome).toBe('completed')

    const paths = calledPaths()
    const touchedB = paths.filter((p) => /agent_b1|phn_b1|conv_b_|VoiceBclone1|LibraryVoice1/.test(p) && !p.startsWith('GET el/v1/convai/agents/agent_b1'))
    expect(touchedB).toEqual([])
    expect(seen.filter((s) => s.url.searchParams.get('agent_id') === 'agent_b1')).toEqual([])
    expect(twilio.removed).not.toContain(PN_B)
    expect(twilio.removed).not.toContain(`SM${hex('b')}`)
    expect(paths).not.toContain('DELETE el/v1/convai/conversations/conv_b_leak')
    // Org B's rows are intact; the platform library voice too.
    expect(db.tables.organizations.find((o) => o.id === ORG_B)).toMatchObject({ deletion_requested_at: null })
    expect(db.tables.agents.find((a) => a.id === AGENT_B)).toMatchObject({ is_active: true })
    expect(db.tables.provider_voices.find((v) => v.id === 'pv-b')).toMatchObject({ status: 'ready' })
    expect(db.tables.provider_voices.find((v) => v.id === 'pv-lib')).toMatchObject({ status: 'ready' })
    expect(db.tables.integrations.find((i) => i.id === 'int-b')).toMatchObject({ google_refresh_token: 'refresh-token-b' })
    expect(db.tables.agent_provider_resources.find((r) => r.id === 'res-b-el')).toBeTruthy()
    expect(db.files.has(`${ORG_B}/${AGENT_B}/prices.pdf`)).toBe(true)
    expect(db.auth.admin.deleteUser).not.toHaveBeenCalledWith(USER_B)
    expect(state.kbCalls).toEqual([ORG_A])
    // The foreign reference is dropped and reported, the job still completes.
    const counts = jobRow(job.id).counts as Record<string, Record<string, number>>
    expect(counts.delete_agents.foreign_skipped).toBe(1)
  })
})

describe('another deployment sharing the workspace', () => {
  it('an agent or import tagged for another environment (copied database) is never listed nor deleted', async () => {
    overrides.push((s) => {
      if (s.method === 'GET' && s.url.pathname === '/v1/convai/agents/agent_a1') {
        return json({ agent_id: 'agent_a1', name: 'a', tags: ['ntv', `ntv-org:${ORG_A}`, `ntv-agent:${AGENT_A}`, 'ntv-env:production'], conversation_config: {} })
      }
      if (s.method === 'GET' && s.url.pathname === '/v1/convai/phone-numbers/phn_a1') return json({ phone_number_id: 'phn_a1', phone_number: '+40312345678', label: `ntv:production:${ORG_A}` })
      return null
    })
    const job = await openJob()
    expect((await runAccountDeletion(job.id, { budgetMs: 60_000 })).outcome).toBe('completed')
    const paths = calledPaths()
    expect(paths).not.toContain('DELETE el/v1/convai/agents/agent_a1')
    expect(paths).not.toContain('DELETE el/v1/convai/phone-numbers/phn_a1')
    expect(seen.some((s) => s.url.pathname === '/v1/convai/conversations' && s.method === 'GET')).toBe(false)
    const counts = jobRow(job.id).counts as Record<string, Record<string, number>>
    expect(counts.delete_agents.foreign_skipped).toBe(1)
    expect(counts.release_numbers.foreign_skipped).toBe(1)
  })
})

describe('resume after a failure in the middle', () => {
  it('records the failed step, retries it later from there without repeating earlier steps', async () => {
    let agentDeleteFails = true
    overrides.push((s) => (agentDeleteFails && s.method === 'DELETE' && s.url.pathname === '/v1/convai/agents/agent_a1' ? json({ detail: { status: 'invalid', message: 'x' } }, 422) : null))
    const job = await openJob()
    let now = Date.parse('2026-10-07T10:00:00Z')
    const first = await runAccountDeletion(job.id, { budgetMs: 60_000, now: () => now })
    expect(first).toMatchObject({ outcome: 'failed', status: 'pending', step: 'delete_agents' })
    const row = jobRow(job.id)
    expect(row).toMatchObject({ status: 'pending', step: 'delete_agents', attempts: 1, lease_owner: null })
    expect(String(row.last_error)).toMatch(/agent/)
    expect(Date.parse(String(row.next_attempt_at))).toBeGreaterThan(now)
    // Not due yet: the maintenance step leaves it alone.
    expect(await resumeAccountDeletions(createLoggerStub(), { now: () => now })).toMatchObject({ jobs: 0 })
    expect(db.tables.organizations.some((o) => o.id === ORG_A)).toBe(true)

    agentDeleteFails = false
    now += 5 * 60_000
    const resumed = await resumeAccountDeletions(createLoggerStub(), { now: () => now })
    expect(resumed).toMatchObject({ jobs: 1, completed: 1 })
    expect(jobRow(job.id)).toMatchObject({ status: 'completed', attempts: 0 })
    // Earlier steps ran once: billing, numbers and the listing were not repeated.
    expect(stripe.subscriptions.cancel).toHaveBeenCalledTimes(3)
    expect(twilio.incomingPhoneNumbers).toHaveBeenCalledTimes(1)
    expect(calledPaths().filter((p) => p === 'GET el/v1/convai/conversations')).toHaveLength(2) // two pages, listed once
    expect(db.auth.admin.deleteUser).toHaveBeenCalledTimes(1)
  })

  it('a call record that keeps failing is retried with backoff, then given up and counted (never blocks the erasure)', async () => {
    overrides.push((s) => (s.method === 'DELETE' && s.url.pathname === '/v1/convai/conversations/conv_list_2' ? json({ detail: { status: 'conflict', message: 'busy' } }, 409) : null))
    const job = await openJob()
    let now = Date.parse('2026-10-07T10:00:00Z')
    for (let i = 0; i < 8 && jobRow(job.id).status !== 'completed'; i++) {
      await runAccountDeletion(job.id, { budgetMs: 60_000, now: () => now })
      now += 3 * 3_600_000
    }
    expect(jobRow(job.id).status).toBe('completed')
    const counts = jobRow(job.id).counts as Record<string, Record<string, number>>
    expect(counts.delete_call_records).toMatchObject({ gave_up: 1 })
    expect(seen.filter((s) => s.method === 'DELETE' && s.url.pathname === '/v1/convai/conversations/conv_list_2')).toHaveLength(5)
  })

  it('a step failing MAX_STEP_ATTEMPTS times waits for an admin; an admin request reopens it', async () => {
    state.kbFailed = 2
    const job = await openJob()
    let now = Date.parse('2026-10-07T10:00:00Z')
    for (let i = 0; i < 10; i++) {
      await runAccountDeletion(job.id, { budgetMs: 60_000, now: () => now })
      now += 7 * 3_600_000
    }
    expect(jobRow(job.id)).toMatchObject({ status: 'needs_attention', step: 'delete_knowledge_copies', attempts: 8 })
    expect((await runAccountDeletion(job.id, { now: () => now })).ran).toBe(false)
    // Self-service does not reopen it; an admin does.
    expect((await requestAccountDeletion({ orgId: ORG_A, requestedBy: USER_A, via: 'self_service' })).reopened).toBe(false)
    state.kbFailed = 0
    const reopened = await requestAccountDeletion({ orgId: ORG_A, requestedBy: null, via: 'admin' })
    expect(reopened).toMatchObject({ reopened: true, created: false })
    expect((await runAccountDeletion(job.id, { now: () => now })).outcome).toBe('completed')
  })
})

describe('lease and time budget', () => {
  it('a second concurrent run does not start while the lease is held', async () => {
    const job = await openJob()
    const row = jobRow(job.id)
    row.lease_owner = 'someone-else'
    row.lease_until = new Date(Date.now() + 60_000).toISOString()
    row.status = 'running'
    expect(await runAccountDeletion(job.id)).toEqual({ jobId: job.id, ran: false })
    expect(fetchMock).not.toHaveBeenCalled()
    // An expired lease (crashed run) is taken over.
    row.lease_until = new Date(Date.now() - 1).toISOString()
    expect((await runAccountDeletion(job.id, { budgetMs: 60_000 })).outcome).toBe('completed')
  })

  it('stops at the deadline and resumes from the saved step', async () => {
    const job = await openJob()
    let now = Date.parse('2026-10-07T10:00:00Z')
    // Every step "takes" 10 s: a 25 s budget runs three steps.
    const tick = () => (now += 10_000)
    const first = await runAccountDeletion(job.id, { budgetMs: 25_000, now: () => { const t = now; tick(); return t } })
    expect(first.outcome).toBe('yield')
    expect(JOB_STEPS.indexOf(jobRow(job.id).step as never)).toBeGreaterThan(0)
    expect(jobRow(job.id).status).toBe('pending')
    const second = await runAccountDeletion(job.id, { budgetMs: 3_600_000 })
    expect(second.outcome).toBe('completed')
    expect(stripe.subscriptions.cancel).toHaveBeenCalledTimes(3)
  })
})

describe('plan constants', () => {
  it('billing is the first deletion step and the sign-in the last (quoted by the marketing pages)', () => {
    expect(DELETION_ORDER[0]).toBe('cancel_subscriptions')
    expect(DELETION_ORDER.at(-1)).toBe('delete_auth_user')
  })
})

function createLoggerStub() {
  const noop = () => {}
  const log = { debug: noop, info: noop, warn: noop, error: noop, child: () => log, context: {} }
  return log
}
