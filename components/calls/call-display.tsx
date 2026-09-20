'use client'

import { Tooltip } from '@base-ui/react/tooltip'
import { FlaskConical, LifeBuoy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CallOutcome, CallStatus, Sentiment } from '@/types'

// Small presentational pieces shared by the calls list, the call sheet and the
// dashboard, so an outcome or a sentiment looks the same everywhere.

export const OUTCOME_META: Record<CallOutcome, { label: string; className: string; dot: string }> = {
  booked: { label: 'Booked', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  rescheduled: { label: 'Rescheduled', className: 'border-teal-200 bg-teal-50 text-teal-700', dot: 'bg-teal-500' },
  cancelled: { label: 'Cancelled', className: 'border-slate-200 bg-slate-50 text-slate-700', dot: 'bg-slate-400' },
  answered: { label: 'Answered', className: 'border-blue-200 bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  message_taken: { label: 'Message taken', className: 'border-indigo-200 bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
  transferred: { label: 'Transferred', className: 'border-violet-200 bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  flagged: { label: 'Flagged', className: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  missed: { label: 'Missed', className: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  spam: { label: 'Spam', className: 'border-gray-200 bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  other: { label: 'Other', className: 'border-gray-200 bg-gray-50 text-gray-700', dot: 'bg-gray-400' },
}

export const OUTCOME_OPTIONS: { value: CallOutcome; label: string }[] = (
  Object.keys(OUTCOME_META) as CallOutcome[]
).map((value) => ({ value, label: OUTCOME_META[value].label }))

export const TOOL_LABELS: Record<string, string> = {
  get_call_context: 'Checked the call details',
  search_knowledge: 'Looked it up in your documents',
  check_availability: 'Checked your availability',
  book_appointment: 'Booked an appointment',
  find_booking: 'Looked up an existing booking',
  reschedule_appointment: 'Rescheduled an appointment',
  cancel_appointment: 'Cancelled an appointment',
  add_to_waitlist: 'Added the caller to the waitlist',
  send_sms: 'Sent the caller a text message',
  take_message: 'Took a message',
  notify_team: 'Notified your team',
  transfer_call: 'Transferred the call',
  save_lead_details: 'Saved the caller’s details',
  end_call: 'Ended the call',
}

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? formatIntent(name) ?? name
}

export const END_REASON_LABELS: Record<string, string> = {
  caller_hangup: 'The caller hung up',
  agent_hangup: 'The agent ended the call',
  transferred: 'Transferred to your team',
  silence_timeout: 'Ended after a long silence',
  max_duration: 'Reached the maximum call length',
  voicemail: 'Reached voicemail',
  error: 'Ended by a technical problem',
  test_ended: 'Test call ended',
  busy: 'The line was busy',
  no_answer: 'Nobody answered',
  failed: 'The call couldn’t connect',
  trial_expired: 'Not answered: the trial has ended',
  minutes_exhausted: 'Not answered: no minutes left',
  agent_inactive: 'Not answered: the agent is paused',
  number_inactive: 'Not answered: the number is paused',
  org_not_onboarded: 'Not answered: setup isn’t finished',
}

export function endReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null
  return END_REASON_LABELS[reason] ?? formatIntent(reason)
}

export const STATUS_META: Record<CallStatus, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'border-green-200 bg-green-50 text-green-700' },
  failed: { label: 'Failed', className: 'border-red-200 bg-red-50 text-red-700' },
  busy: { label: 'Busy', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  'no-answer': { label: 'No answer', className: 'border-gray-200 bg-gray-100 text-gray-600' },
  'in-progress': { label: 'In progress', className: 'border-blue-200 bg-blue-50 text-blue-700' },
}

export const SENTIMENT_META: Record<Sentiment, { label: string; dot: string; text: string }> = {
  positive: { label: 'Positive', dot: 'bg-green-500', text: 'text-green-700' },
  neutral: { label: 'Neutral', dot: 'bg-gray-400', text: 'text-gray-600' },
  negative: { label: 'Negative', dot: 'bg-red-500', text: 'text-red-700' },
}

