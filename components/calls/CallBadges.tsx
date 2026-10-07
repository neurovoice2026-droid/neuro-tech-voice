'use client'

import {
  Bot, LifeBuoy, Moon, PhoneForwarded, PhoneOff, CirclePause, PhoneMissed,
  PhoneCall, CircleQuestionMark, CircleCheck, CircleX, CircleHelp, FlaskConical, type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { callResultLabel, handledBy, statusLabel, type HandledByInput, type HandledByKind } from '@/lib/calls/labels'

// Shared call badges: the calls table, the call detail sheet and the
// dashboard's recent calls all use these, so a call reads the same everywhere.

const HANDLED_BY_STYLE: Record<HandledByKind, { className: string; icon: LucideIcon }> = {
  ai:            { className: 'border-purple-200 bg-purple-50 text-purple-700', icon: Bot },
  fallback:      { className: 'border-amber-300 bg-amber-50 text-amber-800', icon: LifeBuoy },
  after_hours:   { className: 'border-slate-200 bg-slate-100 text-slate-700', icon: Moon },
  transferred:   { className: 'border-sky-200 bg-sky-50 text-sky-700', icon: PhoneForwarded },
  failed:        { className: 'border-red-200 bg-red-50 text-red-700', icon: PhoneOff },
  paused:        { className: 'border-gray-200 bg-gray-100 text-gray-600', icon: CirclePause },
  not_connected: { className: 'border-gray-200 bg-gray-50 text-gray-600', icon: PhoneMissed },
  connecting:    { className: 'border-blue-200 bg-blue-50 text-blue-700', icon: PhoneCall },
  unknown:       { className: 'border-gray-200 bg-white text-gray-500', icon: CircleQuestionMark },
}

export function HandledByBadge({ call, className }: { call: HandledByInput; className?: string }) {
  const info = handledBy(call)
  const style = HANDLED_BY_STYLE[info.kind]
  const Icon = style.icon
  return (
    <Badge
      variant="outline"
      title={info.description}
      className={cn('gap-1 text-xs font-medium', style.className, className)}
    >
      <Icon aria-hidden="true" />
      {info.label}
    </Badge>
  )
}

export const STATUS_BADGE_STYLE: Record<string, string> = {
  completed:     'border-green-200 bg-green-50 text-green-700',
  failed:        'border-red-200 bg-red-50 text-red-700',
  busy:          'border-amber-200 bg-amber-50 text-amber-700',
  'no-answer':   'border-gray-200 bg-gray-100 text-gray-600',
  'in-progress': 'border-blue-200 bg-blue-50 text-blue-700',
  ringing:       'border-blue-200 bg-blue-50 text-blue-700',
  canceled:      'border-gray-200 bg-gray-100 text-gray-600',
  'after-hours': 'border-slate-200 bg-slate-100 text-slate-700',
  transferred:   'border-sky-200 bg-sky-50 text-sky-700',
}

export function CallStatusBadge({ status, className }: { status: string; className?: string }) {
  const live = status === 'in-progress' || status === 'ringing'
  return (
    <Badge variant="outline" className={cn('text-xs', STATUS_BADGE_STYLE[status], className)}>
      {live && (
        <span aria-hidden="true" className="mr-0.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
      )}
      {statusLabel(status)}
    </Badge>
  )
}

const SENTIMENT_META: Record<string, { emoji: string; label: string }> = {
  positive: { emoji: '😊', label: 'Positive' },
  neutral:  { emoji: '😐', label: 'Neutral' },
  negative: { emoji: '😞', label: 'Negative' },
}

const AI_OUTCOME_META: Record<string, { icon: LucideIcon; className: string }> = {
  success: { icon: CircleCheck, className: 'text-green-600' },
  failure: { icon: CircleX, className: 'text-red-600' },
  unknown: { icon: CircleHelp, className: 'text-gray-400' },
}

/**
 * "AI outcome": the AI's verdict on whether the call reached its goal
 * (call_successful). Icon plus an accessible label, never colour alone.
 */
export function AiOutcomeIcon({ value }: { value: string | null | undefined }) {
  const meta = value ? AI_OUTCOME_META[value] : undefined
  const label = callResultLabel(value)
  if (!meta || !label) return <span className="text-xs text-muted-foreground" aria-label="No AI outcome">—</span>
  const Icon = meta.icon
  return (
    <span role="img" aria-label={`AI outcome: ${label}`} title={`AI outcome: ${label}`} className="inline-flex">
      <Icon className={cn('h-4 w-4', meta.className)} aria-hidden="true" />
    </span>
  )
}

/** Marks a conversation that did not come from a phone call (web, SDK or dashboard test): never billed. */
export function TestCallBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      title="Test conversation (web or dashboard): not a phone call, not billed, no automations"
      className={cn('gap-1 border-slate-200 bg-slate-50 text-xs text-slate-600', className)}
    >
      <FlaskConical aria-hidden="true" />
      Test
    </Badge>
  )
}

export function SentimentIcon({ sentiment }: { sentiment: string | null | undefined }) {
  const meta = sentiment ? SENTIMENT_META[sentiment] : undefined
  if (!meta) return <span className="text-xs text-muted-foreground" aria-label="No sentiment">—</span>
  return (
    <span role="img" aria-label={`${meta.label} sentiment`} title={meta.label} className="text-base">
      {meta.emoji}
    </span>
  )
}
