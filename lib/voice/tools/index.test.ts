import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToolRequest } from '@/lib/voice/contracts'
import type { ToolContact, ToolContext } from '@/lib/voice/tools/runtime'
import { entitlementsFor } from '@/lib/billing/entitlements'

// runVoiceTool end to end with the database, KV, Twilio and knowledge search
// replaced by in-memory fakes: dispatch, gating, dedupe, actions, logging.

const kv = new Map<string, unknown>()
vi.mock('@/lib/kv', () => ({
  kvGet: vi.fn(async (key: string) => (kv.has(key) ? kv.get(key) : null)),
  kvSet: vi.fn(async (key: string, value: unknown) => {
    kv.set(key, value)
  }),
  kvIncr: vi.fn(async (key: string) => {
    const next = ((kv.get(key) as number | undefined) ?? 0) + 1
    kv.set(key, next)
    return next
  }),
  kvDel: vi.fn(async (key: string) => {
    kv.delete(key)
  }),
}))

const sendSms = vi.fn()
vi.mock('@/lib/twilio/sms', () => ({ sendSms: (...args: unknown[]) => sendSms(...args) }))

const searchKnowledge = vi.fn()
vi.mock('@/lib/knowledge/search', () => ({ searchKnowledge: (...args: unknown[]) => searchKnowledge(...args) }))

const notifyContacts = vi.fn()
vi.mock('@/lib/notifications', () => ({ notifyContacts: (...args: unknown[]) => notifyContacts(...args) }))

vi.mock('@/lib/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/env')>()),
  isOpenAIConfigured: () => true,
}))

const loadToolContext = vi.fn()
const loadContacts = vi.fn()
vi.mock('@/lib/voice/tools/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/voice/tools/runtime')>()),
  loadToolContext: (...args: unknown[]) => loadToolContext(...args),
  loadContacts: (...args: unknown[]) => loadContacts(...args),
}))

const { runVoiceTool } = await import('@/lib/voice/tools')

const CALL_ID = '11111111-1111-4111-8111-111111111111'
const ORG_ID = '22222222-2222-4222-8222-222222222222'

/** Records inserts and updates; every query resolves successfully. */
function fakeAdmin() {
  const writes: { table: string; op: string; values: unknown }[] = []
  const from = (table: string) => {
    const result = { data: { id: 'row-1' }, error: null }
    const chain: Record<string, unknown> = {}
    const passthrough = () => chain
    for (const method of ['select', 'eq', 'in', 'order', 'limit', 'abortSignal', 'is', 'not', 'gt', 'lt', 'gte']) chain[method] = passthrough
    chain.single = async () => result
    chain.maybeSingle = async () => result
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve)
    chain.insert = (values: unknown) => {
      writes.push({ table, op: 'insert', values })
      return chain
    }
    chain.update = (values: unknown) => {
      writes.push({ table, op: 'update', values })
      return chain
    }
    return chain
  }
  return { client: { from }, writes }
}

function context(overrides: Partial<ToolContext> = {}): { ctx: ToolContext; writes: ReturnType<typeof fakeAdmin>['writes'] } {
  const admin = fakeAdmin()
  const ctx = {
    request: {} as ToolRequest,
    call: {
      id: CALL_ID,
      org_id: ORG_ID,
      agent_id: 'agent-1',
      direction: 'inbound',
      from_number: '+40712345678',
      to_number: '+40219999999',
      caller_number: '+40712345678',
      is_test: false,
      status: 'in-progress',
      twilio_call_sid: 'CA123',
      extracted: {},
      ended_at: null,
    },
    org: { id: ORG_ID, name: 'Acme Dental', timezone: 'Europe/Bucharest', plan: 'pro', sms_enabled: true },
    agent: { id: 'agent-1', name: 'Ana', language: 'ro', lead_fields: [], working_hours: null },
    language: 'ro',
    timezone: 'Europe/Bucharest',
    businessName: 'Acme Dental',
    callerPhone: '+40712345678',
    entitlements: entitlementsFor('pro'),
    now: new Date('2026-09-17T09:00:00Z'),
    signal: new AbortController().signal,
    defer: () => undefined,
    admin: admin.client,
    ...overrides,
  } as unknown as ToolContext
  return { ctx, writes: admin.writes }
}