/** "pricing_question" → "Pricing question". */
export function formatIntent(intent: string | null | undefined): string | null {
  if (!intent) return null
  const text = intent.replace(/[_-]+/g, ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : null
}

export function OutcomeChip({ outcome, className }: { outcome: CallOutcome | null | undefined; className?: string }) {
  if (!outcome || !OUTCOME_META[outcome]) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)} title="The call hasn’t been analysed yet">
        Pending
      </span>
    )
  }
  const meta = OUTCOME_META[outcome]
  return (
    <Badge variant="outline" className={cn('gap-1.5 text-xs', meta.className, className)}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  )
}

export function StatusBadge({ status, className }: { status: CallStatus; className?: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: '' }
  return (
    <Badge variant="outline" className={cn('text-xs', meta.className, className)}>
      {status === 'in-progress' && (
        <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-blue-500" />
      )}
      {meta.label}
    </Badge>
  )
}

export function SentimentDot({
  sentiment,
  showLabel = false,
  className,
}: {
  sentiment: Sentiment | null | undefined
  showLabel?: boolean
  className?: string
}) {
  if (!sentiment || !SENTIMENT_META[sentiment]) {
    return <span className={cn('text-xs text-muted-foreground', className)}>—</span>
  }
  const meta = SENTIMENT_META[sentiment]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', meta.text, className)} title={`${meta.label} sentiment`}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', meta.dot)} />
      {showLabel ? meta.label : <span className="sr-only">{meta.label} sentiment</span>}
    </span>
  )
}

export function TestBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn('gap-1 border-dashed text-[11px] text-muted-foreground', className)}>
      <FlaskConical aria-hidden="true" />
      Test
    </Badge>
  )
}

/**
 * Marks calls that were answered by the backup voice provider. The tooltip is
 * reachable by keyboard (the trigger is a focusable span, not a nested button).
 */
export function FallbackBadge({ className }: { className?: string }) {
  return (
    <Tooltip.Provider delay={200}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={<span tabIndex={0} />}
          className={cn(
            'inline-flex h-5 shrink-0 items-center gap-1 rounded-4xl border border-sky-200 bg-sky-50 px-2 text-[11px] font-medium whitespace-nowrap text-sky-700 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            className
          )}
          aria-label="Fallback voice: answered by our backup voice system"
          onClick={(e) => e.stopPropagation()}
        >
          <LifeBuoy aria-hidden="true" className="size-3" />
          Fallback voice
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6} className="z-50">
            <Tooltip.Popup className="max-w-60 rounded-md bg-foreground px-2.5 py-1.5 text-xs leading-snug text-background shadow-md">
              Our main voice system was busy or unavailable, so the backup voice answered this call. Your caller was still helped.
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

export function TagChips({ tags, max = 3, className }: { tags: string[] | null | undefined; max?: number; className?: string }) {
  const list = (tags ?? []).filter(Boolean)
  if (list.length === 0) return null
  const shown = list.slice(0, max)
  const rest = list.length - shown.length
  return (
    <span className={cn('flex flex-wrap items-center gap-1', className)}>
      {shown.map((tag) => (
        <span
          key={tag}
          className="inline-flex max-w-32 items-center truncate rounded-md bg-purple-50 px-1.5 py-0.5 text-[11px] font-medium text-purple-700"
          title={tag}
        >
          #{tag}
        </span>
      ))}
      {rest > 0 && <span className="text-[11px] text-muted-foreground">+{rest}</span>}
    </span>
  )
}

export function callerLabel(call: { caller_number: string | null; direction: string; from_number?: string | null; to_number?: string | null }): string | null {
  return call.caller_number ?? (call.direction === 'outbound' ? call.to_number ?? null : call.from_number ?? null)
}
