import { describe, expect, it } from 'vitest'
import {
  appointmentMinutes,
  clampRange,
  generateSlots,
  mergeBusy,
  resolveService,
  spreadSlots,
  subtractInterval,
  type SlotRules,
} from '@/lib/scheduling/slots'
import type { WorkingHours } from '@/types'

const BUCHAREST = 'Europe/Bucharest'

const weekdaysNineToFive: WorkingHours = {
  monday: { start: '09:00', end: '17:00', enabled: true },
  tuesday: { start: '09:00', end: '17:00', enabled: true },
  wednesday: { start: '09:00', end: '17:00', enabled: true },
  thursday: { start: '09:00', end: '17:00', enabled: true },
  friday: { start: '09:00', end: '17:00', enabled: true },
  saturday: { start: '10:00', end: '13:00', enabled: false },
  sunday: { start: '10:00', end: '13:00', enabled: false },
}

function rules(overrides: Partial<SlotRules> = {}): SlotRules {
  return {
    slot_minutes: 60,
    buffer_minutes: 0,
    min_notice_minutes: 0,
    max_days_ahead: 30,
    business_hours: weekdaysNineToFive,
    ...overrides,
  }
}

// Monday 14 September 2026, 06:00 in Bucharest (UTC+3): before opening.
const MONDAY_EARLY = new Date('2026-09-14T03:00:00Z')

describe('generateSlots: business hours', () => {
  it('offers every step from opening until the appointment no longer fits', () => {
    const slots = generateSlots(rules(), [], { from: '2026-09-14', to: '2026-09-14' }, null, 'any', MONDAY_EARLY, BUCHAREST)
    expect(slots.map((s) => s.time)).toEqual(['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'])
    expect(slots[0].start).toBe('2026-09-14T09:00:00+03:00')
    expect(slots[0].end).toBe('2026-09-14T10:00:00+03:00')
    expect(slots[0].weekday).toBe('monday')
  })

  it('uses the service length but keeps the slot step', () => {
    const service = { name: 'Consultation', duration_minutes: 90 }
    const slots = generateSlots(rules(), [], { from: '2026-09-14', to: '2026-09-14' }, service, 'any', MONDAY_EARLY, BUCHAREST)
    expect(slots.map((s) => s.time)).toEqual(['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'])
    expect(slots.at(-1)?.end).toBe('2026-09-14T16:30:00+03:00')
  })

  it('skips closed days and covers a whole range', () => {
    // Friday 18 to Monday 21 September: the weekend is closed.
    const slots = generateSlots(rules({ slot_minutes: 240 }), [], { from: '2026-09-18', to: '2026-09-21' }, null, 'any', MONDAY_EARLY, BUCHAREST)
    expect(slots.map((s) => `${s.date} ${s.time}`)).toEqual([
      '2026-09-18 09:00',
      '2026-09-18 13:00',
      '2026-09-21 09:00',
      '2026-09-21 13:00',
    ])
  })

  it('ignores days with invalid hours', () => {
    const broken: WorkingHours = { ...weekdaysNineToFive, monday: { start: '17:00', end: '09:00', enabled: true } }
    expect(generateSlots(rules({ business_hours: broken }), [], { from: '2026-09-14', to: '2026-09-14' }, null, 'any', MONDAY_EARLY, BUCHAREST)).toEqual([])
  })
})

describe('generateSlots: busy times and buffers', () => {
  const busy = [{ start: Date.parse('2026-09-14T08:00:00Z'), end: Date.parse('2026-09-14T09:00:00Z') }] // 11:00–12:00 local

  it('removes starts that overlap a busy block', () => {
    const slots = generateSlots(rules(), busy, { from: '2026-09-14', to: '2026-09-14' }, null, 'any', MONDAY_EARLY, BUCHAREST)
    expect(slots.map((s) => s.time)).toEqual(['09:00', '10:00', '12:00', '13:00', '14:00', '15:00', '16:00'])
  })

  it('keeps a buffer on both sides of busy blocks', () => {
    const slots = generateSlots(rules({ buffer_minutes: 15 }), busy, { from: '2026-09-14', to: '2026-09-14' }, null, 'any', MONDAY_EARLY, BUCHAREST)
    expect(slots.map((s) => s.time)).toEqual(['09:00', '13:00', '14:00', '15:00', '16:00'])
  })

  it('treats touching blocks as free on the boundary without a buffer', () => {
    const slots = generateSlots(rules({ slot_minutes: 30 }), busy, { from: '2026-09-14', to: '2026-09-14' }, null, 'any', MONDAY_EARLY, BUCHAREST)
    expect(slots.map((s) => s.time)).toContain('10:30')
    expect(slots.map((s) => s.time)).toContain('12:00')
    expect(slots.map((s) => s.time)).not.toContain('11:30')
  })
})

describe('generateSlots: notice and booking window', () => {
  it('enforces the minimum notice from now', () => {
    // 10:20 local on Monday with two hours' notice: first start at 12:20 or later.
    const now = new Date('2026-09-14T07:20:00Z')
    const slots = generateSlots(rules({ min_notice_minutes: 120 }), [], { from: '2026-09-14', to: '2026-09-14' }, null, 'any', now, BUCHAREST)
    expect(slots[0].time).toBe('13:00')
  })

  it('never offers past days or days beyond max_days_ahead', () => {
    const fullDay = { name: 'Full day', duration_minutes: 480 }
    const slots = generateSlots(rules({ max_days_ahead: 1, slot_minutes: 240 }), [], { from: '2026-09-10', to: '2026-09-30' }, fullDay, 'any', MONDAY_EARLY, BUCHAREST)
    expect(slots.map((s) => s.date)).toEqual(['2026-09-14', '2026-09-15'])
  })

  it('returns nothing for a range entirely outside the window', () => {
    expect(clampRange({ from: '2026-12-01', to: '2026-12-02' }, { max_days_ahead: 30 }, MONDAY_EARLY, BUCHAREST)).toBeNull()
    expect(generateSlots(rules(), [], { from: 'not a date', to: '2026-09-14' }, null, 'any', MONDAY_EARLY, BUCHAREST)).toEqual([])
  })
})

