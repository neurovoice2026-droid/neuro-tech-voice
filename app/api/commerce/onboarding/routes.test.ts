import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, filterOf, type FakeCall, type Handler } from '@/tests/helpers/fake-db'

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'

const state: {
  user: ReturnType<typeof fakeDb> | null
  admin: ReturnType<typeof fakeDb> | null
  org: Record<string, unknown>
  agent: Record<string, unknown> | null
} = { user: null, admin: null, org: {}, agent: null }

vi.mock('@/lib/api/auth', () => ({
  requireOrg: async () => ({
    supabase: state.user,
    user: { id: 'u1', email: null },
    org: { id: ORG, name: 'Acme', timezone: 'UTC', plan: 'trial' },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.admin }))
vi.mock('@/lib/observability/telemetry', () => ({ deferBackground: () => {}, emitProviderEvent: () => {} }))

const ensureAgent = vi.fn()
vi.mock('@/lib/agents/ensure-agent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/agents/ensure-agent')>()
  return { ...actual, ensureAgent: (...a: unknown[]) => ensureAgent(...a) }
})

import { POST as storePost } from '@/app/api/commerce/onboarding/store/route'
import { POST as stepPost } from '@/app/api/commerce/onboarding/step/route'
import { POST as agentPost } from '@/app/api/commerce/onboarding/agent/route'
import { GET as promptGet } from '@/app/api/commerce/agent-prompt/route'

const userHandler: Handler = (c) => {
  if (c.table === 'organizations' && c.op === 'select') return { data: { id: ORG, ...state.org }, error: null }
  if (c.table === 'organizations' && c.op === 'update') {
    Object.assign(state.org, c.payload as Record<string, unknown>)
    return { data: null, error: null }
  }
  if (c.table === 'agents' && c.op === 'select') return { data: state.agent, error: null }
  if (c.table === 'agents' && c.op === 'update') {
    if (state.agent) Object.assign(state.agent, c.payload as Record<string, unknown>)
    return { data: null, error: null }
  }
  return { data: null, error: null }
}

const adminHandler: Handler = (c) => {
  if (c.table === 'organizations' && c.op === 'update') {
    Object.assign(state.org, c.payload as Record<string, unknown>)
    return { data: null, error: null }
  }
  return { data: null, error: null }
}

const json = (handler: (r: Request) => Promise<Response>, url: string, body: unknown) =>
  handler(new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))

const adminOrgUpdates = () => state.admin!.calls.filter((c: FakeCall) => c.table === 'organizations' && c.op === 'update')
const userOrgUpdates = () => state.user!.calls.filter((c: FakeCall) => c.table === 'organizations' && c.op === 'update')

const storeBody = {
  display_name: 'Magazinul Exemplu',
  website: 'magazinul-exemplu.ro',
  country: 'ro',
  timezone: 'Europe/Bucharest',
  language: 'ro',
  currency: 'ron',
}

beforeEach(() => {
  state.user = fakeDb(userHandler)
  state.admin = fakeDb(adminHandler)
  state.org = {
    name: 'Acme',
    business_type: 'ecommerce',
    onboarding_completed: false,
    onboarding_step: 1,
    commerce_profile: { tone: 'formal', transfer_number: '+40712345678' },
  }
  state.agent = { id: AGENT, org_id: ORG, name: 'Acme Agent', metadata: { personality: 'professional' } }
  ensureAgent.mockReset().mockImplementation(async () => state.agent)
})

