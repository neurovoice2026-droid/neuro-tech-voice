'use client'

// Call handling → Appointments and Messages (slice B2): the in-call booking
// tools (Google Calendar) and the take-message tool with its e-mail alert.
// Saved through PUT /api/agent/business-tools (validated server-side; the
// columns are platform-managed), which also pushes the agent config.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { AlertCircle, AlertTriangle, ExternalLink, Info, Mail, Plus, RotateCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, FormSection } from '@/components/shared/FormSection'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { StatusChip } from '@/components/shared/StatusChip'
import { SaveBar, SettingSwitch, parseInteger } from '@/components/agent/tabs/TabConversation'
import { errorMessage, isAbortError, parseApiError } from '@/hooks/useVoiceCatalog'
import { BookingSettingsSchema, MAX_EXTRA_MESSAGE_RECIPIENTS, MessageSettingsSchema } from '@/lib/voice-providers/settings'
import { DEFAULT_BOOKING_SETTINGS, DEFAULT_MESSAGE_SETTINGS, type BookingSettings, type MessageSettings } from '@/lib/voice-providers/types'

interface BusinessToolsState {
  booking: BookingSettings
  messages: MessageSettings
  calendar: { configured: boolean; connected: boolean; needs_reconnect: boolean; connect_url: string }
  owner_email: string | null
  owner_email_verified: boolean
}

interface SyncReport {
  provider: string
  status: string
  error: string | null
}

/** Where Google sends the owner back after connecting (allow-listed by the OAuth routes). */
const CONNECT_RETURN_PATH = '/agent?tab=call-handling'

/** The connect URL from the API, with the return path to this tab. */
function connectUrlWithReturn(connectUrl: string): string {
  const [path, query = ''] = connectUrl.split('?')
  const params = new URLSearchParams(query)
  params.set('return_to', CONNECT_RETURN_PATH)
  return `${path}?${params.toString()}`
}

const APPOINTMENTS_DESCRIPTION = 'Let the agent check your Google Calendar and book appointments during calls.'
const MESSAGES_DESCRIPTION = 'Let the agent take a message during the call and alert you right away.'

const DURATIONS = [15, 20, 30, 45, 60, 90, 120]
const BUFFERS = [0, 5, 10, 15, 30, 60]

/** First field error of a 400 `{ details: [{ path, message }] }` response, if any. */
async function errorMessageOf(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string; details?: Array<{ path?: string; message?: string }> } | null
  const first = Array.isArray(body?.details) ? body.details[0] : null
  return first?.message || body?.error || 'Could not save. Please try again.'
}

async function save(patch: { booking?: BookingSettings; messages?: MessageSettings }): Promise<{ booking: BookingSettings; messages: MessageSettings; sync: SyncReport[] } | null> {
  try {
    const res = await fetch('/api/agent/business-tools', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      toast.error(await errorMessageOf(res))
      return null
    }
    return (await res.json()) as { booking: BookingSettings; messages: MessageSettings; sync: SyncReport[] }
  } catch (err) {
    console.warn('Business tool settings save failed', err)
    toast.error('Could not save. Check your connection and try again.')
    return null
  }
}

function toastSaved(label: string, sync: SyncReport[]) {
  const problem = sync.find((s) => s.status === 'failed' || s.status === 'degraded')
  if (problem) toast.warning(`${label} saved`, { description: problem.error ?? 'Your agent will be updated automatically shortly.' })
  else toast.success(`${label} saved`)
}

