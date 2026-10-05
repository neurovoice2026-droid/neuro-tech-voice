'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Bot, Copy, Info, MessageSquareText, MoonStar, PhoneForwarded } from 'lucide-react'
import { FieldError, SaveBar, SettingSwitch } from './TabConversation'
import { readAgentSettings, type AgentHook } from '@/hooks/useAgent'
import { AfterHoursSchema, WorkingHoursSchema } from '@/lib/voice-providers/settings'
import {
  AFTER_HOURS_MESSAGE,
  evaluateWorkingHours,
  type AfterHoursConfig,
  type AfterHoursMode,
  type WorkingHours,
} from '@/lib/voice-providers/working-hours'
import { WEEKDAYS, type Weekday } from '@/lib/scheduling/time'
import { normalizeE164 } from '@/lib/phone/e164'
import { cn } from '@/lib/utils'
import type { Agent } from '@/types'

// ─── Time zones ──────────────────────────────────────────────────────────────

const FALLBACK_TIME_ZONES = [
  'UTC',
  'Europe/Bucharest', 'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Europe/Madrid', 'Europe/Paris',
  'Europe/Brussels', 'Europe/Amsterdam', 'Europe/Berlin', 'Europe/Zurich', 'Europe/Rome', 'Europe/Vienna',
  'Europe/Prague', 'Europe/Warsaw', 'Europe/Budapest', 'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen',
  'Europe/Helsinki', 'Europe/Athens', 'Europe/Istanbul', 'Europe/Chisinau', 'Europe/Kyiv',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles',
  'America/Toronto', 'America/Vancouver', 'America/Mexico_City', 'America/Sao_Paulo', 'America/Buenos_Aires',
  'Africa/Johannesburg', 'Africa/Cairo', 'Africa/Lagos',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Australia/Perth', 'Pacific/Auckland',
]

function timeZoneOptions(current: string): string[] {
  const supported =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : FALLBACK_TIME_ZONES
  const zones = new Set(supported.length ? supported : FALLBACK_TIME_ZONES)
  zones.add('UTC')
  if (current) zones.add(current)
  return [...zones].sort((a, b) => (a === 'UTC' ? -1 : b === 'UTC' ? 1 : a.localeCompare(b)))
}

function browserTimeZone(): string | null {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return typeof tz === 'string' && tz ? tz : null
}

/** "UTC+03:00"-style offset of a zone right now (for the selected value only). */
function zoneOffsetLabel(timeZone: string, now: Date): string | null {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(now)
  } catch (err) {
    // Older engines reject 'longOffset' (RangeError): the offset is a nicety, show the zone alone.
    if (err instanceof RangeError) return null
    throw err
  }
  const part = parts.find((p) => p.type === 'timeZoneName')
  if (!part) return null
  return part.value === 'GMT' ? 'UTC' : part.value.replace('GMT', 'UTC')
}

// ─── Draft ───────────────────────────────────────────────────────────────────

interface DayDraft {
  enabled: boolean
  start: string
  end: string
}

interface Draft {
  timezone: string
  days: Record<Weekday, DayDraft>
  afterHoursEnabled: boolean
  mode: AfterHoursMode
  message: string
  forwardNumber: string
}

const DAY_LABEL: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

const WEEKEND = new Set<Weekday>(['saturday', 'sunday'])
const AFTER_HOURS_MESSAGE_MAX = 500

function daysFrom(hours: WorkingHours): Record<Weekday, DayDraft> {
  const configured = WEEKDAYS.some((d) => hours[d] !== undefined)
  return Object.fromEntries(
    WEEKDAYS.map((d) => {
      const slot = hours[d]
      if (slot) return [d, { enabled: slot.enabled, start: slot.start, end: slot.end }]
      // Nothing saved yet: suggest Mon–Fri 09:00–18:00 (only applied once saved).
      return [d, { enabled: !configured && !WEEKEND.has(d), start: '09:00', end: '18:00' }]
    }),
  ) as Record<Weekday, DayDraft>
}

function draftFrom(agent: Agent, timezone: string): Draft {
  const { workingHours, afterHours } = readAgentSettings(agent)
  return {
    timezone,
    days: daysFrom(workingHours),
    afterHoursEnabled: afterHours.enabled,
    mode: afterHours.mode,
    message: afterHours.message ?? '',
    forwardNumber: afterHours.forward_number ?? '',
  }
}

type FieldErrors = Partial<Record<Weekday | 'message' | 'forward_number', string>>

