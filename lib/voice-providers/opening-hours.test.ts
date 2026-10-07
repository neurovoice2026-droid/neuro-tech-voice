import { describe, expect, it } from 'vitest'
import { describeOpeningHours } from './opening-hours'

describe('describeOpeningHours', () => {
  it('is null when the after-hours rule is off or no day is configured (always open)', () => {
    expect(describeOpeningHours({ monday: { start: '09:00', end: '17:00', enabled: true } }, { enabled: false })).toBeNull()
    expect(describeOpeningHours({}, { enabled: true })).toBeNull()
    expect(describeOpeningHours(null, { enabled: true })).toBeNull()
  })

  it('lists every weekday, closed days, 24-hour and overnight windows', () => {
    const text = describeOpeningHours(
      {
        monday: { start: '09:00', end: '17:00', enabled: true },
        tuesday: { start: '00:00', end: '00:00', enabled: true },
        friday: { start: '22:00', end: '06:00', enabled: true },
        saturday: { start: '10:00', end: '12:00', enabled: false },
      },
      { enabled: true },
    )
    expect(text).toBe(
      'Monday 09:00-17:00; Tuesday open 24 hours; Wednesday closed; Thursday closed; Friday 22:00-06:00 (until the next morning); Saturday closed; Sunday closed.',
    )
  })
})
