'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarCheck, CalendarDays, CheckCircle2, Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UpgradeNotice } from '@/components/shared/UpgradeNotice'
import { WorkingHoursEditor } from '@/components/agent/WorkingHoursEditor'
import { cn } from '@/lib/utils'
import { normalizeWorkingHours, validateWorkingHours } from '@/app/api/scheduling/hours'
import type { SchedulingSettingsInput } from '@/app/api/scheduling/schema'
import { SectionError, SkillSection, type SkillStatusTone } from '@/components/skills/SkillSection'
import { ServicesEditor, newServiceKey, serviceErrors, type ServiceDraft } from '@/components/skills/ServicesEditor'
import { errorMessage, isAbortError, requestJson } from '@/components/skills/request'
import type { SchedulingResponse } from '@/components/skills/types'
import type { WorkingHours } from '@/types'

const GOOGLE_CONNECT_URL = `/api/integrations/google/connect?type=google_calendar&return_to=${encodeURIComponent('/agent?tab=skills')}`

const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120]
const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60]
const NOTICE_OPTIONS = [0, 30, 60, 120, 240, 720, 1440, 2880]
const DAYS_AHEAD_OPTIONS = [7, 14, 30, 60, 90, 180, 365]
const REMINDER_OPTIONS = [1, 2, 3, 6, 12, 24, 48, 72]