function buildPayload(draft: Draft): { value: { working_hours: WorkingHours; after_hours: AfterHoursConfig } | null; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const clock = /^([01]\d|2[0-3]):[0-5]\d$/
  const working_hours: WorkingHours = {}
  for (const d of WEEKDAYS) {
    const day = draft.days[d]
    if (day.enabled && (!clock.test(day.start) || !clock.test(day.end))) {
      errors[d] = 'Enter an opening and a closing time.'
    }
    // Disabled days keep their times so re-enabling restores them.
    working_hours[d] = {
      enabled: day.enabled,
      start: clock.test(day.start) ? day.start : '09:00',
      end: clock.test(day.end) ? day.end : '18:00',
    }
  }

  const message = draft.message.trim()
  if (message.length > AFTER_HOURS_MESSAGE_MAX) errors.message = `Keep it under ${AFTER_HOURS_MESSAGE_MAX} characters.`
  const typedNumber = draft.forwardNumber.trim()
  const forward = typedNumber ? normalizeE164(typedNumber) : null
  if (draft.mode === 'forward') {
    if (typedNumber && !forward) errors.forward_number = 'Use the international format, e.g. +40712345678.'
    else if (!typedNumber && draft.afterHoursEnabled) errors.forward_number = 'Enter the number to forward calls to.'
  }

  const after_hours: AfterHoursConfig = {
    enabled: draft.afterHoursEnabled,
    mode: draft.mode,
    message: message || null,
    forward_number: forward,
  }

  const hoursParsed = WorkingHoursSchema.safeParse(working_hours)
  const afterParsed = AfterHoursSchema.safeParse(after_hours)
  if (!afterParsed.success) {
    for (const issue of afterParsed.error.issues) {
      const key = issue.path[0] === 'forward_number' ? 'forward_number' : issue.path[0] === 'message' ? 'message' : null
      if (key && !errors[key]) errors[key] = issue.message
    }
  }
  if (!hoursParsed.success && Object.keys(errors).length === 0) errors.monday = 'Some opening hours are invalid.'
  const ok = Object.keys(errors).length === 0 && hoursParsed.success && afterParsed.success
  return { value: ok ? { working_hours, after_hours } : null, errors }
}