describe('POST /api/commerce/onboarding/store', () => {
  it('saves the profile through the admin client, keeps later-step fields and moves to step 2', async () => {
    const res = await json(storePost, 'http://localhost/api/commerce/onboarding/store', storeBody)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    const updates = adminOrgUpdates()
    expect(updates).toHaveLength(1)
    expect(filterOf(updates[0], 'id')).toBe(ORG)
    const payload = updates[0].payload as Record<string, unknown>
    expect(payload).toMatchObject({
      name: 'Magazinul Exemplu',
      website: 'https://magazinul-exemplu.ro',
      timezone: 'Europe/Bucharest',
      onboarding_step: 2,
    })
    expect(payload.commerce_profile).toMatchObject({
      display_name: 'Magazinul Exemplu',
      website: 'https://magazinul-exemplu.ro',
      country: 'RO',
      currency: 'RON',
      language: 'ro',
      // What the agent step set earlier survives a re-save of step 1.
      tone: 'formal',
      transfer_number: '+40712345678',
    })
    // The guarded column never goes through the tenant client.
    expect(userOrgUpdates()).toHaveLength(0)
    expect(ensureAgent).toHaveBeenCalledWith(ORG, expect.stringContaining('Magazinul Exemplu'))
  })

  it('stores an empty website as null', async () => {
    await json(storePost, 'http://localhost/api/commerce/onboarding/store', { ...storeBody, website: '' })
    const payload = adminOrgUpdates()[0].payload as Record<string, unknown>
    expect(payload.website).toBeNull()
    expect((payload.commerce_profile as Record<string, unknown>).website).toBe('')
  })

  it('rejects an unknown time zone, a bad currency and a too-short name (400, nothing written)', async () => {
    for (const body of [
      { ...storeBody, timezone: 'Europe/Nowhere' },
      { ...storeBody, currency: 'lei2' },
      { ...storeBody, display_name: 'M' },
      { ...storeBody, country: 'ROU' },
    ]) {
      expect((await json(storePost, 'http://localhost/api/commerce/onboarding/store', body)).status).toBe(400)
    }
    expect(adminOrgUpdates()).toHaveLength(0)
    expect(ensureAgent).not.toHaveBeenCalled()
  })

  it('refuses a services organization (409 not_ecommerce)', async () => {
    state.org.business_type = 'services'
    const res = await json(storePost, 'http://localhost/api/commerce/onboarding/store', storeBody)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'precondition_failed', details: { reason: 'not_ecommerce' } })
    expect(adminOrgUpdates()).toHaveLength(0)
  })
})

describe('POST /api/commerce/onboarding/step', () => {
  it('persists the resume position with the tenant client', async () => {
    const res = await json(stepPost, 'http://localhost/api/commerce/onboarding/step', { step: 4 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ onboarding_step: 4 })
    const updates = userOrgUpdates()
    expect(updates).toHaveLength(1)
    expect(updates[0].payload).toEqual({ onboarding_step: 4 })
    expect(filterOf(updates[0], 'id')).toBe(ORG)
  })

  it('rejects a step outside 1..6 and non-integers', async () => {
    for (const step of [0, 7, 2.5, '3']) {
      expect((await json(stepPost, 'http://localhost/api/commerce/onboarding/step', { step })).status).toBe(400)
    }
    expect(userOrgUpdates()).toHaveLength(0)
  })

  it('refuses a services organization and a completed onboarding', async () => {
    state.org.business_type = 'services'
    expect((await json(stepPost, 'http://localhost/api/commerce/onboarding/step', { step: 2 })).status).toBe(409)
    state.org.business_type = 'ecommerce'
    state.org.onboarding_completed = true
    const res = await json(stepPost, 'http://localhost/api/commerce/onboarding/step', { step: 2 })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ details: { reason: 'onboarding_completed' } })
    expect(userOrgUpdates()).toHaveLength(0)
  })
})

