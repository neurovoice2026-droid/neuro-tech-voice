// Test fixtures for the in-call business tool handlers (lib/voice-tools).

import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import { DEFAULT_BOOKING_SETTINGS, DEFAULT_MESSAGE_SETTINGS, type BookingSettings, type MessageSettings } from '@/lib/voice-providers/types'
import type { ToolCallContext } from '@/lib/voice-tools/call-context'

export const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
export const CALL_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
export const CALL_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
export const AGENT_A = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
export const OWNER_A = '11111111-1111-4111-8111-111111111111'
/** Wednesday 7 October 2026, 10:00 in Bucharest. */
export const TOOL_NOW = new Date('2026-10-07T07:00:00Z')

export const WEEKDAY_HOURS = {
  monday: { start: '09:00', end: '17:00', enabled: true },
  tuesday: { start: '09:00', end: '17:00', enabled: true },
  wednesday: { start: '09:00', end: '17:00', enabled: true },
  thursday: { start: '09:00', end: '17:00', enabled: true },
  friday: { start: '09:00', end: '17:00', enabled: true },
  saturday: { start: '09:00', end: '13:00', enabled: false },
  sunday: { start: '09:00', end: '13:00', enabled: false },
}

export function toolDb(initial: Parameters<typeof memoryDb>[0] = {}): MemoryDb & { auth: { admin: { getUserById: ReturnType<typeof vi.fn> } } } {
  const db = memoryDb(initial, {
    unique: {
      bookings: [['org_id', 'idempotency_key']],
      call_messages: [['call_id']],
      tool_invocations: [['call_id', 'tool', 'idempotency_key']],
      call_slot_offers: [['call_id', 'slot_id']],
    },
  })
  const getUserById = vi.fn(async () => ({ data: { user: { id: OWNER_A, email: 'Owner@Example.com', email_confirmed_at: '2026-01-01T00:00:00Z' } }, error: null }))
  return Object.assign(db, { auth: { admin: { getUserById } } })
}

export function toolContext(
  db: MemoryDb,
  overrides: { booking?: Partial<BookingSettings>; messages?: Partial<MessageSettings>; call?: Partial<ToolCallContext['call']>; now?: Date } = {},
): ToolCallContext {
  return {
    call: {
      id: CALL_A,
      org_id: ORG_A,
      agent_id: AGENT_A,
      direction: 'inbound',
      status: 'in-progress',
      provider: 'elevenlabs',
      from_number: '+40712345678',
      to_number: '+40310000001',
      caller_number: '+40712345678',
      ended_at: null,
      is_test: false,
      ...overrides.call,
    },
    org: { id: ORG_A, name: 'Smile Clinic', timezone: 'Europe/Bucharest', userId: OWNER_A },
    agent: {
      id: AGENT_A,
      name: 'Ana',
      language: 'en',
      workingHours: WEEKDAY_HOURS,
      booking: { ...DEFAULT_BOOKING_SETTINGS, enabled: true, duration_minutes: 60, min_notice_hours: 1, ...overrides.booking },
      messages: { ...DEFAULT_MESSAGE_SETTINGS, enabled: true, ...overrides.messages },
    },
    callerPhone: '+40712345678',
    businessPhone: '+40310000001',
    now: overrides.now ?? TOOL_NOW,
    db: db as unknown as SupabaseClient,
  }
}
