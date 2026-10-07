// The dashboard's view of a message taken during a call (call_messages) and
// of a booking made during a call. Pure, client-safe types.

export const MESSAGE_COLUMNS =
  'id, call_id, caller_name, callback_number, reason, urgency, status, done_at, notified_at, notify_error, retention_applied_at, created_at'

export interface CallMessageView {
  id: string
  call_id: string | null
  caller_name: string | null
  callback_number: string | null
  reason: string
  urgency: 'normal' | 'urgent'
  status: 'open' | 'done'
  done_at: string | null
  /** The alert e-mail went out. */
  notified_at: string | null
  /** Why no alert went out: email_not_configured, no_recipients, daily_cap, send_failed. */
  notify_error: string | null
  /** Caller details removed by the privacy retention. */
  purged: boolean
  created_at: string
}

export function toMessageView(row: Record<string, unknown>): CallMessageView {
  return {
    id: String(row.id),
    call_id: (row.call_id as string | null) ?? null,
    caller_name: (row.caller_name as string | null) ?? null,
    callback_number: (row.callback_number as string | null) ?? null,
    reason: String(row.reason ?? ''),
    urgency: row.urgency === 'urgent' ? 'urgent' : 'normal',
    status: row.status === 'done' ? 'done' : 'open',
    done_at: (row.done_at as string | null) ?? null,
    notified_at: (row.notified_at as string | null) ?? null,
    notify_error: (row.notify_error as string | null) ?? null,
    purged: !!row.retention_applied_at,
    created_at: String(row.created_at ?? ''),
  }
}

export const BOOKING_VIEW_COLUMNS = 'id, call_id, caller_name, caller_phone, starts_at, ends_at, timezone, status, created_at'

export interface CallBookingView {
  id: string
  caller_name: string | null
  caller_phone: string | null
  starts_at: string
  ends_at: string
  timezone: string
  status: 'pending' | 'booked' | 'cancelled'
}

export function toBookingView(row: Record<string, unknown>): CallBookingView {
  const status = row.status === 'booked' || row.status === 'cancelled' ? row.status : 'pending'
  return {
    id: String(row.id),
    caller_name: (row.caller_name as string | null) ?? null,
    caller_phone: (row.caller_phone as string | null) ?? null,
    starts_at: String(row.starts_at ?? ''),
    ends_at: String(row.ends_at ?? ''),
    timezone: String(row.timezone ?? 'UTC'),
    status,
  }
}
