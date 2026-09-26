import { describe, expect, it } from 'vitest'
import { isDueForReminder, reminderWindow, selectDueReminders, type ReminderCandidate } from '@/lib/scheduling/reminder-window'

const NOW = new Date('2026-09-17T07:00:00Z')
const HOUR = 3_600_000

function booking(startsInHours: number, overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    org_id: 'org-1',
    starts_at: new Date(NOW.getTime() + startsInHours * HOUR).toISOString(),
    status: 'booked',
    reminder_sent_at: null,
    confirmation_sent_at: null,
    caller_phone: '+40712345678',
    ...overrides,
  }
}

const DAY_BEFORE = { send_reminders: true, reminder_hours_before: 24 }

describe('reminderWindow', () => {
  it('is 24 hours wide, centred on the reminder lead time', () => {
    const window = reminderWindow(NOW, 24)
    expect(new Date(window.start).toISOString()).toBe('2026-09-17T19:00:00.000Z')
    expect(new Date(window.end).toISOString()).toBe('2026-09-18T19:00:00.000Z')
  })
})

describe('isDueForReminder', () => {
  it('includes the start of the window and excludes its end', () => {
    expect(isDueForReminder(booking(12), DAY_BEFORE, NOW)).toBe(true)
    expect(isDueForReminder(booking(24), DAY_BEFORE, NOW)).toBe(true)
    expect(isDueForReminder(booking(35.99), DAY_BEFORE, NOW)).toBe(true)
    expect(isDueForReminder(booking(36), DAY_BEFORE, NOW)).toBe(false)
    expect(isDueForReminder(booking(11.99), DAY_BEFORE, NOW)).toBe(false)
  })

  it('catches every booking exactly once across consecutive daily runs', () => {
    const starts = Array.from({ length: 96 }, (_, i) => booking(i * 0.75 + 0.1))
    const hits = new Map<string, number>()
    for (let day = 0; day < 4; day += 1) {
      const runAt = new Date(NOW.getTime() - 2 * 24 * HOUR + day * 24 * HOUR)
      for (const b of starts) {
        if (isDueForReminder(b, DAY_BEFORE, runAt)) hits.set(b.starts_at, (hits.get(b.starts_at) ?? 0) + 1)
      }
    }
    // Bookings starting from 12 h after the first run's window opens are each caught once.
    for (const b of starts) {
      const startsAt = Date.parse(b.starts_at)
      if (startsAt >= NOW.getTime() - 2 * 24 * HOUR + 12 * HOUR && startsAt < NOW.getTime() + 24 * HOUR + 36 * HOUR) {
        expect(hits.get(b.starts_at)).toBe(1)
      }
    }
  })

  it('skips cancelled, already reminded, past, phoneless and disabled bookings', () => {
    expect(isDueForReminder(booking(24, { status: 'cancelled' }), DAY_BEFORE, NOW)).toBe(false)
    expect(isDueForReminder(booking(24, { status: 'rescheduled' }), DAY_BEFORE, NOW)).toBe(true)
    expect(isDueForReminder(booking(24, { reminder_sent_at: NOW.toISOString() }), DAY_BEFORE, NOW)).toBe(false)
    expect(isDueForReminder(booking(24, { caller_phone: null }), DAY_BEFORE, NOW)).toBe(false)
    expect(isDueForReminder(booking(24), { send_reminders: false, reminder_hours_before: 24 }, NOW)).toBe(false)
    expect(isDueForReminder(booking(-1), { send_reminders: true, reminder_hours_before: 0 }, NOW)).toBe(false)
  })

  it('skips bookings whose confirmation text went out in the last few hours', () => {
    const justConfirmed = booking(20, { confirmation_sent_at: new Date(NOW.getTime() - 2 * HOUR).toISOString() })
    const confirmedYesterday = booking(20, { confirmation_sent_at: new Date(NOW.getTime() - 20 * HOUR).toISOString() })
    expect(isDueForReminder(justConfirmed, DAY_BEFORE, NOW)).toBe(false)
    expect(isDueForReminder(confirmedYesterday, DAY_BEFORE, NOW)).toBe(true)
  })

  it('catches up on bookings made after the run that covered their start time', () => {
    const madeYesterdayAfternoon = new Date(NOW.getTime() - 16 * HOUR).toISOString()
    // Booked yesterday at 15:00 for today at 13:00: yesterday's 07:00 run couldn't see it.
    expect(isDueForReminder(booking(6, { created_at: madeYesterdayAfternoon }), DAY_BEFORE, NOW)).toBe(true)
    // Still too close to the appointment to be useful.
    expect(isDueForReminder(booking(1.5, { created_at: madeYesterdayAfternoon }), DAY_BEFORE, NOW)).toBe(false)
    // Booked an hour ago: the caller remembers, and the next run is too late anyway.
    expect(isDueForReminder(booking(6, { created_at: new Date(NOW.getTime() - HOUR).toISOString() }), DAY_BEFORE, NOW)).toBe(false)
    // Without a creation time only the regular window applies.
    expect(isDueForReminder(booking(6), DAY_BEFORE, NOW)).toBe(false)
    // A recent confirmation still wins.
    expect(
      isDueForReminder(
        booking(6, { created_at: madeYesterdayAfternoon, confirmation_sent_at: new Date(NOW.getTime() - HOUR).toISOString() }),
        DAY_BEFORE,
        NOW
      )
    ).toBe(false)
  })

  it('uses each organisation’s own lead time', () => {
    const due = selectDueReminders(
      [booking(2, { org_id: 'same-day' }), booking(2, { org_id: 'day-before' }), booking(48, { org_id: 'two-days' })],
      (orgId) =>
        orgId === 'same-day'
          ? { send_reminders: true, reminder_hours_before: 2 }
          : orgId === 'two-days'
            ? { send_reminders: true, reminder_hours_before: 48 }
            : DAY_BEFORE,
      NOW
    )
    expect(due.map((b) => b.org_id)).toEqual(['same-day', 'two-days'])
  })
})