function request(name: string, args: Record<string, unknown> = {}, toolCallId = `tc-${Math.random()}`): ToolRequest {
  return { session_id: CALL_ID, call_id: CALL_ID, tool_call_id: toolCallId, name: name as ToolRequest['name'], arguments: args }
}

const contacts: ToolContact[] = [
  { id: 'c1', name: 'Maria Popescu', role: 'Manager', phone: '+40722000111', email: 'maria@example.com', transfer_enabled: true, notify_sms: false, notify_email: true, is_on_call: false, sort_order: 0 },
  { id: 'c2', name: 'Dan Ionescu', role: 'Tehnician', phone: '+40722000222', email: null, transfer_enabled: true, notify_sms: true, notify_email: false, is_on_call: true, sort_order: 1 },
]

beforeEach(() => {
  kv.clear()
  sendSms.mockReset()
  searchKnowledge.mockReset()
  notifyContacts.mockReset()
  loadToolContext.mockReset()
  loadContacts.mockReset()
})

describe('runVoiceTool', () => {
  it('ends the call with an action and logs the invocation', async () => {
    const { ctx, writes } = context()
    loadToolContext.mockResolvedValue(ctx)
    const res = await runVoiceTool(request('end_call', { reason: 'caller said goodbye' }))
    expect(res.ok).toBe(true)
    expect(res.action).toEqual({ type: 'end_call', reason: 'caller said goodbye' })
    const log = writes.find((w) => w.table === 'tool_invocations')
    expect(log?.values).toMatchObject({ org_id: ORG_ID, call_id: CALL_ID, tool_name: 'end_call', ok: true })
  })

  it('accepts Cartesia-prefixed tool names', async () => {
    loadToolContext.mockResolvedValue(context().ctx)
    const res = await runVoiceTool(request('ntv_end_call', { reason: 'done' }))
    expect(res.action?.type).toBe('end_call')
  })

  it('answers unknown tools without throwing', async () => {
    const res = await runVoiceTool(request('launch_rocket'))
    expect(res).toMatchObject({ ok: false, action: null })
    expect(loadToolContext).not.toHaveBeenCalled()
  })

  it('refuses politely when the call is over or missing', async () => {
    loadToolContext.mockResolvedValue({ kind: 'ended' })
    expect((await runVoiceTool(request('end_call'))).ok).toBe(false)
    loadToolContext.mockRejectedValue(new Error('db down'))
    const res = await runVoiceTool(request('end_call'))
    expect(res.ok).toBe(false)
    expect(res.result).toMatch(/technical problem/)
  })

  it('transfers only to an allowed contact, announcing them in the agent language', async () => {
    loadToolContext.mockResolvedValue(context().ctx)
    loadContacts.mockResolvedValue(contacts)
    const res = await runVoiceTool(request('transfer_call', { reason: 'wants accounts', contact: 'contabilul' }))
    expect(res.ok).toBe(true)
    // Nobody in the team is the accountant, so the on-call contact takes the call.
    expect(res.action).toEqual({
      type: 'transfer',
      to_e164: '+40722000222',
      announce: 'Vă rog să rămâneți la telefon, vă fac legătura cu Dan Ionescu.',
    })
    const named = await runVoiceTool(request('transfer_call', { reason: 'asked for the manager', contact: 'managerul' }))
    expect(named.action).toMatchObject({ type: 'transfer', to_e164: '+40722000111' })
  })

  it('does not transfer browser test calls', async () => {
    const { ctx } = context()
    loadToolContext.mockResolvedValue({ ...ctx, call: { ...ctx.call, twilio_call_sid: null } })
    loadContacts.mockResolvedValue(contacts)
    const res = await runVoiceTool(request('transfer_call', { reason: 'test', contact: null }))
    expect(res.ok).toBe(false)
    expect(res.action).toBeNull()
    expect(res.result).toContain('Dan Ionescu')
  })

  it('offers a message when nobody can take a transfer', async () => {
    loadToolContext.mockResolvedValue(context().ctx)
    loadContacts.mockResolvedValue(contacts.map((c) => ({ ...c, transfer_enabled: false })))
    const res = await runVoiceTool(request('transfer_call', { reason: 'x', contact: 'Maria' }))
    expect(res.ok).toBe(false)
    expect(res.result).toMatch(/take a message/)
  })

  it('texts only the caller, at most twice per call, and deduplicates retries', async () => {
    loadToolContext.mockResolvedValue(context().ctx)
    sendSms.mockResolvedValue({ ok: true, sid: 'SM1' })

    const first = await runVoiceTool(request('send_sms', { message: 'Adresa: Str. Lungă 5' }, 'sms-1'))
    const retry = await runVoiceTool(request('send_sms', { message: 'Adresa: Str. Lungă 5' }, 'sms-1'))
    expect(first.ok).toBe(true)
    expect(retry).toEqual(first)
    expect(sendSms).toHaveBeenCalledTimes(1)
    expect(sendSms.mock.calls[0][0]).toMatchObject({ orgId: ORG_ID, to: '+40712345678', kind: 'custom', callId: CALL_ID, body: 'Acme Dental: Adresa: Str. Lungă 5' })

    await runVoiceTool(request('send_sms', { message: 'Program: 9-17' }, 'sms-2'))
    const third = await runVoiceTool(request('send_sms', { message: 'One more' }, 'sms-3'))
    expect(sendSms).toHaveBeenCalledTimes(2)
    expect(third.ok).toBe(false)
    expect(third.result).toMatch(/limit of 2 texts/)
  })

  it('refuses to text links to other websites (spoofed caller id phishing, SEC-12)', async () => {
    const { ctx } = context()
    loadToolContext.mockResolvedValue({ ...ctx, org: { ...ctx.org, website: 'https://acmedental.ro' } })
    sendSms.mockResolvedValue({ ok: true, sid: 'SM1' })
    const phishing = await runVoiceTool(request('send_sms', { message: 'Confirm your card at https://acme-dental-pay.com/login' }, 'sms-link-1'))
    expect(phishing.ok).toBe(false)
    expect(phishing.result).toMatch(/only link to this business/)
    expect(sendSms).not.toHaveBeenCalled()
    const own = await runVoiceTool(request('send_sms', { message: 'Book at https://acmedental.ro/book' }, 'sms-link-2'))
    expect(own.ok).toBe(true)
    expect(sendSms).toHaveBeenCalledTimes(1)
  })

  it('gates texts and bookings by plan and settings', async () => {
    const { ctx } = context()
    loadToolContext.mockResolvedValue({ ...ctx, entitlements: entitlementsFor('trial') })
    const sms = await runVoiceTool(request('send_sms', { message: 'hi' }))
    expect(sms.ok).toBe(false)
    expect(sendSms).not.toHaveBeenCalled()
    const booking = await runVoiceTool(
      request('book_appointment', { start: '2026-09-18T10:00:00+03:00', caller_name: 'Ion', service: null, notes: null, send_sms_confirmation: false })
    )
    expect(booking.ok).toBe(false)
    expect(booking.result).toMatch(/isn't included in this business's plan/)
  })

  it('tells the model which arguments are missing', async () => {
    loadToolContext.mockResolvedValue(context().ctx)
    const res = await runVoiceTool(request('book_appointment', { start: '2026-09-18T10:00:00+03:00' }))
    expect(res.ok).toBe(false)
    expect(res.result).toContain('caller_name is missing')
  })

  it('returns knowledge passages with their sources, within 4 KiB', async () => {
    loadToolContext.mockResolvedValue(context().ctx)
    searchKnowledge.mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => ({
        document_id: `d${i}`,
        document_name: `Prices ${i}`,
        chunk_id: `k${i}`,
        excerpt: 'Cleaning costs…',
        similarity: 0.8 - i / 10,
        content: `Cleaning costs 200 lei. ${'Details. '.repeat(180)}`,
      }))
    )
    const res = await runVoiceTool(request('search_knowledge', { query: 'price of a cleaning' }))
    expect(res.ok).toBe(true)
    expect(new TextEncoder().encode(res.result).length).toBeLessThanOrEqual(4096)
    expect(res.result).toContain('Prices 0')
    expect(res.sources?.length).toBeGreaterThan(0)
    expect(res.sources?.[0]).toEqual({ document_id: 'd0', document_name: 'Prices 0', chunk_id: 'k0', excerpt: 'Cleaning costs…', similarity: 0.8 })
    expect(searchKnowledge).toHaveBeenCalledWith({ orgId: ORG_ID, agentId: 'agent-1', query: 'price of a cleaning', matchCount: 4 })
  })

  it('saves lead details into the call', async () => {
    const { ctx, writes } = context()
    loadToolContext.mockResolvedValue(ctx)
    const res = await runVoiceTool(request('save_lead_details', { name: 'Ion Pop', email: 'ion at example dot com', need: 'implant', budget: null, timing: 'next month', notes: null }))
    expect(res.ok).toBe(true)
    expect(writes.find((w) => w.table === 'calls')?.values).toEqual({
      extracted: { name: 'Ion Pop', email: 'ion@example.com', need: 'implant', timing: 'next month' },
    })
  })

  it('answers slow tools on time and logs how they really ended', async () => {
    const { ctx, writes } = context()
    loadToolContext.mockResolvedValue(ctx)
    loadContacts.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60))
      return contacts
    })
    const deferred: (() => Promise<unknown>)[] = []
    const args = { recipient: 'Maria', caller_name: 'Ion', callback_number: null, message: 'Call me back', urgency: 'normal' }
    const res = await runVoiceTool(request('take_message', args, 'slow-1'), {
      defer: (task) => deferred.push(task),
      responseDeadlineMs: 10,
    })
    expect(res.ok).toBe(false)
    expect(res.result).toMatch(/taking longer than expected/)
    expect(writes.some((w) => w.table === 'tool_invocations')).toBe(false)

    await Promise.all(deferred.map((task) => task()))
    // The message was saved in the background, and the log says so.
    expect(writes.find((w) => w.table === 'agent_messages')).toBeDefined()
    expect(writes.find((w) => w.table === 'tool_invocations')?.values).toMatchObject({ tool_name: 'take_message', ok: true })
    // A retry of the same tool call gets the answer the model already heard.
    expect(await runVoiceTool(request('take_message', args, 'slow-1'))).toEqual(res)
  })

  it('alerts the team only when delivery worked, labels test calls and caps alerts per call', async () => {
    const { ctx, writes } = context()
    loadToolContext.mockResolvedValue({ ...ctx, call: { ...ctx.call, is_test: true } })
    notifyContacts.mockResolvedValue({ delivered: true, smsSent: 1, emailsSent: 0, failures: 0, notifiedContactIds: ['c2'], ownerFallback: false })

    const first = await runVoiceTool(request('notify_team', { summary: 'Water leak in the basement', urgency: 'urgent' }))
    expect(first.ok).toBe(true)
    expect(writes.find((w) => w.table === 'agent_messages' && w.op === 'insert')?.values).toMatchObject({ body: 'Water leak in the basement', urgency: 'urgent' })
    expect(writes.find((w) => w.table === 'agent_messages' && w.op === 'update')?.values).toMatchObject({ status: 'notified' })
    const sent = notifyContacts.mock.calls[0][0]
    expect(sent.subject).toMatch(/^Test call: /)
    expect(sent.smsBody).toContain('[TEST] Water leak')

    notifyContacts.mockResolvedValue({ delivered: false, smsSent: 0, emailsSent: 0, failures: 1, notifiedContactIds: [], ownerFallback: false })
    const undelivered = await runVoiceTool(request('notify_team', { summary: 'Still leaking', urgency: 'urgent' }))
    expect(undelivered.ok).toBe(false)
    expect(undelivered.result).toMatch(/couldn't be delivered/)

    await runVoiceTool(request('notify_team', { summary: 'Third', urgency: 'normal' }))
    const fourth = await runVoiceTool(request('notify_team', { summary: 'Fourth', urgency: 'urgent' }))
    expect(fourth.ok).toBe(false)
    expect(fourth.result).toMatch(/already been alerted/)
    expect(notifyContacts).toHaveBeenCalledTimes(3)
  })

  it('keeps saving messages past the per-call limit, without notifying the team again', async () => {
    const notified: string[] = []
    const { ctx, writes } = context()
    loadToolContext.mockResolvedValue({ ...ctx, defer: () => notified.push('notify') })
    loadContacts.mockResolvedValue(contacts)
    const results = []
    for (let i = 0; i < 6; i += 1) {
      results.push(await runVoiceTool(request('take_message', { recipient: null, caller_name: 'Ion', callback_number: null, message: `Message ${i}`, urgency: 'normal' })))
    }
    expect(results.every((r) => r.ok)).toBe(true)
    expect(writes.filter((w) => w.table === 'agent_messages' && w.op === 'insert')).toHaveLength(6)
    expect(notified).toHaveLength(5)
    expect(results[5].result).toContain('inbox')
  })

  it('never reports a late transfer as done', async () => {
    const { ctx, writes } = context()
    loadToolContext.mockResolvedValue(ctx)
    loadContacts.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60))
      return contacts
    })
    const deferred: (() => Promise<unknown>)[] = []
    const res = await runVoiceTool(request('transfer_call', { reason: 'wants a person', contact: 'Maria' }), {
      defer: (task) => deferred.push(task),
      responseDeadlineMs: 10,
    })
    expect(res).toMatchObject({ ok: false, action: null })
    expect(res.result).toMatch(/not transferred/)
    await Promise.all(deferred.map((task) => task()))
    expect(writes.find((w) => w.table === 'tool_invocations')?.values).toMatchObject({ tool_name: 'transfer_call', ok: false })
  })

  it('saves a message before notifying the team in the background', async () => {
    const deferred: (() => Promise<unknown>)[] = []
    const { ctx, writes } = context()
    loadToolContext.mockResolvedValue({ ...ctx, defer: (task: () => Promise<unknown>) => deferred.push(task) })
    loadContacts.mockResolvedValue(contacts)
    const res = await runVoiceTool(
      request('take_message', { recipient: 'Maria', caller_name: 'Ion', callback_number: null, message: 'Please call me about my bill', urgency: 'normal' }),
      { defer: (task) => deferred.push(task) }
    )
    expect(res.ok).toBe(true)
    expect(res.result).toContain('for Maria Popescu')
    expect(res.result).toContain('5678')
    expect(writes.find((w) => w.table === 'agent_messages')?.values).toMatchObject({
      org_id: ORG_ID,
      call_id: CALL_ID,
      recipient_contact_id: 'c1',
      caller_name: 'Ion',
      callback_number: '+40712345678',
      body: 'Please call me about my bill',
      urgency: 'normal',
      status: 'new',
    })
    // Notification, result caching and the invocation log all wait for the response to be sent.
    expect(deferred.length).toBeGreaterThanOrEqual(3)
  })
})