function dayNote(day: DayDraft): string | null {
  if (!day.enabled) return null
  if (day.start === day.end) return 'Open 24 hours'
  if (day.end < day.start) return `Closes next day at ${day.end}`
  return null
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

interface TabAvailabilityProps {
  agent: Agent
  /** null while the org's time zone is still loading. */
  timezone: string | null
  timezoneUnavailable: boolean
  onUpdate: AgentHook['updateWithToast']
  onTimezoneSaved: (timezone: string) => void
  isSaving: boolean
}

export function TabAvailability({ timezone, timezoneUnavailable, ...rest }: TabAvailabilityProps) {
  if (timezone === null && !timezoneUnavailable) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading availability settings">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }
  return <AvailabilityForm initialTimezone={timezone} {...rest} />
}

type FormProps = Omit<TabAvailabilityProps, 'timezone' | 'timezoneUnavailable'> & {
  /** null = the org's zone could not be read; it is then shown read-only and never saved. */
  initialTimezone: string | null
}

const MODES: Array<{ value: AfterHoursMode; title: string; description: string; icon: typeof Bot }> = [
  {
    value: 'message',
    title: 'Play a message',
    description: 'Callers hear a short closed message, then the call ends.',
    icon: MessageSquareText,
  },
  {
    value: 'forward',
    title: 'Forward to a phone number',
    description: 'Calls go straight to another number, e.g. an on-call mobile.',
    icon: PhoneForwarded,
  },
  {
    value: 'ai',
    title: 'Let the AI answer',
    description: "Your agent answers, tells callers you're closed and takes a message.",
    icon: Bot,
  },
]

function AvailabilityForm({ agent, initialTimezone, onUpdate, onTimezoneSaved, isSaving }: FormProps) {
  const timezoneKnown = initialTimezone !== null
  const [savedTimezone, setSavedTimezone] = useState(initialTimezone ?? 'UTC')
  const saved = useMemo(() => draftFrom(agent, savedTimezone), [agent, savedTimezone])
  const [draft, setDraft] = useState<Draft>(saved)
  const [showErrors, setShowErrors] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [browserZone] = useState(browserTimeZone)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const zones = useMemo(() => timeZoneOptions(draft.timezone), [draft.timezone])
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const { value, errors } = buildPayload(draft)
  const visibleErrors: FieldErrors = showErrors ? errors : {}

  const verdict = evaluateWorkingHours(previewHours(draft), draft.timezone, { enabled: draft.afterHoursEnabled }, now)
  const offset = zoneOffsetLabel(verdict.timeZone, now)

  const setDay = (day: Weekday, patch: Partial<DayDraft>) =>
    setDraft((d) => ({ ...d, days: { ...d.days, [day]: { ...d.days[day], ...patch } } }))

  const copyToAll = (day: Weekday) =>
    setDraft((d) => ({
      ...d,
      days: Object.fromEntries(WEEKDAYS.map((w) => [w, { ...d.days[day] }])) as Record<Weekday, DayDraft>,
    }))

  const handleSave = async () => {
    if (!value) {
      setShowErrors(true)
      return
    }
    const next = await onUpdate(
      {
        working_hours: value.working_hours,
        after_hours: value.after_hours,
        ...(timezoneKnown ? { organization: { timezone: draft.timezone } } : {}),
      },
      'Availability saved',
    )
    if (next) {
      if (timezoneKnown) {
        setSavedTimezone(draft.timezone)
        onTimezoneSaved(draft.timezone)
      }
      setDraft(draftFrom(next, timezoneKnown ? draft.timezone : savedTimezone))
      setShowErrors(false)
    }
  }

  const discard = () => {
    setDraft(saved)
    setShowErrors(false)
  }

  const defaultMessage = AFTER_HOURS_MESSAGE[agent.language] ?? AFTER_HOURS_MESSAGE.en

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Working hours</CardTitle>
          <CardDescription>
            Working hours apply to every incoming call before any voice provider is used, the same for your primary
            and your backup voice agent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SettingSwitch
            id="hours-apply"
            label="Apply working hours to incoming calls"
            description="When off, your agent answers every call at any time and the schedule below is ignored."
            checked={draft.afterHoursEnabled}
            onCheckedChange={(v) => setDraft((d) => ({ ...d, afterHoursEnabled: v }))}
          />

          {/* Time zone */}
          <div className="space-y-1.5">
            <Label htmlFor="hours-timezone">Time zone</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={draft.timezone}
                onValueChange={(v) => v && setDraft((d) => ({ ...d, timezone: String(v) }))}
                disabled={!timezoneKnown}
              >
                <SelectTrigger id="hours-timezone" className="w-full sm:w-72">
                  <SelectValue>
                    {(v: string) => (!timezoneKnown ? 'Unavailable' : offset && v === verdict.timeZone ? `${v} (${offset})` : v)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {zones.map((z) => (
                    <SelectItem key={z} value={z}>{z}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {timezoneKnown && browserZone && browserZone !== draft.timezone && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraft((d) => ({ ...d, timezone: browserZone }))}
                >
                  Use {browserZone}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {timezoneKnown
                ? 'Your organization’s time zone. Your agent also uses it when talking about days and times.'
                : 'Your time zone could not be loaded. Reload the page to change it.'}
            </p>
          </div>

          {/* Live indicator */}
          {timezoneKnown && <div
            role="status"
            aria-live="polite"
            className={cn(
              'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
              verdict.open
                ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
            )}
          >
            <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', verdict.open ? 'bg-green-500' : 'bg-amber-500')} aria-hidden="true" />
            <span>
              <strong className="font-medium">Right now: {verdict.open ? 'Open' : 'Closed'}</strong>{' '}
              (local time {verdict.localTime}, {verdict.timeZone})
              {!draft.afterHoursEnabled && ' — working hours are not applied, so every call is answered.'}
              {draft.afterHoursEnabled && verdict.reason === 'no_schedule' && ' — no open days are set, so every call is answered.'}
              {isDirty && <span className="block text-xs opacity-80">Preview with your unsaved changes.</span>}
            </span>
          </div>}

          {/* Weekly schedule */}
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Weekly schedule</legend>
            <ul className="divide-y rounded-lg border">
              {WEEKDAYS.map((d) => {
                const day = draft.days[d]
                const note = dayNote(day)
                const error = visibleErrors[d]
                return (
                  <li key={d} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex w-full items-center gap-3 sm:w-36 sm:shrink-0">
                      <Switch
                        id={`hours-${d}-enabled`}
                        checked={day.enabled}
                        onCheckedChange={(v) => setDay(d, { enabled: v })}
                      />
                      <Label htmlFor={`hours-${d}-enabled`} className="text-sm">{DAY_LABEL[d]}</Label>
                    </div>
                    {day.enabled ? (
                      <div className="flex flex-1 flex-wrap items-center gap-2">
                        <Input
                          type="time"
                          aria-label={`${DAY_LABEL[d]} opening time`}
                          value={day.start}
                          onChange={(e) => setDay(d, { start: e.target.value })}
                          className="h-8 w-28"
                          aria-invalid={error ? true : undefined}
                        />
                        <span className="text-muted-foreground" aria-hidden="true">–</span>
                        <Input
                          type="time"
                          aria-label={`${DAY_LABEL[d]} closing time`}
                          value={day.end}
                          onChange={(e) => setDay(d, { end: e.target.value })}
                          className="h-8 w-28"
                          aria-invalid={error ? true : undefined}
                        />
                        {note && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><MoonStar className="size-3" aria-hidden="true" />{note}</span>}
                        {error && <FieldError id={`hours-${d}-error`}>{error}</FieldError>}
                      </div>
                    ) : (
                      <span className="flex-1 text-sm text-muted-foreground">Closed</span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start sm:self-auto"
                      onClick={() => copyToAll(d)}
                      aria-label={`Copy ${DAY_LABEL[d]}'s hours to every day`}
                      title="Copy to all days"
                    >
                      <Copy aria-hidden="true" />
                      <span className="sm:sr-only">Copy to all days</span>
                    </Button>
                  </li>
                )
              })}
            </ul>
            <p className="text-xs text-muted-foreground">
              A closing time earlier than the opening time runs past midnight (e.g. 22:00–06:00). The same opening
              and closing time means open 24 hours.
            </p>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">When you&apos;re closed</CardTitle>
          <CardDescription>
            What happens to calls outside working hours.
            {!draft.afterHoursEnabled && ' Turn on “Apply working hours to incoming calls” to use this.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset disabled={!draft.afterHoursEnabled} className="space-y-2 disabled:opacity-60">
            <legend className="sr-only">After-hours handling</legend>
            {MODES.map((m) => {
              const Icon = m.icon
              const checked = draft.mode === m.value
              return (
                <label
                  key={m.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                    checked ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/40',
                  )}
                >
                  <input
                    type="radio"
                    name="after-hours-mode"
                    value={m.value}
                    checked={checked}
                    onChange={() => setDraft((d) => ({ ...d, mode: m.value }))}
                    className="mt-1 accent-primary"
                  />
                  <Icon className={cn('mt-0.5 size-4 shrink-0', checked ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{m.title}</span>
                    <span className="block text-xs text-muted-foreground">{m.description}</span>
                  </span>
                </label>
              )
            })}
          </fieldset>

          {draft.mode === 'forward' && (
            <div className="space-y-1.5">
              <Label htmlFor="hours-forward">Forward to</Label>
              <Input
                id="hours-forward"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+40712345678"
                value={draft.forwardNumber}
                onChange={(e) => setDraft((d) => ({ ...d, forwardNumber: e.target.value }))}
                disabled={!draft.afterHoursEnabled}
                className="max-w-xs font-mono"
                aria-invalid={visibleErrors.forward_number ? true : undefined}
                aria-describedby={visibleErrors.forward_number ? 'hours-forward-error' : 'hours-forward-hint'}
              />
              {visibleErrors.forward_number ? (
                <FieldError id="hours-forward-error">{visibleErrors.forward_number}</FieldError>
              ) : (
                <p id="hours-forward-hint" className="text-xs text-muted-foreground">International format, e.g. +40712345678.</p>
              )}
            </div>
          )}

          {(draft.mode === 'message' || draft.mode === 'forward') && (
            <div className="space-y-1.5">
              <Label htmlFor="hours-message">
                {draft.mode === 'message' ? 'Closed message' : 'Message before forwarding (optional)'}
              </Label>
              <Textarea
                id="hours-message"
                value={draft.message}
                onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
                placeholder={draft.mode === 'message' ? defaultMessage : 'Please hold while we connect you.'}
                rows={3}
                maxLength={AFTER_HOURS_MESSAGE_MAX}
                disabled={!draft.afterHoursEnabled}
                className="resize-none"
                aria-invalid={visibleErrors.message ? true : undefined}
                aria-describedby={visibleErrors.message ? 'hours-message-error' : 'hours-message-hint'}
              />
              {visibleErrors.message ? (
                <FieldError id="hours-message-error">{visibleErrors.message}</FieldError>
              ) : (
                <p id="hours-message-hint" className="text-xs text-muted-foreground">
                  {draft.mode === 'message'
                    ? 'Leave blank to use the default message in your agent’s language (shown above).'
                    : 'Leave blank to forward without a message.'}
                </p>
              )}
            </div>
          )}

          {draft.mode === 'ai' && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Calls are answered as usual (by the backup voice agent too, if ElevenLabs is unavailable); the agent knows
              you are closed and offers to take a message.
            </p>
          )}
        </CardContent>
      </Card>

      <SaveBar
        dirty={isDirty}
        saving={isSaving}
        onSave={() => void handleSave()}
        onDiscard={discard}
        blocked={showErrors && !value}
      />
      {showErrors && !value && (
        <p role="status" className="text-xs text-destructive">Fix the highlighted fields to save.</p>
      )}
    </div>
  )
}

/** Schedule for the live preview even while some field is invalid (invalid days count as closed). */
function previewHours(draft: Draft): WorkingHours {
  const clock = /^([01]\d|2[0-3]):[0-5]\d$/
  return Object.fromEntries(
    WEEKDAYS.map((d) => {
      const day = draft.days[d]
      const valid = clock.test(day.start) && clock.test(day.end)
      return [d, { enabled: day.enabled && valid, start: valid ? day.start : '00:00', end: valid ? day.end : '00:00' }]
    }),
  ) as WorkingHours
}
