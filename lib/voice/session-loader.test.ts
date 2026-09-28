import { describe, expect, it, vi } from 'vitest'

// session-loader imports S6's knowledge search and the Supabase admin client;
// these tests cover its pure helpers only.
vi.mock('@/lib/knowledge/search', () => ({ hasReadyKnowledge: async () => false }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))

import { computeCapabilities, parseServices, summarizeContacts, type CapabilityFacts } from './session-loader'

const facts: CapabilityFacts = {
  channel: 'twilio',
  plan: 'pro',
  smsEnabled: true,
  twilioConfigured: true,
  googleConfigured: true,
  calendarIntegrationActive: true,
  schedulingSettingsExist: true,
  knowledgeReady: true,
  hasSmsCapableNumber: true,
  hasTransferContact: true,
  leadFieldCount: 2,
}

describe('computeCapabilities', () => {
  it('enables every tool when everything is set up on a Pro plan', () => {
    expect(computeCapabilities(facts)).toEqual({
      calendar: true,
      knowledge: true,
      sms: true,
      transfer: true,
      take_message: true,
      waitlist: true,
      lead_fields: true,
    })
  })

  it('needs Google configured, a connected calendar, the plan and scheduling settings for bookings', () => {
    expect(computeCapabilities({ ...facts, plan: 'starter' }).calendar).toBe(false)
    expect(computeCapabilities({ ...facts, calendarIntegrationActive: false }).calendar).toBe(false)
    expect(computeCapabilities({ ...facts, schedulingSettingsExist: false })).toMatchObject({ calendar: false, waitlist: false })
    expect(computeCapabilities({ ...facts, googleConfigured: false }).calendar).toBe(false)
  })

  it('needs the SMS switch, a paid plan and an SMS-capable number for texts', () => {
    expect(computeCapabilities({ ...facts, smsEnabled: false }).sms).toBe(false)
    expect(computeCapabilities({ ...facts, plan: 'trial' }).sms).toBe(false)
    expect(computeCapabilities({ ...facts, hasSmsCapableNumber: false }).sms).toBe(false)
    expect(computeCapabilities({ ...facts, plan: 'starter' }).sms).toBe(true)
  })

  it('never offers texts or transfers on a browser test call', () => {
    expect(computeCapabilities({ ...facts, channel: 'browser' })).toMatchObject({ sms: false, transfer: false, take_message: true })
  })

  it('always allows taking a message and only asks lead questions when defined', () => {
    const bare = computeCapabilities({
      ...facts,
      plan: 'trial',
      twilioConfigured: false,
      knowledgeReady: false,
      hasTransferContact: false,
      leadFieldCount: 0,
    })
    expect(bare).toEqual({ calendar: false, knowledge: false, sms: false, transfer: false, take_message: true, waitlist: false, lead_fields: false })
  })

  it('lets booking agents save the caller’s email for the calendar invitation even without lead questions', () => {
    expect(computeCapabilities({ ...facts, leadFieldCount: 0 }).lead_fields).toBe(true)
    expect(computeCapabilities({ ...facts, leadFieldCount: 0, plan: 'starter' }).lead_fields).toBe(false)
  })
})

describe('summarizeContacts', () => {
  it('lists names, roles, conditions and flags without phone numbers', () => {
    const summary = summarizeContacts(
      [
        { name: 'Dana Pop', role: 'Office manager', phone: '+40712345678', transfer_enabled: true, is_on_call: true, conditions: 'Billing questions.\nComplaints.' },
        { name: 'Dr. Ionescu', role: null, phone: null, transfer_enabled: true, is_on_call: false, conditions: null },
        { name: '   ', role: 'ignored', phone: null, transfer_enabled: false, is_on_call: false, conditions: null },
      ],
      { transfersAvailable: true }
    )
    expect(summary).toBe(
      '- Dana Pop (Office manager): Billing questions. Complaints [can take live transfers, on call]\n- Dr. Ionescu'
    )
    expect(summary).not.toContain('+40')
  })

  it('drops the transfer flag when transfers are unavailable and returns null for no contacts', () => {
    const summary = summarizeContacts(
      [{ name: 'Dana', role: null, phone: '+40712345678', transfer_enabled: true, is_on_call: false, conditions: null }],
      { transfersAvailable: false }
    )
    expect(summary).toBe('- Dana')
    expect(summarizeContacts([], { transfersAvailable: true })).toBeNull()
  })
})

describe('parseServices', () => {
  it('keeps valid services and ignores junk', () => {
    expect(
      parseServices([
        { name: 'Consultation', duration_minutes: 30 },
        { name: ' Cleaning ', duration_minutes: '45' },
        { name: 'No duration' },
        { name: '' },
        null,
        'text',
      ])
    ).toEqual([
      { name: 'Consultation', duration_minutes: 30 },
      { name: 'Cleaning', duration_minutes: 45 },
      { name: 'No duration', duration_minutes: 0 },
    ])
    expect(parseServices({})).toEqual([])
  })
})
