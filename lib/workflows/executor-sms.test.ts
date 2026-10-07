import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
const send = vi.fn()
vi.mock('@/lib/sms/sender', () => ({ sendTransactionalSms: (...a: unknown[]) => send(...a) }))

import { executeWorkflows, type CallContext } from './executor'

const CALL = '44444444-4444-4444-8444-444444444444'
let db: MemoryDb

function ctx(over: Partial<CallContext> = {}): CallContext {
  return {
    call_id: CALL,
    org_id: 'org1',
    conversation_id: 'conv1',
    caller_number: '+40799999999',
    direction: 'inbound',
    duration_seconds: 60,
    status: 'completed',
    sentiment: null,
    summary: 'Asked about prices',
    transcript: [],
    started_at: '2026-10-07T07:00:00Z',
    business_name: 'Smile Clinic',
    ...over,
  }
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  db = memoryDb({
    workflows: [{ id: 'wf1', org_id: 'org1', trigger: 'call_ended', trigger_config: {}, enabled: true, runs: 0, successful_runs: 0, actions: [{ id: 'a0', type: 'send_sms', config: { message: 'Thanks for calling {{business_name}}!' } }] }],
    calls: [{ id: CALL, org_id: 'org1', direction: 'inbound', from_number: '+40712345678', to_number: '+40310000002', caller_number: '+40799999999', phone_number_id: 'pn-sms', outcome: 'answered', is_test: false }],
  })
  state.db = db
  send.mockReset().mockResolvedValue({ ok: true, duplicate: false })
})

describe('workflow action send_sms (was "Unknown action type")', () => {
  it('texts the other party of the stored call from the call’s number, once per workflow step and call', async () => {
    await executeWorkflows('call_ended', ctx())
    expect(send).toHaveBeenCalledTimes(1)
    const input = send.mock.calls[0][0] as Record<string, unknown>
    // The destination comes from the call row (from_number), not from the workflow context or config.
    expect(input).toMatchObject({ orgId: 'org1', callId: CALL, preferredNumberId: 'pn-sms', to: '+40712345678', idempotencyKey: `wf:wf1:a0:${CALL}` })
    // Already names the business: not signed twice.
    expect(input.body).toBe('Thanks for calling Smile Clinic!')
    expect(db.tables.workflow_runs[0]).toMatchObject({ status: 'completed' })
    expect((db.tables.workflow_runs[0].results as Array<{ message: string }>)[0].message).toBe('Text sent to the caller')
  })

  it('signs a text that does not name the business, and uses the default text when none is configured', async () => {
    ;(db.tables.workflows[0].actions as Array<{ config: Record<string, string> }>)[0].config = { message: 'We got your message.' }
    await executeWorkflows('call_ended', ctx())
    expect((send.mock.calls[0][0] as { body: string }).body).toBe('Smile Clinic: We got your message.')
    ;(db.tables.workflows[0].actions as Array<{ config: Record<string, string> }>)[0].config = {}
    await executeWorkflows('call_ended', ctx())
    expect((send.mock.calls[1][0] as { body: string }).body).toContain('Thanks for calling Smile Clinic')
  })

  it('outbound calls text the person who was called', async () => {
    db.tables.calls[0] = { ...db.tables.calls[0], direction: 'outbound', from_number: '+40310000002', to_number: '+40755555555' }
    await executeWorkflows('call_ended', ctx())
    expect((send.mock.calls[0][0] as { to: string }).to).toBe('+40755555555')
  })

  it('a number that cannot text fails the step with a clear, final message (no retry)', async () => {
    send.mockResolvedValue({ ok: false, reason: 'no_sms_number' })
    await executeWorkflows('call_ended', ctx())
    expect(send).toHaveBeenCalledTimes(1)
    expect(db.tables.workflow_runs[0]).toMatchObject({ status: 'failed', error: 'Not sent: your business number cannot send text messages.' })
  })

  it('never texts for spam, test calls or a call of another organisation', async () => {
    db.tables.calls[0].outcome = 'spam'
    await executeWorkflows('call_ended', ctx())
    db.tables.calls[0].outcome = 'answered'
    db.tables.calls[0].is_test = true
    await executeWorkflows('call_ended', ctx())
    db.tables.calls[0].is_test = false
    db.tables.calls[0].org_id = 'org2'
    await executeWorkflows('call_ended', ctx())
    expect(send).not.toHaveBeenCalled()
    expect(db.tables.workflow_runs.map((r) => r.status)).toEqual(['failed', 'failed', 'failed'])
  })
})