export function BusinessToolsSection() {
  const [state, setState] = useState<BusinessToolsState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/agent/business-tools', { signal, headers: { Accept: 'application/json' } })
      if (!res.ok) throw await parseApiError(res, 'These settings could not be loaded. Please try again.')
      setState((await res.json()) as BusinessToolsState)
      setLoadError(null)
    } catch (err) {
      if (signal?.aborted || isAbortError(err)) return
      console.warn('Business tool settings could not be loaded', err)
      setLoadError(errorMessage(err, 'These settings could not be loaded. Please try again.'))
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    void load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  const retry = async () => {
    setRetrying(true)
    await load()
    setRetrying(false)
  }

  if (!state && loadError) {
    return (
      <FormSection title="Appointments and messages">
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>These settings could not be loaded.</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" className="tap-44" onClick={() => void retry()} loading={retrying} loadingState="breathing">
              <RotateCw aria-hidden="true" />
              Retry
            </Button>
          </AlertAction>
        </Alert>
      </FormSection>
    )
  }
  if (!state) {
    // The two final sections, each holding roughly the height of its loaded fields
    // (measured at 390 / 640 / 768+ wide), so the sections below do not jump when they arrive.
    return (
      <>
        <FormSection title="Appointments" description={APPOINTMENTS_DESCRIPTION}>
          <div className="min-h-[900px] sm:min-h-[600px] md:min-h-[640px]">
            <OrbLoader size={32} layout="row" label="Loading appointment settings…" className="min-h-14 rounded-2xl bg-secondary px-4" />
          </div>
        </FormSection>
        <FormSection title="Messages" description={MESSAGES_DESCRIPTION}>
          <div className="min-h-[480px] sm:min-h-[410px] md:min-h-[444px]">
            <OrbLoader size={32} layout="row" label="Loading message settings…" className="min-h-14 rounded-2xl bg-secondary px-4" />
          </div>
        </FormSection>
      </>
    )
  }
  return (
    <>
      <AppointmentsCard state={state} onSaved={(booking) => setState((s) => (s ? { ...s, booking } : s))} />
      <MessagesCard state={state} onSaved={(messages) => setState((s) => (s ? { ...s, messages } : s))} />
    </>
  )
}

// ─── Appointments ────────────────────────────────────────────────────────────

interface CalendarOption {
  id: string
  name: string
  primary: boolean
  can_book: boolean
}

interface BookingDraft {
  enabled: boolean
  calendar_id: string
  duration_minutes: number
  buffer_minutes: number
  booking_window_days: string
  min_notice_hours: string
  daily_cap: string
}

function bookingDraftFrom(b: BookingSettings): BookingDraft {
  return {
    enabled: b.enabled,
    calendar_id: b.calendar_id,
    duration_minutes: b.duration_minutes,
    buffer_minutes: b.buffer_minutes,
    booking_window_days: String(b.booking_window_days),
    min_notice_hours: String(b.min_notice_hours),
    daily_cap: b.daily_cap === null ? '' : String(b.daily_cap),
  }
}

