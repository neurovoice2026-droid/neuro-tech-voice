import { beforeEach, describe, expect, it, vi } from 'vitest'

const pending: Array<Promise<unknown>> = []
vi.mock('@/lib/observability/telemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/observability/telemetry')>()),
  deferBackground: (work: Promise<unknown>) => pending.push(work),
}))
const sendEmail = vi.fn()
const emailConfigured = vi.fn()
vi.mock('@/lib/email/client', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a), isConfigured: () => emailConfigured() }))

import { createLogger } from '@/lib/observability/logger'
import { AGENT_A, CALL_A, ORG_A, ORG_B, toolContext, toolDb } from '@/tests/helpers/voice-tools'
import { takeMessageTool } from './message-tools'
import { MAX_MESSAGE_EMAILS_PER_CALL } from './notify'

const log = createLogger({ component: 'test' })
let db: ReturnType<typeof toolDb>

async function settle() {
  while (pending.length) await pending.shift()
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  pending.length = 0
  db = toolDb()
  sendEmail.mockReset().mockResolvedValue(true)
  emailConfigured.mockReset().mockReturnValue(true)
})

const ARGS = { caller_name: 'Ana Pop', reason: 'Wants to move her cleaning to next week', urgency: 'normal' }

describe('take_message', () => {
  it('saves the message on the call (org, agent, caller number from the call) and e-mails the verified owner and the extra recipients', async () => {
    const ctx = toolContext(db, { messages: { extra_recipients: ['desk@clinic.example'] } })
    const res = await takeMessageTool(ctx, { ...ARGS, org_id: ORG_B, recipients: ['attacker@evil.example'] }, log, 'elevenlabs')
    expect(res).toEqual({ ok: true, message: expect.stringContaining('ending in 5678') })
    expect(db.tables.call_messages).toHaveLength(1)
    expect(db.tables.call_messages[0]).toMatchObject({
      org_id: ORG_A,
      agent_id: AGENT_A,
      call_id: CALL_A,
      provider: 'elevenlabs',
      caller_name: 'Ana Pop',
      callback_number: '+40712345678',
      reason: ARGS.reason,
      urgency: 'normal',
      status: 'open',
    })
    await settle()
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const mail = sendEmail.mock.calls[0][0] as { to: string[]; subject: string; html: string }
    expect(mail.to).toEqual(['owner@example.com', 'desk@clinic.example'])
    expect(mail.subject).toBe('New message from Ana Pop')
    expect(mail.html).toContain('+40712345678')
    expect(JSON.stringify(sendEmail.mock.calls)).not.toContain('attacker@evil.example')
    expect(db.tables.call_messages[0]).toMatchObject({ notify_count: 1, notify_error: null })
    expect(db.tables.call_messages[0].notified_at).toEqual(expect.any(String))
  })

  it('an exact repeat (model retry) replays the answer: no second message, no second e-mail', async () => {
    const ctx = toolContext(db)
    const first = await takeMessageTool(ctx, ARGS, log, 'elevenlabs')
    const again = await takeMessageTool(ctx, ARGS, log, 'elevenlabs')
    await settle()
    expect(again).toEqual(first)
    expect(db.tables.call_messages).toHaveLength(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it(`a correction updates the same message and re-alerts, at most ${MAX_MESSAGE_EMAILS_PER_CALL} e-mails per call`, async () => {
    const ctx = toolContext(db)
    await takeMessageTool(ctx, ARGS, log, 'elevenlabs')
    await settle()
    const corrected = await takeMessageTool(ctx, { ...ARGS, callback_number: '0721 000 111', urgency: 'urgent' }, log, 'elevenlabs')
    await settle()
    expect(corrected.message).toMatch(/^Message updated and marked urgent/)
    expect(db.tables.call_messages).toHaveLength(1)
    // A national number is read in the country of the business line.
    expect(db.tables.call_messages[0]).toMatchObject({ callback_number: '+40721000111', urgency: 'urgent', notify_count: 2 })
    expect((sendEmail.mock.calls[1][0] as { subject: string }).subject).toBe('[URGENT] Updated message from Ana Pop')
    await takeMessageTool(ctx, { ...ARGS, reason: 'Third version' }, log, 'elevenlabs')
    await settle()
    expect(sendEmail).toHaveBeenCalledTimes(MAX_MESSAGE_EMAILS_PER_CALL)
    expect(db.tables.call_messages[0].reason).toBe('Third version')
  })

  it('"urgent only" e-mails only urgent messages; "off" never; the message is saved either way', async () => {
    await takeMessageTool(toolContext(db, { messages: { email_notifications: 'urgent_only' } }), ARGS, log, 'elevenlabs')
    await settle()
    expect(sendEmail).not.toHaveBeenCalled()
    const db2 = toolDb()
    await takeMessageTool(toolContext(db2, { messages: { email_notifications: 'urgent_only' } }), { ...ARGS, urgency: 'urgent' }, log, 'cartesia')
    await settle()
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(db2.tables.call_messages[0].provider).toBe('cartesia')
    const db3 = toolDb()
    await takeMessageTool(toolContext(db3, { messages: { email_notifications: 'off' } }), { ...ARGS, urgency: 'urgent' }, log, 'elevenlabs')
    await settle()
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(db3.tables.call_messages).toHaveLength(1)
  })

  it('an unverified owner address is never used; no recipient at all is recorded on the message', async () => {
    db.auth.admin.getUserById.mockResolvedValue({ data: { user: { id: 'u', email: 'owner@example.com', email_confirmed_at: null } }, error: null })
    await takeMessageTool(toolContext(db), ARGS, log, 'elevenlabs')
    await settle()
    expect(sendEmail).not.toHaveBeenCalled()
    expect(db.tables.call_messages[0].notify_error).toBe('no_recipients')
  })

  it('a failed e-mail is recorded; the caller was still told the message is saved', async () => {
    sendEmail.mockResolvedValue(false)
    const res = await takeMessageTool(toolContext(db), ARGS, log, 'elevenlabs')
    await settle()
    expect(res.ok).toBe(true)
    expect(db.tables.call_messages[0].notify_error).toBe('send_failed')
  })

  it('turned off, or missing the reason: ok:false guidance, nothing saved', async () => {
    expect((await takeMessageTool(toolContext(db, { messages: { enabled: false } }), ARGS, log, 'elevenlabs')).ok).toBe(false)
    const missing = await takeMessageTool(toolContext(db), { caller_name: 'Ana' }, log, 'elevenlabs')
    expect(missing).toEqual({ ok: false, message: expect.stringContaining('reason') })
    expect(db.tables.call_messages ?? []).toEqual([])
  })
})
