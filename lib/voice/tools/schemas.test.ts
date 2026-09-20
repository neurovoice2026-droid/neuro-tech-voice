import { describe, expect, it } from 'vitest'
import { parseToolArguments, TOOL_ARGUMENT_SCHEMAS } from '@/lib/voice/tools/schemas'
import { TOOL_DEFINITIONS, VOICE_TOOL_NAMES } from '@/lib/voice/tools/definitions'

describe('tool argument schemas', () => {
  it('cover every tool and every parameter of its definition', () => {
    for (const name of VOICE_TOOL_NAMES) {
      const schema = TOOL_ARGUMENT_SCHEMAS[name]
      expect(schema, name).toBeDefined()
      const keys = Object.keys((schema as unknown as { shape: Record<string, unknown> }).shape)
      expect(keys.sort(), name).toEqual(Object.keys(TOOL_DEFINITIONS[name].parameters.properties).sort())
    }
  })

  it('accepts exact strict-mode arguments', () => {
    const parsed = parseToolArguments('book_appointment', {
      start: '2026-09-23T14:30:00+03:00',
      caller_name: 'Ana Pop',
      service: 'Cleaning',
      notes: null,
      send_sms_confirmation: true,
    })
    expect(parsed).toEqual({
      ok: true,
      data: { start: '2026-09-23T14:30:00+03:00', caller_name: 'Ana Pop', service: 'Cleaning', notes: null, send_sms_confirmation: true },
    })
  })

  it('tolerates blanks, "null" strings, missing nullable fields and string booleans (Cartesia client tools)', () => {
    const parsed = parseToolArguments('book_appointment', {
      start: ' 2026-09-23T14:30:00+03:00 ',
      caller_name: 'Ana Pop',
      service: '',
      notes: 'null',
      send_sms_confirmation: 'yes',
      unexpected: 'ignored',
    })
    expect(parsed.ok && parsed.data).toEqual({
      start: '2026-09-23T14:30:00+03:00',
      caller_name: 'Ana Pop',
      service: null,
      notes: null,
      send_sms_confirmation: true,
    })
    const minimal = parseToolArguments('take_message', { message: 'Please call me back' })
    expect(minimal.ok && minimal.data).toEqual({
      recipient: null,
      caller_name: null,
      callback_number: null,
      message: 'Please call me back',
      urgency: 'normal',
    })
  })

  it('coerces enums and falls back to safe defaults', () => {
    const availability = parseToolArguments('check_availability', { date_from: '2026-09-23', time_of_day: 'Afternoon' })
    expect(availability.ok && availability.data.time_of_day).toBe('afternoon')
    const unknown = parseToolArguments('check_availability', { date_from: '2026-09-23', time_of_day: 'lunchtime' })
    expect(unknown.ok && unknown.data.time_of_day).toBe('any')
    const urgent = parseToolArguments('notify_team', { summary: 'Water leak', urgency: 'URGENT' })
    expect(urgent.ok && urgent.data.urgency).toBe('urgent')
    const numbers = parseToolArguments('send_sms', { message: 12345 })
    expect(numbers.ok && numbers.data.message).toBe('12345')
  })

  it('shortens long text instead of rejecting it', () => {
    const parsed = parseToolArguments('notify_team', { summary: 'x'.repeat(5000), urgency: 'normal' })
    expect(parsed.ok && parsed.data.summary.length).toBe(1000)
  })

  it('explains missing required values in words the model can act on', () => {
    const parsed = parseToolArguments('book_appointment', { start: '2026-09-23T14:30:00+03:00', caller_name: '  ' })
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.message).toContain('caller_name is missing')
      expect(parsed.message).toContain('call book_appointment again')
    }
    const nothing = parseToolArguments('search_knowledge', null)
    expect(nothing.ok).toBe(false)
  })

  it('validates booking ids as uuids, case-insensitively', () => {
    const good = parseToolArguments('cancel_appointment', { booking_id: ' 3F2504E0-4F89-11D3-9A0C-0305E82C3301 ' })
    expect(good.ok && good.data.booking_id).toBe('3f2504e0-4f89-11d3-9a0c-0305e82c3301')
    const bad = parseToolArguments('reschedule_appointment', { booking_id: 'booking-1', new_start: '2026-09-23T14:30:00+03:00' })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.message).toContain('find_booking')
  })
})