function AppointmentsCard({ state, onSaved }: { state: BusinessToolsState; onSaved: (b: BookingSettings) => void }) {
  const saved = useMemo(() => bookingDraftFrom(state.booking), [state.booking])
  const [draft, setDraft] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  // Result of the calendar list request number `key` (Retry starts a new one).
  const [calendarRequest, setCalendarRequest] = useState(0)
  const [calendarResult, setCalendarResult] = useState<{ key: number; calendars: CalendarOption[] | null; error: string | null }>({
    key: -1,
    calendars: null,
    error: null,
  })
  const cal = state.calendar

  useEffect(() => {
    if (!cal.connected) return
    const ctrl = new AbortController()
    const key = calendarRequest
    const fallback = 'Your calendars could not be loaded. Please try again.'
    void (async () => {
      try {
        const res = await fetch('/api/agent/business-tools/calendars', { signal: ctrl.signal, headers: { Accept: 'application/json' } })
        if (!res.ok) throw await parseApiError(res, fallback)
        const data = (await res.json()) as { needs_reconnect?: boolean; calendars?: CalendarOption[] }
        if (ctrl.signal.aborted) return
        setCalendarResult(
          data.needs_reconnect
            ? { key, calendars: null, error: 'Google refused access to your calendars. Reconnect Google Calendar, then try again.' }
            : { key, calendars: Array.isArray(data.calendars) ? data.calendars : [], error: null },
        )
      } catch (err) {
        if (ctrl.signal.aborted || isAbortError(err)) return
        console.warn('Calendars could not be loaded', err)
        setCalendarResult({ key, calendars: null, error: errorMessage(err, fallback) })
      }
    })()
    return () => ctrl.abort()
  }, [cal.connected, calendarRequest])

  const calendarsLoading = cal.connected && calendarResult.key !== calendarRequest
  const calendars = calendarsLoading ? null : calendarResult.calendars
  const calendarsError = cal.connected && !calendarsLoading ? calendarResult.error : null

  const candidate = {
    enabled: draft.enabled,
    calendar_id: draft.calendar_id,
    duration_minutes: draft.duration_minutes,
    buffer_minutes: draft.buffer_minutes,
    booking_window_days: parseInteger(draft.booking_window_days) ?? NaN,
    min_notice_hours: parseInteger(draft.min_notice_hours) ?? NaN,
    daily_cap: draft.daily_cap.trim() === '' ? null : parseInteger(draft.daily_cap) ?? NaN,
  }
  const parsed = BookingSettingsSchema.safeParse(candidate)
  const errors: Partial<Record<'booking_window_days' | 'min_notice_hours' | 'daily_cap', string>> = {}
  if (!(candidate.booking_window_days >= 1 && candidate.booking_window_days <= 180)) errors.booking_window_days = 'Between 1 and 180 days.'
  if (!(candidate.min_notice_hours >= 0 && candidate.min_notice_hours <= 168)) errors.min_notice_hours = 'Between 0 and 168 hours.'
  if (candidate.daily_cap !== null && !(candidate.daily_cap >= 1 && candidate.daily_cap <= 200)) errors.daily_cap = 'Between 1 and 200, or leave empty for no limit.'
  const valid = parsed.success && Object.keys(errors).length === 0
  const visible = showErrors ? errors : {}
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved)

  const submit = async () => {
    if (!valid || !parsed.success) {
      setShowErrors(true)
      return
    }
    setSaving(true)
    const res = await save({ booking: parsed.data })
    setSaving(false)
    if (!res) return
    onSaved(res.booking)
    setDraft(bookingDraftFrom(res.booking))
    setShowErrors(false)
    toastSaved('Appointment settings', res.sync)
  }

  // Without a loaded list (not connected, loading, failed) only the saved choice is shown, and the select is disabled.
  const calendarOptions: CalendarOption[] = calendars && calendars.length > 0 ? calendars : [{ id: 'primary', name: 'Main calendar', primary: true, can_book: true }]
  const calendarLabel = (id: string) =>
    id === 'primary'
      ? (calendarOptions.find((c) => c.primary)?.name ?? 'Main calendar')
      : (calendarOptions.find((c) => c.id === id)?.name ?? (calendars ? id : 'Your saved calendar'))

  return (
    <FormSection title="Appointments" description={APPOINTMENTS_DESCRIPTION}>
      <CalendarConnection calendar={cal} />

      <SettingSwitch
        id="booking-enabled"
        label="Book appointments during calls"
        description="The agent offers two or three free times, reads the chosen one back and books it in your calendar with the caller's name and number."
        checked={draft.enabled}
        onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
      />

      <div className="grid items-start gap-5 sm:grid-cols-2 sm:gap-x-4">
        <Field
          label="Calendar"
          htmlFor="booking-calendar"
          hint={calendarsError || calendarsLoading ? undefined : 'Busy times are read from this calendar and bookings are added to it.'}
        >
          <Select
            value={draft.calendar_id}
            onValueChange={(v) => v !== null && setDraft((d) => ({ ...d, calendar_id: v }))}
            disabled={!cal.connected || calendarsLoading || !!calendarsError}
          >
            <SelectTrigger
              id="booking-calendar"
              className="w-full"
              aria-describedby={calendarsError ? 'booking-calendar-error' : calendarsLoading ? 'booking-calendar-loading' : 'booking-calendar-hint'}
            >
              <SelectValue>{(v: string) => calendarLabel(v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {calendarOptions.map((c) => (
                <SelectItem key={c.id} value={c.primary ? 'primary' : c.id} disabled={!c.can_book}>
                  {c.name}
                  {!c.can_book ? ' (read only)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {calendarsLoading && (
            <div id="booking-calendar-loading">
              <OrbLoader size={32} layout="row" label="Loading your calendars…" className="gap-2" />
            </div>
          )}
          {calendarsError && (
            <div id="booking-calendar-error" role="alert" className="flex flex-wrap items-center gap-2 text-xs leading-4 text-destructive">
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">{calendarsError}</span>
              <Button type="button" size="xs" variant="outline" className="tap-44" onClick={() => setCalendarRequest((n) => n + 1)}>
                <RotateCw aria-hidden="true" /> Retry
              </Button>
            </div>
          )}
        </Field>
        <Field label="Appointment length" htmlFor="booking-duration">
          <Select value={String(draft.duration_minutes)} onValueChange={(v) => v !== null && setDraft((d) => ({ ...d, duration_minutes: Number(v) }))}>
            <SelectTrigger id="booking-duration" className="w-full">
              <SelectValue>{(v: string) => `${v} minutes`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((m) => (
                <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Free time between appointments" htmlFor="booking-buffer">
          <Select value={String(draft.buffer_minutes)} onValueChange={(v) => v !== null && setDraft((d) => ({ ...d, buffer_minutes: Number(v) }))}>
            <SelectTrigger id="booking-buffer" className="w-full">
              <SelectValue>{(v: string) => (v === '0' ? 'None' : `${v} minutes`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BUFFERS.map((m) => (
                <SelectItem key={m} value={String(m)}>{m === 0 ? 'None' : `${m} minutes`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Book up to (days ahead)" htmlFor="booking-window" error={visible.booking_window_days}>
          <Input
            id="booking-window"
            inputMode="numeric"
            value={draft.booking_window_days}
            onChange={(e) => setDraft((d) => ({ ...d, booking_window_days: e.target.value }))}
            className="tabular-nums"
          />
        </Field>
        <Field
          label="Minimum notice (hours)"
          htmlFor="booking-notice"
          hint={visible.min_notice_hours ? undefined : 'How soon from now a caller can book.'}
          error={visible.min_notice_hours}
        >
          <Input
            id="booking-notice"
            inputMode="numeric"
            value={draft.min_notice_hours}
            onChange={(e) => setDraft((d) => ({ ...d, min_notice_hours: e.target.value }))}
            className="tabular-nums"
          />
        </Field>
        <Field label="Most appointments per day" optional htmlFor="booking-cap" error={visible.daily_cap}>
          <Input
            id="booking-cap"
            inputMode="numeric"
            placeholder="No limit"
            value={draft.daily_cap}
            onChange={(e) => setDraft((d) => ({ ...d, daily_cap: e.target.value }))}
            className="tabular-nums"
          />
        </Field>
      </div>

      <p className="flex items-start gap-2 text-xs leading-[18px] text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Bookable hours follow your opening hours (Availability tab). The agent never offers a time your calendar shows as busy and
          confirms a booking only once it is in your calendar. Bookings include the caller&apos;s name and phone number.
        </span>
      </p>

      <SaveBar
        dirty={isDirty}
        saving={saving}
        blocked={showErrors && !valid}
        onSave={() => void submit()}
        onDiscard={() => {
          setDraft(saved)
          setShowErrors(false)
        }}
      />
    </FormSection>
  )
}

/** Integration-style tile: Google Calendar connection state and the connect/reconnect action. */
function CalendarConnection({ calendar: cal }: { calendar: BusinessToolsState['calendar'] }) {
  const connected = cal.connected && !cal.needs_reconnect
  return (
    <div className="rounded-2xl bg-secondary p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white shadow-hair" aria-hidden="true">
          <Image src="/integrari/google_calendar.svg" alt="" width={22} height={22} className="object-contain" />
        </span>
        <p className="min-w-0 flex-1 text-[15px] leading-[22px] font-medium">Google Calendar</p>
        {connected ? (
          <StatusChip tone="success" dot>Connected</StatusChip>
        ) : cal.needs_reconnect ? (
          <StatusChip tone="warning" icon={<AlertTriangle aria-hidden="true" />}>Reconnect needed</StatusChip>
        ) : (
          <StatusChip tone="outline">Not connected</StatusChip>
        )}
      </div>
      {!connected && (
        <div className="mt-3 space-y-3 sm:pl-14">
          <p className="text-[13px] leading-[19px] text-muted-foreground">
            {!cal.configured
              ? 'Google sign-in is not set up on this platform yet, so booking is not available.'
              : cal.needs_reconnect
                ? 'Google refused access to your calendar. Reconnect it so the agent can book again; until then it takes a message instead.'
                : 'Connect Google Calendar so the agent can see your free times. Until then it takes a message with the caller’s preferred times.'}
          </p>
          {cal.configured && (
            <Button size="sm" variant="outline" className="tap-44" render={<a href={connectUrlWithReturn(cal.connect_url)} />} nativeButton={false}>
              <ExternalLink aria-hidden="true" />
              {cal.needs_reconnect ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Messages ────────────────────────────────────────────────────────────────

function MessagesCard({ state, onSaved }: { state: BusinessToolsState; onSaved: (m: MessageSettings) => void }) {
  const saved = state.messages
  const [draft, setDraft] = useState<MessageSettings>(saved)
  const [newRecipient, setNewRecipient] = useState('')
  const [recipientError, setRecipientError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const parsed = MessageSettingsSchema.safeParse(draft)
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const noRecipients = draft.email_notifications !== 'off' && !(draft.notify_owner && state.owner_email_verified) && draft.extra_recipients.length === 0

  const addRecipient = () => {
    const value = newRecipient.trim().toLowerCase()
    const check = MessageSettingsSchema.shape.extra_recipients.safeParse([...draft.extra_recipients, value])
    if (!check.success) {
      setRecipientError(check.error.issues[0]?.message ?? 'Enter a valid e-mail address')
      return
    }
    setDraft((d) => ({ ...d, extra_recipients: check.data }))
    setNewRecipient('')
    setRecipientError(null)
  }

  const submit = async () => {
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Check the message settings.')
      return
    }
    setSaving(true)
    const res = await save({ messages: parsed.data })
    setSaving(false)
    if (!res) return
    onSaved(res.messages)
    setDraft(res.messages)
    toastSaved('Message settings', res.sync)
  }

  return (
    <FormSection title="Messages" description={MESSAGES_DESCRIPTION}>
      <SettingSwitch
        id="messages-enabled"
        label="Take messages during calls"
        description="The agent saves the caller's name, callback number (read back to them) and reason. Messages appear on your dashboard under “Messages to follow up”."
        checked={draft.enabled}
        onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
      />

      <Field
        label="E-mail me"
        htmlFor="messages-alerts"
        hint="Urgent messages (something that cannot wait for a normal callback) are flagged [URGENT] in the subject."
      >
        <Select
          value={draft.email_notifications}
          onValueChange={(v) => v !== null && setDraft((d) => ({ ...d, email_notifications: v as MessageSettings['email_notifications'] }))}
        >
          <SelectTrigger id="messages-alerts" className="w-full sm:w-72" aria-describedby="messages-alerts-hint">
            <SelectValue>{(v: string) => (v === 'all' ? 'For every message' : v === 'urgent_only' ? 'Only for urgent messages' : 'Never (dashboard only)')}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">For every message</SelectItem>
            <SelectItem value="urgent_only">Only for urgent messages</SelectItem>
            <SelectItem value="off">Never (dashboard only)</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <SettingSwitch
        id="messages-owner"
        label={state.owner_email ? `Send alerts to ${state.owner_email}` : 'Send alerts to your account e-mail'}
        description={state.owner_email_verified ? 'Your verified account address.' : 'Verify your account e-mail address to receive alerts there.'}
        checked={draft.notify_owner}
        onCheckedChange={(v) => setDraft((d) => ({ ...d, notify_owner: v }))}
      />

      <Field
        label="Also send alerts to"
        htmlFor="messages-recipient"
        hint={recipientError ? undefined : `Up to ${MAX_EXTRA_MESSAGE_RECIPIENTS} addresses of people on your team. Alerts contain the caller's name, number and message.`}
        error={recipientError}
      >
        <div className="space-y-2">
          {draft.extra_recipients.length > 0 && (
            <ul className="overflow-hidden rounded-2xl bg-white shadow-hair" aria-label="Extra alert recipients">
              {draft.extra_recipients.map((address) => (
                <li key={address} className="flex items-center gap-3 border-b border-rule py-1.5 pr-1.5 pl-3.5 text-sm last:border-b-0">
                  <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{address}</span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="tap-44 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                    onClick={() => setDraft((d) => ({ ...d, extra_recipients: d.extra_recipients.filter((a) => a !== address) }))}
                    aria-label={`Remove ${address}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {draft.extra_recipients.length < MAX_EXTRA_MESSAGE_RECIPIENTS && (
            <div className="flex gap-2">
              <Input
                id="messages-recipient"
                type="email"
                autoComplete="email"
                placeholder="colleague@example.com"
                value={newRecipient}
                onChange={(e) => {
                  setNewRecipient(e.target.value)
                  setRecipientError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addRecipient()
                  }
                }}
                aria-invalid={recipientError ? true : undefined}
                aria-describedby={recipientError ? 'messages-recipient-error' : 'messages-recipient-hint'}
              />
              <Button variant="outline" onClick={addRecipient} disabled={!newRecipient.trim()} className="h-10">
                <Plus aria-hidden="true" />
                Add
              </Button>
            </div>
          )}
        </div>
      </Field>

      {draft.enabled && noRecipients && (
        <p className="flex items-start gap-2 text-xs leading-[18px] text-warning" role="note">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          No one will receive alert e-mails: add an address or turn on alerts to your account e-mail.
        </p>
      )}

      <SaveBar dirty={isDirty} saving={saving} onSave={() => void submit()} onDiscard={() => setDraft(saved)} />
    </FormSection>
  )
}

/** Exposed for tests and stories: the defaults the cards start from. */
export const BUSINESS_TOOL_DEFAULTS = { booking: DEFAULT_BOOKING_SETTINGS, messages: DEFAULT_MESSAGE_SETTINGS }