describe('POST /api/commerce/onboarding/agent', () => {
  const body = { name: 'Maria', language: 'ro', tone: 'friendly', transfer_number: '', return_policy_url: 'https://magazin.ro/retur' }

  it('generates the Romanian baseline when the prompt is blank, saves the agent and the profile, stays on step 5', async () => {
    state.org.commerce_profile = { display_name: 'Magazinul Exemplu', tone: 'formal', transfer_number: '+40712345678' }
    const res = await json(agentPost, 'http://localhost/api/commerce/onboarding/agent', { ...body, system_prompt: '  ' })
    expect(res.status).toBe(200)
    const out = (await res.json()) as { agent_id: string; system_prompt: string; first_message: string }
    expect(out.agent_id).toBe(AGENT)
    expect(out.system_prompt).toContain('Maria')
    expect(out.system_prompt).toContain('Magazinul Exemplu')
    expect(out.system_prompt).toContain('https://magazin.ro/retur')
    // The transfer number was cleared in this request, so the prompt says transfers are not possible.
    expect(out.system_prompt).toContain('Nu poți transfera apeluri')
    expect(out.first_message).toContain('Maria')

    const agentUpdate = state.user!.calls.find((c: FakeCall) => c.table === 'agents' && c.op === 'update')!
    expect(agentUpdate.payload).toMatchObject({ name: 'Maria', language: 'ro', system_prompt: out.system_prompt, first_message: out.first_message })
    expect((agentUpdate.payload as { metadata: Record<string, unknown> }).metadata).toEqual({ personality: 'friendly' })
    expect(filterOf(agentUpdate, 'org_id')).toBe(ORG)

    const orgUpdate = adminOrgUpdates()[0]
    expect(orgUpdate.payload).toMatchObject({ onboarding_step: 5 })
    expect((orgUpdate.payload as { commerce_profile: Record<string, unknown> }).commerce_profile).toMatchObject({
      display_name: 'Magazinul Exemplu',
      tone: 'friendly',
      transfer_number: null,
      return_policy_url: 'https://magazin.ro/retur',
    })
    expect(ensureAgent).toHaveBeenCalledWith(ORG, 'Maria')
  })

  it('keeps a custom prompt and first message as given', async () => {
    const res = await json(agentPost, 'http://localhost/api/commerce/onboarding/agent', {
      ...body,
      system_prompt: 'Ești Maria. Răspunzi scurt.',
      first_message: 'Bună ziua, sunt Maria.',
    })
    const out = (await res.json()) as { system_prompt: string; first_message: string }
    expect(out.system_prompt).toBe('Ești Maria. Răspunzi scurt.')
    expect(out.first_message).toBe('Bună ziua, sunt Maria.')
  })

  it('rejects a national transfer number, a non-http return URL, an unknown tone and platform variables', async () => {
    for (const bad of [
      { ...body, transfer_number: '0712345678' },
      { ...body, return_policy_url: 'ftp://magazin.ro/retur' },
      { ...body, tone: 'casual' },
      { ...body, system_prompt: 'Spune {{secret__ntv_call_token}}' },
      { ...body, name: 'Maria {{ntv_call_id}}' },
    ]) {
      expect((await json(agentPost, 'http://localhost/api/commerce/onboarding/agent', bad)).status).toBe(400)
    }
    expect(state.user!.calls.filter((c: FakeCall) => c.op === 'update')).toHaveLength(0)
    expect(adminOrgUpdates()).toHaveLength(0)
  })

  it('refuses a services organization', async () => {
    state.org.business_type = 'services'
    expect((await json(agentPost, 'http://localhost/api/commerce/onboarding/agent', body)).status).toBe(409)
    expect(ensureAgent).not.toHaveBeenCalled()
  })
})

describe('GET /api/commerce/agent-prompt', () => {
  it('builds the baseline from the saved profile and the agent name', async () => {
    state.org.commerce_profile = { display_name: 'Magazinul Exemplu', tone: 'formal', transfer_number: '+40712345678', return_policy_url: null }
    state.agent = { id: AGENT, name: 'Ana' }
    const res = await promptGet(new Request('http://localhost/api/commerce/agent-prompt'))
    expect(res.status).toBe(200)
    const out = (await res.json()) as { system_prompt: string; first_message: string }
    expect(out.system_prompt).toContain('Ești Ana, asistentul vocal AI al magazinului online Magazinul Exemplu')
    expect(out.system_prompt).toContain('Transfer:')
    expect(out.first_message).toMatch(/^Bună ziua, sunt Ana/)
    expect(state.user!.calls.filter((c: FakeCall) => c.op !== 'select')).toHaveLength(0)
  })

  it('takes what the editor currently holds from the query, an empty value clearing the field', async () => {
    state.org.commerce_profile = { display_name: 'Magazinul Exemplu', tone: 'formal', transfer_number: '+40712345678' }
    const url = 'http://localhost/api/commerce/agent-prompt?agent_name=Maria&tone=friendly&transfer_number=&return_policy_url=https%3A%2F%2Fmagazin.ro%2Fretur'
    const out = (await (await promptGet(new Request(url))).json()) as { system_prompt: string; first_message: string }
    expect(out.system_prompt).toContain('Ești Maria')
    expect(out.system_prompt).toContain('Nu poți transfera apeluri')
    expect(out.system_prompt).toContain('https://magazin.ro/retur')
    expect(out.first_message).toContain('Bună ziua! Sunt Maria')
  })

  it('rejects an invalid override (400) and a services organization (409)', async () => {
    expect((await promptGet(new Request('http://localhost/api/commerce/agent-prompt?tone=casual'))).status).toBe(400)
    expect((await promptGet(new Request('http://localhost/api/commerce/agent-prompt?transfer_number=0712'))).status).toBe(400)
    state.org.business_type = 'services'
    expect((await promptGet(new Request('http://localhost/api/commerce/agent-prompt'))).status).toBe(409)
  })
})