function minutesLabel(minutes: number): string {
  if (minutes === 0) return 'None'
  if (minutes < 60) return `${minutes} minutes`
  if (minutes % 1440 === 0) return minutes === 1440 ? '1 day' : `${minutes / 1440} days`
  if (minutes % 60 === 0) return minutes === 60 ? '1 hour' : `${minutes / 60} hours`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

function withCurrent(options: number[], current: number): number[] {
  return options.includes(current) ? options : [...options, current].sort((a, b) => a - b)
}

interface Draft {
  calendar_id: string
  slot_minutes: number
  buffer_minutes: number
  min_notice_minutes: number
  max_days_ahead: number
  business_hours: WorkingHours
  services: ServiceDraft[]
  send_sms_confirmation: boolean
  send_reminders: boolean
  reminder_hours_before: number
}

function toDraft(settings: SchedulingSettingsInput): Draft {
  return {
    ...settings,
    business_hours: normalizeWorkingHours(settings.business_hours),
    services: settings.services.map((s) => ({ key: newServiceKey(), name: s.name, duration: String(s.duration_minutes) })),
  }
}

function toInput(draft: Draft): SchedulingSettingsInput {
  return {
    ...draft,
    services: draft.services.map((s) => ({ name: s.name.trim(), duration_minutes: Number(s.duration) })),
  }
}

function sameSettings(a: SchedulingSettingsInput, b: SchedulingSettingsInput): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

interface BookingSkillProps {
  agentWorkingHours: WorkingHours
  onDirtyChange?: (dirty: boolean) => void
  /** Called after a save; the agent's providers update in the background. */
  onSaved?: () => void
}

export function BookingSkill({ agentWorkingHours, onDirtyChange, onSaved }: BookingSkillProps) {
  const [data, setData] = useState<SchedulingResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    requestJson<SchedulingResponse>('/api/scheduling', { signal: controller.signal })
      .then((res) => {
        setData(res)
        setDraft(toDraft(res.settings))
        setLoadError(null)
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setLoadError(errorMessage(error, 'We couldn’t load your booking settings.'))
      })
    return () => controller.abort()
  }, [reloadKey])

  const input = draft ? toInput(draft) : null
  const dirty = Boolean(data && input && !sameSettings(input, data.settings))
  // The agent only books once a settings row exists (the call pipeline checks
  // for it), so untouched defaults still need one save to switch booking on.
  const needsFirstSave = Boolean(data && data.entitled && data.available && !data.saved)

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const retry = useCallback(() => {
    setLoadError(null)
    setData(null)
    setReloadKey((k) => k + 1)
  }, [])

  const status = ((): { label: string; tone: SkillStatusTone } | null => {
    if (!data) return null
    if (!data.entitled) return { label: 'Not in your plan', tone: 'off' }
    if (!data.available) return { label: 'Coming soon', tone: 'off' }
    if (!data.google.configured) return { label: 'Unavailable', tone: 'off' }
    if (!data.google.connected) return { label: 'Connect Google Calendar', tone: 'warning' }
    if (!data.saved) return { label: 'Save to turn on', tone: 'warning' }
    return { label: 'On', tone: 'on' }
  })()

  const description =
    'Your agent checks your real availability in Google Calendar, offers open times and books the appointment during the call. Callers can also move or cancel bookings.'

  if (loadError) {
    return (
      <SkillSection id="booking" icon={CalendarCheck} title="Booking" description={description}>
        <SectionError message={loadError} onRetry={retry} />
      </SkillSection>
    )
  }

  if (!data || !draft || !input) {
    return (
      <SkillSection id="booking" icon={CalendarCheck} title="Booking" description={description}>
        <div className="space-y-4" aria-busy="true" aria-label="Loading booking settings">
          <Skeleton className="h-14 w-full" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      </SkillSection>
    )
  }

  if (!data.entitled) {
    return (
      <SkillSection id="booking" icon={CalendarCheck} title="Booking" description={description} status={status}>
        <UpgradeNotice
          feature="Booking into Google Calendar"
          requiredPlan={data.required_plan}
          description="Let your agent book, move and cancel appointments in your calendar while the caller is on the line."
        />
      </SkillSection>
    )
  }

  if (!data.available) {
    return (
      <SkillSection id="booking" icon={CalendarCheck} title="Booking" description={description} status={status}>
        <p className="rounded-lg bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
          Booking isn’t switched on for your account yet. We’re finishing an update; please check back soon.
        </p>
      </SkillSection>
    )
  }

  const hoursErrors = validateWorkingHours(draft.business_hours)
  const svcErrors = serviceErrors(draft.services)
  const invalid = Object.keys(hoursErrors).length > 0 || Object.keys(svcErrors).length > 0
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d))

  const save = async () => {
    if (invalid || !input) return
    setSaving(true)
    try {
      const res = await requestJson<{ settings: SchedulingSettingsInput }>('/api/scheduling', { method: 'PUT', body: input })
      const firstSave = !data?.saved
      setData((prev) => (prev ? { ...prev, settings: res.settings, saved: true } : prev))
      setDraft(toDraft(res.settings))
      toast.success(
        firstSave && data?.google.connected ? 'Booking is on' : 'Booking settings saved',
        firstSave && data?.google.connected ? { description: 'Your agent can now book appointments during calls.' } : undefined
      )
      onSaved?.()
    } catch (error) {
      toast.error('Booking settings weren’t saved', { description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const calendars = data.calendars
  const smsLocked = !data.sms.entitled
  const smsOff = !data.sms.org_enabled

  return (
    <SkillSection id="booking" icon={CalendarCheck} title="Booking" description={description} status={status}>
      <div className="space-y-6">
        {/* Google Calendar connection */}
        <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            {data.google.connected ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" aria-hidden="true" />
            ) : (
              <CalendarDays className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {data.google.connected ? 'Google Calendar connected' : 'Google Calendar isn’t connected'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {data.google.connected
                  ? data.google.account_email ?? 'Your agent books into this calendar.'
                  : data.google.configured
                    ? 'Connect it so your agent can see when you’re free and add bookings.'
                    : 'Google connections are temporarily unavailable. Please check back later.'}
              </p>
            </div>
          </div>
          {data.google.configured && (
            <a
              href={GOOGLE_CONNECT_URL}
              className={cn(buttonVariants({ variant: data.google.connected ? 'outline' : 'default', size: 'sm' }), 'self-start sm:self-auto')}
            >
              {data.google.connected ? 'Reconnect' : 'Connect Google Calendar'}
            </a>
          )}
        </div>

        {data.google.connected && (
          <div className="space-y-2">
            <Label htmlFor="booking-calendar">Calendar to book into</Label>
            {calendars && calendars.length > 0 ? (
              <Select value={draft.calendar_id} onValueChange={(v) => v && set('calendar_id', v)}>
                <SelectTrigger id="booking-calendar" className="w-full sm:max-w-sm">
                  <SelectValue>
                    {(value: string) =>
                      value === 'primary'
                        ? calendars.find((c) => c.primary)?.name ?? 'Main calendar'
                        : calendars.find((c) => c.id === value)?.name ?? value
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {!calendars.some((c) => c.id === draft.calendar_id) && draft.calendar_id !== 'primary' && (
                    <SelectItem value={draft.calendar_id}>{draft.calendar_id}</SelectItem>
                  )}
                  {calendars.map((c) => (
                    <SelectItem key={c.id} value={c.primary ? 'primary' : c.id}>
                      {c.name}
                      {c.primary ? ' (main)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                {draft.calendar_id === 'primary' ? 'Your main calendar' : draft.calendar_id}
              </p>
            )}
            {data.calendars_error && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {data.calendars_error}
              </p>
            )}
          </div>
        )}

        {/* Services */}
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">Services</p>
            <p className="text-xs text-muted-foreground">What callers can book, and how long each one takes.</p>
          </div>
          <ServicesEditor value={draft.services} onChange={(services) => set('services', services)} />
        </div>

        {/* Rules */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberSelect
            id="slot-minutes"
            label="Appointment length"
            help="Used when a service has no length of its own."
            value={draft.slot_minutes}
            options={withCurrent(SLOT_OPTIONS, draft.slot_minutes)}
            format={minutesLabel}
            onChange={(v) => set('slot_minutes', v)}
          />
          <NumberSelect
            id="buffer-minutes"
            label="Break between appointments"
            help="Kept free after each booking."
            value={draft.buffer_minutes}
            options={withCurrent(BUFFER_OPTIONS, draft.buffer_minutes)}
            format={minutesLabel}
            onChange={(v) => set('buffer_minutes', v)}
          />
          <NumberSelect
            id="min-notice"
            label="Minimum notice"
            help="The soonest a caller can book from now."
            value={draft.min_notice_minutes}
            options={withCurrent(NOTICE_OPTIONS, draft.min_notice_minutes)}
            format={minutesLabel}
            onChange={(v) => set('min_notice_minutes', v)}
          />
          <NumberSelect
            id="days-ahead"
            label="How far ahead"
            help="The latest date a caller can book."
            value={draft.max_days_ahead}
            options={withCurrent(DAYS_AHEAD_OPTIONS, draft.max_days_ahead)}
            format={(d) => (d === 1 ? '1 day' : `${d} days`)}
            onChange={(v) => set('max_days_ahead', v)}
          />
        </div>

        {/* Hours */}
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium">Bookable hours</p>
              <p className="text-xs text-muted-foreground">Appointments are only offered inside these hours ({data.timezone}).</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start sm:self-auto"
              onClick={() => set('business_hours', normalizeWorkingHours(agentWorkingHours))}
            >
              Use my working hours
            </Button>
          </div>
          <WorkingHoursEditor
            value={draft.business_hours}
            onChange={(hours) => set('business_hours', hours)}
            errors={hoursErrors}
            idPrefix="booking-hours"
            allowAlwaysOpen={false}
          />
        </div>

        {/* Texts */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Text messages to callers</p>
            <p className="text-xs text-muted-foreground">Sent from your phone number, in your agent’s language.</p>
          </div>
          {smsLocked ? (
            <UpgradeNotice compact feature="Booking texts" requiredPlan={data.sms.required_plan} />
          ) : smsOff ? (
            <p className="text-xs text-muted-foreground">
              Texts are turned off for your business.{' '}
              <Link href="/settings" className="text-primary underline-offset-4 hover:underline">
                Turn them on in Settings
              </Link>
              .
            </p>
          ) : null}
          <div className="divide-y rounded-lg border">
            <ToggleRow
              id="send-confirmation"
              label="Confirmation after booking"
              description="The caller gets the date, time and service by text."
              checked={!smsLocked && draft.send_sms_confirmation}
              onChange={(v) => set('send_sms_confirmation', v)}
              disabled={smsLocked}
            />
            <ToggleRow
              id="send-reminders"
              label="Reminder before the appointment"
              description="Helps cut no-shows."
              checked={!smsLocked && draft.send_reminders}
              onChange={(v) => set('send_reminders', v)}
              disabled={smsLocked}
            >
              {!smsLocked && draft.send_reminders && (
                <div className="mt-2 flex items-center gap-2">
                  <Label htmlFor="reminder-hours" className="text-xs text-muted-foreground">
                    Send it
                  </Label>
                  <Select
                    value={String(draft.reminder_hours_before)}
                    onValueChange={(v) => v && set('reminder_hours_before', Number(v))}
                    disabled={smsLocked}
                  >
                    <SelectTrigger id="reminder-hours" size="sm" className="w-36">
                      <SelectValue>{(value: string) => `${minutesLabel(Number(value) * 60)} before`}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {withCurrent(REMINDER_OPTIONS, draft.reminder_hours_before).map((h) => (
                        <SelectItem key={h} value={String(h)}>
                          {minutesLabel(h * 60)} before
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </ToggleRow>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {invalid && (dirty || needsFirstSave) ? (
              <span className="text-destructive">Fix the fields marked in red to save.</span>
            ) : dirty ? (
              'You have unsaved booking changes.'
            ) : needsFirstSave ? (
              <span className="text-amber-700 dark:text-amber-400">
                {data.google.connected
                  ? 'Check these settings and save them to let your agent start booking.'
                  : data.google.configured
                    ? 'Save these settings, then connect Google Calendar to start booking.'
                    : 'Save these settings so booking is ready when Google Calendar connections are available.'}
              </span>
            ) : (
              'Booking settings are saved.'
            )}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft(toDraft(data.settings))}
              disabled={!dirty || saving}
              className="flex-1 sm:flex-none"
            >
              Discard
            </Button>
            <Button type="button" onClick={save} disabled={(!dirty && !needsFirstSave) || saving || invalid} className="flex-1 sm:flex-none">
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              {saving ? 'Saving…' : 'Save booking settings'}
            </Button>
          </div>
        </div>
      </div>
    </SkillSection>
  )
}

function NumberSelect({
  id,
  label,
  help,
  value,
  options,
  format,
  onChange,
}: {
  id: string
  label: string
  help: string
  value: number
  options: number[]
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={String(value)} onValueChange={(v) => v && onChange(Number(v))}>
        <SelectTrigger id={id} className="w-full" aria-describedby={`${id}-help`}>
          <SelectValue>{(v: string) => format(Number(v))}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {format(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {help}
      </p>
    </div>
  )
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
  children,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label htmlFor={id} className="text-sm font-medium">
            {label}
          </Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
      </div>
      {children}
    </div>
  )
}
