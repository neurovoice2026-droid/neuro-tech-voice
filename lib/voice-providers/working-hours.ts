// Working-hours evaluation in the organization's time zone, applied at call
// ingress before any provider is chosen (the same rule for ElevenLabs and
// Cartesia). Pure and client-safe so the dashboard can preview it.
//
// Semantics:
// - Each weekday has { enabled, start, end } in local wall-clock time.
// - end <= start means the window runs past midnight ("22:00"–"06:00"): the
//   part after midnight belongs to the previous day's window.
// - "24:00" as end means end of day. start === end with enabled = open 24h.
// - An unknown or invalid time zone falls back to UTC (never throws).
// - A missing/empty schedule means "always open": the feature is opt-in, so
//   existing agents keep answering exactly as before.

import { WEEKDAYS, parseClock, safeTimeZone, wallTimeInZone, weekdayOf, type Weekday } from '@/lib/scheduling/time'

export interface WorkingHourSlot {
  start: string
  end: string
  enabled: boolean
}

export type WorkingHours = Partial<Record<Weekday, WorkingHourSlot>>

export type AfterHoursMode = 'message' | 'forward' | 'ai'

export interface AfterHoursConfig {
  /** Off = ignore the schedule entirely (always open). */
  enabled: boolean
  mode: AfterHoursMode
  /** Spoken (TTS by Twilio <Say>) when mode = message, or before forwarding. */
  message?: string | null
  /** E.164 destination when mode = forward. */
  forward_number?: string | null
}

export const DEFAULT_AFTER_HOURS: AfterHoursConfig = { enabled: false, mode: 'message', message: null, forward_number: null }

export interface WorkingHoursVerdict {
  open: boolean
  /** Why: 'schedule_disabled' (gate off), 'no_schedule', 'in_window', 'outside_window', 'day_closed'. */
  reason: 'schedule_disabled' | 'no_schedule' | 'in_window' | 'outside_window' | 'day_closed'
  timeZone: string
  localWeekday: Weekday
  localTime: string
}

const MINUTES_PER_DAY = 24 * 60

function previousWeekday(day: Weekday): Weekday {
  const i = WEEKDAYS.indexOf(day)
  return WEEKDAYS[(i + 6) % 7]
}

function slotMinutes(slot: WorkingHourSlot | undefined): { start: number; end: number } | null {
  if (!slot || !slot.enabled) return null
  const start = parseClock(slot.start)
  const end = parseClock(slot.end)
  if (start === null || end === null || start >= MINUTES_PER_DAY) return null
  return { start, end }
}

/** Whether the business is open at `now` according to `hours` in `timeZone`. */
export function evaluateWorkingHours(
  hours: WorkingHours | null | undefined,
  timeZoneRaw: string | null | undefined,
  config: Pick<AfterHoursConfig, 'enabled'> | null | undefined,
  now: Date = new Date(),
): WorkingHoursVerdict {
  const timeZone = safeTimeZone(timeZoneRaw)
  const wall = wallTimeInZone(now.getTime(), timeZone)
  const today = weekdayOf({ year: wall.year, month: wall.month, day: wall.day })
  const minute = wall.hour * 60 + wall.minute
  const localTime = `${String(wall.hour).padStart(2, '0')}:${String(wall.minute).padStart(2, '0')}`
  const base = { timeZone, localWeekday: today, localTime }

  if (!config?.enabled) return { open: true, reason: 'schedule_disabled', ...base }
  const days = hours ?? {}
  const anyEnabled = WEEKDAYS.some((d) => slotMinutes(days[d]) !== null)
  if (!anyEnabled) {
    // Gate enabled but every day closed/invalid: treat as "always closed" only
    // when at least one day is explicitly configured; otherwise no schedule.
    const configured = WEEKDAYS.some((d) => days[d] !== undefined)
    return configured ? { open: false, reason: 'day_closed', ...base } : { open: true, reason: 'no_schedule', ...base }
  }

  const todaySlot = slotMinutes(days[today])
  if (todaySlot) {
    const { start, end } = todaySlot
    if (start === end) return { open: true, reason: 'in_window', ...base } // 24h
    if (end > start) {
      if (minute >= start && minute < end) return { open: true, reason: 'in_window', ...base }
    } else if (minute >= start) {
      return { open: true, reason: 'in_window', ...base } // overnight, before midnight
    }
  }

  // Overnight window that started yesterday and is still running.
  const ySlot = slotMinutes(days[previousWeekday(today)])
  if (ySlot && ySlot.end < ySlot.start && minute < ySlot.end) {
    return { open: true, reason: 'in_window', ...base }
  }

  return { open: false, reason: todaySlot ? 'outside_window' : 'day_closed', ...base }
}

/** Default after-hours line per language (Romanian with proper diacritics). */
export const AFTER_HOURS_MESSAGE: Record<string, string> = {
  en: 'Thank you for calling. We are currently closed. Please call us back during our business hours.',
  ro: 'Vă mulțumim pentru apel. În acest moment programul nostru s-a încheiat. Vă rugăm să reveniți în timpul programului de lucru.',
  es: 'Gracias por llamar. En este momento estamos cerrados. Por favor, llámenos durante nuestro horario de atención.',
  fr: 'Merci de votre appel. Nous sommes actuellement fermés. Merci de nous rappeler pendant nos heures d’ouverture.',
  de: 'Vielen Dank für Ihren Anruf. Wir haben derzeit geschlossen. Bitte rufen Sie während unserer Geschäftszeiten an.',
  it: 'Grazie per la chiamata. Al momento siamo chiusi. La preghiamo di richiamare durante il nostro orario di apertura.',
  pt: 'Obrigado pela sua chamada. De momento estamos encerrados. Por favor, ligue-nos durante o nosso horário de funcionamento.',
  pl: 'Dziękujemy za telefon. Obecnie jesteśmy zamknięci. Prosimy zadzwonić w godzinach pracy.',
  nl: 'Bedankt voor uw oproep. We zijn momenteel gesloten. Belt u ons alstublieft terug tijdens onze openingstijden.',
  ja: 'お電話ありがとうございます。ただいま営業時間外です。営業時間内におかけ直しください。',
  ko: '전화 주셔서 감사합니다. 지금은 영업시간이 아닙니다. 영업시간에 다시 전화해 주세요.',
  zh: '感谢您的来电。我们目前不在营业时间内。请在营业时间内再拨打。',
  ar: 'شكراً لاتصالك. نحن مغلقون حالياً. يرجى الاتصال بنا خلال ساعات العمل.',
  hi: 'कॉल करने के लिए धन्यवाद। अभी हमारा कार्यालय बंद है। कृपया कार्य समय के दौरान फिर से कॉल करें।',
}
