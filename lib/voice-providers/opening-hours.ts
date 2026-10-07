// The weekly schedule in words, for the agent prompt. Native ElevenLabs calls
// never pass through our router, so they carry no after_hours value: the
// placeholder says "unknown" and the model decides from these hours and the
// current time (ElevenLabs injects it through prompt.timezone). Same rules as
// evaluateWorkingHours: disabled gate or no schedule → null (always open).
// Pure and client-safe.

import { WEEKDAYS, parseClock } from '@/lib/scheduling/time'
import type { AfterHoursConfig, WorkingHours } from './working-hours'

const DAY_NAMES: Record<(typeof WEEKDAYS)[number], string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

export function describeOpeningHours(hours: WorkingHours | null | undefined, afterHours: Pick<AfterHoursConfig, 'enabled'> | null | undefined): string | null {
  if (!afterHours?.enabled) return null
  const days = hours ?? {}
  if (!WEEKDAYS.some((d) => days[d] !== undefined)) return null
  const parts = WEEKDAYS.map((d) => {
    const slot = days[d]
    const start = slot?.enabled ? parseClock(slot.start) : null
    const end = slot?.enabled ? parseClock(slot.end) : null
    if (!slot?.enabled || start === null || end === null || start >= 24 * 60) return `${DAY_NAMES[d]} closed`
    if (start === end) return `${DAY_NAMES[d]} open 24 hours`
    return `${DAY_NAMES[d]} ${slot.start}-${slot.end}${end < start ? ' (until the next morning)' : ''}`
  })
  return `${parts.join('; ')}.`
}
