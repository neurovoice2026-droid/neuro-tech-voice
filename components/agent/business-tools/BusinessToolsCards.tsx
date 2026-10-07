'use client'

// Call handling → Appointments and Messages (slice B2): the in-call booking
// tools (Google Calendar) and the take-message tool with its e-mail alert.
// Saved through PUT /api/agent/business-tools (validated server-side; the
// columns are platform-managed), which also pushes the agent config.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarCheck, ExternalLink, Info, Loader2, Mail, Plus, RotateCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FieldError, SaveBar, SettingSwitch, parseInteger } from '@/components/agent/tabs/TabConversation'
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

  if (!state) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appointments and messages</CardTitle>
          <CardDescription>{loadError ? 'These settings could not be loaded.' : 'Loading…'}</CardDescription>
        </CardHeader>
        {loadError && (
          <CardContent>
            <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              {loadError}
              <Button variant="outline" size="sm" onClick={() => void retry()} disabled={retrying} className="gap-1.5">
                {retrying ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCw aria-hidden="true" />}
                Retry
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Appointments</CardTitle>
        <CardDescription>Let the agent check your Google Calendar and book appointments during calls.</CardDescription>
        <CardAction>
          {cal.connected && !cal.needs_reconnect ? (
            <Badge variant="secondary" className="gap-1 text-xs">
              <CalendarCheck className="size-3" aria-hidden="true" />
              Google Calendar connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">{cal.needs_reconnect ? 'Reconnect needed' : 'Calendar not connected'}</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-5">
        <SettingSwitch
          id="booking-enabled"
          label="Book appointments during calls"
          description="The agent offers two or three free times, reads the chosen one back and books it in your calendar with the caller's name and number."
          checked={draft.enabled}
          onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
        />

        {(!cal.connected || cal.needs_reconnect) && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              {!cal.configured
                ? 'Google sign-in is not set up on this platform yet, so booking is not available.'
                : cal.needs_reconnect
                  ? 'Google refused access to your calendar. Reconnect it so the agent can book again; until then it takes a message instead.'
                  : 'Connect Google Calendar so the agent can see your free times. Until then it takes a message with the caller’s preferred times.'}
            </p>
            {cal.configured && (
              <Button size="sm" variant="outline" render={<a href={connectUrlWithReturn(cal.connect_url)} />} nativeButton={false}>
                <ExternalLink aria-hidden="true" />
                {cal.needs_reconnect ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
              </Button>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="booking-calendar">Calendar</Label>
            <Select
              value={draft.calendar_id}
              onValueChange={(v) => v !== null && setDraft((d) => ({ ...d, calendar_id: v }))}
              disabled={!cal.connected || calendarsLoading || !!calendarsError}
            >
              <SelectTrigger
                id="booking-calendar"
                className="w-full"
                aria-describedby={calendarsError ? 'booking-calendar-error' : 'booking-calendar-hint'}
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
            {calendarsError ? (
              <div id="booking-calendar-error" role="alert" className="flex flex-wrap items-center gap-2 text-xs text-destructive">
                <span>{calendarsError}</span>
                <Button type="button" size="xs" variant="outline" onClick={() => setCalendarRequest((n) => n + 1)} className="gap-1">
                  <RotateCw aria-hidden="true" /> Retry
                </Button>
              </div>
            ) : (
              <p id="booking-calendar-hint" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {calendarsLoading && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
                {calendarsLoading ? 'Loading your calendars…' : 'Busy times are read from this calendar and bookings are added to it.'}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="booking-duration">Appointment length</Label>
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="booking-buffer">Free time between appointments</Label>
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="booking-window">Book up to (days ahead)</Label>
            <Input
              id="booking-window"
              inputMode="numeric"
              value={draft.booking_window_days}
              onChange={(e) => setDraft((d) => ({ ...d, booking_window_days: e.target.value }))}
              aria-invalid={visible.booking_window_days ? true : undefined}
              aria-describedby={visible.booking_window_days ? 'booking-window-error' : undefined}
            />
            {visible.booking_window_days && <FieldError id="booking-window-error">{visible.booking_window_days}</FieldError>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="booking-notice">Minimum notice (hours)</Label>
            <Input
              id="booking-notice"
              inputMode="numeric"
              value={draft.min_notice_hours}
              onChange={(e) => setDraft((d) => ({ ...d, min_notice_hours: e.target.value }))}
              aria-invalid={visible.min_notice_hours ? true : undefined}
              aria-describedby={visible.min_notice_hours ? 'booking-notice-error' : 'booking-notice-hint'}
            />
            {visible.min_notice_hours ? (
              <FieldError id="booking-notice-error">{visible.min_notice_hours}</FieldError>
            ) : (
              <p id="booking-notice-hint" className="text-xs text-muted-foreground">How soon from now a caller can book.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="booking-cap">Most appointments per day (optional)</Label>
            <Input
              id="booking-cap"
              inputMode="numeric"
              placeholder="No limit"
              value={draft.daily_cap}
              onChange={(e) => setDraft((d) => ({ ...d, daily_cap: e.target.value }))}
              aria-invalid={visible.daily_cap ? true : undefined}
              aria-describedby={visible.daily_cap ? 'booking-cap-error' : undefined}
            />
            {visible.daily_cap && <FieldError id="booking-cap-error">{visible.daily_cap}</FieldError>}
          </div>
        </div>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
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
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Messages</CardTitle>
        <CardDescription>Let the agent take a message during the call and alert you right away.</CardDescription>
        {saving && (
          <CardAction>
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Saving" />
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <SettingSwitch
          id="messages-enabled"
          label="Take messages during calls"
          description="The agent saves the caller's name, callback number (read back to them) and reason. Messages appear on your dashboard under “Messages to follow up”."
          checked={draft.enabled}
          onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
        />

        <div className="space-y-1.5">
          <Label htmlFor="messages-alerts">E-mail me</Label>
          <Select
            value={draft.email_notifications}
            onValueChange={(v) => v !== null && setDraft((d) => ({ ...d, email_notifications: v as MessageSettings['email_notifications'] }))}
          >
            <SelectTrigger id="messages-alerts" className="w-full sm:w-72">
              <SelectValue>{(v: string) => (v === 'all' ? 'For every message' : v === 'urgent_only' ? 'Only for urgent messages' : 'Never (dashboard only)')}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">For every message</SelectItem>
              <SelectItem value="urgent_only">Only for urgent messages</SelectItem>
              <SelectItem value="off">Never (dashboard only)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Urgent messages (something that cannot wait for a normal callback) are flagged [URGENT] in the subject.</p>
        </div>

        <SettingSwitch
          id="messages-owner"
          label={state.owner_email ? `Send alerts to ${state.owner_email}` : 'Send alerts to your account e-mail'}
          description={state.owner_email_verified ? 'Your verified account address.' : 'Verify your account e-mail address to receive alerts there.'}
          checked={draft.notify_owner}
          onCheckedChange={(v) => setDraft((d) => ({ ...d, notify_owner: v }))}
        />

        <div className="space-y-2">
          <Label htmlFor="messages-recipient">Also send alerts to</Label>
          {draft.extra_recipients.length > 0 && (
            <ul className="space-y-1.5" aria-label="Extra alert recipients">
              {draft.extra_recipients.map((address) => (
                <li key={address} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                  <Mail className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{address}</span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
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
              <Button variant="outline" onClick={addRecipient} disabled={!newRecipient.trim()}>
                <Plus aria-hidden="true" />
                Add
              </Button>
            </div>
          )}
          {recipientError ? (
            <FieldError id="messages-recipient-error">{recipientError}</FieldError>
          ) : (
            <p id="messages-recipient-hint" className="text-xs text-muted-foreground">
              Up to {MAX_EXTRA_MESSAGE_RECIPIENTS} addresses of people on your team. Alerts contain the caller&apos;s name, number and message.
            </p>
          )}
        </div>

        {draft.enabled && noRecipients && (
          <p className="text-xs text-amber-700" role="note">No one will receive alert e-mails: add an address or turn on alerts to your account e-mail.</p>
        )}

        <SaveBar dirty={isDirty} saving={saving} onSave={() => void submit()} onDiscard={() => setDraft(saved)} />
      </CardContent>
    </Card>
  )
}

/** Exposed for tests and stories: the defaults the cards start from. */
export const BUSINESS_TOOL_DEFAULTS = { booking: DEFAULT_BOOKING_SETTINGS, messages: DEFAULT_MESSAGE_SETTINGS }