describe('generateSlots: time of day', () => {
  const range = { from: '2026-09-14', to: '2026-09-14' }
  const longDay: WorkingHours = { ...weekdaysNineToFive, monday: { start: '08:00', end: '20:00', enabled: true } }

  it('filters mornings, afternoons and evenings by start time', () => {
    const r = rules({ business_hours: longDay })
    expect(generateSlots(r, [], range, null, 'morning', MONDAY_EARLY, BUCHAREST).map((s) => s.time)).toEqual(['08:00', '09:00', '10:00', '11:00'])
    expect(generateSlots(r, [], range, null, 'afternoon', MONDAY_EARLY, BUCHAREST).map((s) => s.time)).toEqual(['12:00', '13:00', '14:00', '15:00', '16:00'])
    expect(generateSlots(r, [], range, null, 'evening', MONDAY_EARLY, BUCHAREST).map((s) => s.time)).toEqual(['17:00', '18:00', '19:00'])
  })
})

describe('generateSlots: daylight saving time in Europe/Bucharest', () => {
  const sundayOpen: WorkingHours = {
    ...weekdaysNineToFive,
    saturday: { start: '02:00', end: '06:00', enabled: true },
    sunday: { start: '02:00', end: '06:00', enabled: true },
  }
  const now = new Date('2026-03-20T00:00:00Z')

  it('uses UTC+2 before and UTC+3 after the change on 29 March 2026, skipping the missing hour', () => {
    const slots = generateSlots(rules({ business_hours: sundayOpen }), [], { from: '2026-03-28', to: '2026-03-29' }, null, 'any', now, BUCHAREST)
    const saturday = slots.filter((s) => s.date === '2026-03-28')
    const sunday = slots.filter((s) => s.date === '2026-03-29')
    expect(saturday.map((s) => s.start)).toEqual([
      '2026-03-28T02:00:00+02:00',
      '2026-03-28T03:00:00+02:00',
      '2026-03-28T04:00:00+02:00',
      '2026-03-28T05:00:00+02:00',
    ])
    // 03:00 doesn't exist on Sunday: clocks jump from 03:00 to 04:00.
    expect(sunday.map((s) => s.start)).toEqual(['2026-03-29T02:00:00+02:00', '2026-03-29T04:00:00+03:00', '2026-03-29T05:00:00+03:00'])
    expect(new Date(sunday[1].startMs).toISOString()).toBe('2026-03-29T01:00:00.000Z')
  })

  it('keeps 09:00 local on both sides of the autumn change (25 October 2026)', () => {
    const allWeek: WorkingHours = { ...weekdaysNineToFive, saturday: weekdaysNineToFive.monday, sunday: weekdaysNineToFive.monday }
    const slots = generateSlots(
      rules({ business_hours: allWeek, slot_minutes: 240 }),
      [],
      { from: '2026-10-24', to: '2026-10-26' },
      { name: 'Full day', duration_minutes: 480 },
      'any',
      new Date('2026-10-20T00:00:00Z'),
      BUCHAREST
    )
    expect(slots.map((s) => new Date(s.startMs).toISOString())).toEqual([
      '2026-10-24T06:00:00.000Z',
      '2026-10-25T07:00:00.000Z',
      '2026-10-26T07:00:00.000Z',
    ])
    expect(slots.map((s) => s.time)).toEqual(['09:00', '09:00', '09:00'])
  })
})

describe('services and helpers', () => {
  const services = [
    { name: 'Haircut', duration_minutes: 30 },
    { name: 'Haircut and colour', duration_minutes: 120 },
    { name: 'Consultație', duration_minutes: 45 },
  ]

  it('resolves spoken service names', () => {
    expect(resolveService(services, 'haircut')?.duration_minutes).toBe(30)
    expect(resolveService(services, 'HAIRCUT AND COLOUR')?.duration_minutes).toBe(120)
    expect(resolveService(services, 'consultatie')?.name).toBe('Consultație')
    expect(resolveService(services, 'massage')).toBeNull()
    expect(resolveService([], 'haircut')).toBeNull()
  })

  it('falls back to the slot length without a service', () => {
    expect(appointmentMinutes({ slot_minutes: 45 }, null)).toBe(45)
    expect(appointmentMinutes({ slot_minutes: 45 }, services[1])).toBe(120)
  })

  it('merges and subtracts busy intervals', () => {
    expect(mergeBusy([{ start: 5, end: 10 }, { start: 0, end: 5 }, { start: 20, end: 30 }, { start: 8, end: 9 }])).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 30 },
    ])
    expect(subtractInterval([{ start: 0, end: 100 }], { start: 40, end: 60 })).toEqual([
      { start: 0, end: 40 },
      { start: 60, end: 100 },
    ])
  })

  it('spreads offered times across each day', () => {
    const slots = generateSlots(rules({ slot_minutes: 30 }), [], { from: '2026-09-14', to: '2026-09-15' }, null, 'any', MONDAY_EARLY, BUCHAREST)
    const picked = spreadSlots(slots, 4, 6)
    expect(picked).toHaveLength(6)
    expect(picked.slice(0, 4).map((s) => s.time)).toEqual(['09:00', '11:30', '14:00', '16:30'])
    expect(picked.slice(4).every((s) => s.date === '2026-09-15')).toBe(true)
  })
})
