import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/google/client', () => ({ getGoogleClientWithToken: () => null }))

import { defaultSlackTemplate, interpolate, type CallContext } from './executor'
import { DEFAULT_EMAIL_BODY, DEFAULT_EMAIL_SUBJECT, DEFAULT_SLACK_MESSAGE, TEMPLATE_VARIABLES } from './templates'
import { callTemplateVars } from './call-vars'

// Post-call data reaches workflow templates (slice D): every documented
// variable, data-collection fields by id, and never a literal "{{…}}".

function ctx(over: Partial<CallContext> = {}): CallContext {
  return {
    call_id: 'c0000000-0000-4000-8000-000000000001',
    org_id: 'org',
    conversation_id: 'conv_1',
    caller_number: '+40712345678',
    direction: 'inbound',
    duration_seconds: 125,
    status: 'completed',
    sentiment: null,
    summary: 'Wants to move Thursday to Friday.',
    transcript: [{ role: 'user', message: 'Hello' }],
    agent_name: 'Ana',
    started_at: '2026-10-07T09:05:00.000Z',
    ended_at: '2026-10-07T09:07:05.000Z',
    from_number: '+40712345678',
    to_number: '+40312345678',
    call_successful: 'failure',
    outcome: 'rescheduled',
    summary_title: 'Reschedule',
    collected: { caller_name: 'Maria Popescu', callback_number: '+40799999999', reason_for_call: 'reschedule_appointment', insurance_id: 'X-1' },
    business_name: 'Clinica Dentară',
    timezone: 'Europe/Bucharest',
    ...over,
  }
}

describe('workflow templates', () => {
  it('fills the default email subject and body completely', () => {
    const subject = interpolate(DEFAULT_EMAIL_SUBJECT, ctx())
    const body = interpolate(DEFAULT_EMAIL_BODY, ctx())
    expect(subject).toBe('Call from +40712345678: Rescheduled')
    expect(body).toContain('New call handled by Ana on 7 Oct 2026 at 12:05.')
    expect(body).toContain('Caller: Maria Popescu +40712345678')
    expect(body).toContain('Duration: 2m 05s')
    expect(`${subject}\n${body}`).not.toMatch(/\{\{|\}\}/)
  })

  it('every documented variable, old aliases and data-collection fields render; unknown ones become empty', () => {
    const vars = callTemplateVars(ctx())
    for (const v of TEMPLATE_VARIABLES) expect(vars, v.key).toHaveProperty(v.key)
    expect(interpolate('{{caller}} {{agent}} {{call_summary}} {{conversation_id}}', ctx())).toBe('+40712345678 Ana Wants to move Thursday to Friday. conv_1')
    expect(interpolate('{{intent}} | {{business_name}} | {{call_id}} | {{ai_outcome}} | {{summary_title}}', ctx())).toBe('reschedule appointment | Clinica Dentară | c0000000-0000-4000-8000-000000000001 | Not successful | Reschedule')
    expect(interpolate('{{callback_number}} {{insurance_id}} {{ typo_here }}!', ctx())).toBe('+40799999999 X-1 !')
  })

  it('a missing analysis leaves blanks, never literal braces', () => {
    const out = interpolate(DEFAULT_EMAIL_SUBJECT + DEFAULT_EMAIL_BODY, ctx({ outcome: null, collected: {}, call_successful: null, summary: null }))
    expect(out).not.toMatch(/\{\{|\}\}/)
  })

  it('escapes Slack control characters in call data only', () => {
    const out = interpolate(DEFAULT_SLACK_MESSAGE, ctx({ summary: '<!channel> & more' }), { escape: (v) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') })
    expect(out).toContain('&lt;!channel&gt; &amp; more')
    expect(out.startsWith(':telephone_receiver:')).toBe(true)
  })

  it('the default Slack text shows the AI outcome (or a legacy sentiment) and escapes call data', () => {
    const esc = { escape: (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
    const c = ctx({ summary: '<!here> hi' })
    expect(interpolate(defaultSlackTemplate(c), c, esc)).toBe(':telephone_receiver: inbound call from +40712345678 (AI outcome: Not successful). &lt;!here&gt; hi')
    const legacy = ctx({ call_successful: null, sentiment: 'negative' })
    expect(interpolate(defaultSlackTemplate(legacy), legacy)).toContain('call from +40712345678 (negative).')
    const none = ctx({ call_successful: null, sentiment: null })
    expect(interpolate(defaultSlackTemplate(none), none)).toBe(':telephone_receiver: inbound call from +40712345678. Wants to move Thursday to Friday.')
  })

  it('outbound calls show the other party as the caller', () => {
    expect(interpolate('{{caller_number}}', ctx({ direction: 'outbound', caller_number: null, from_number: '+40312345678', to_number: '+40755555555' }))).toBe('+40755555555')
  })
})
