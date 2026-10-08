'use client'

import {
  Bot, LifeBuoy, Moon, PhoneForwarded, PhoneOff, CirclePause, PhoneMissed,
  PhoneCall, CircleQuestionMark, CircleCheck, CircleX, CircleHelp, FlaskConical, type LucideIcon,
} from 'lucide-react'
import { StatusChip, type StatusTone } from '@/components/shared/StatusChip'
import { cn } from '@/lib/utils'
import { callResultLabel, handledBy, statusLabel, type HandledByInput, type HandledByKind } from '@/lib/calls/labels'

// Shared call badges: the calls table, the call detail sheet and the
// dashboard's recent calls all use these, so a call reads the same everywhere.
// Every chip is tone + icon/dot + text (status is never colour alone).

const HANDLED_BY_STYLE: Record<HandledByKind, { tone: StatusTone; icon: LucideIcon }> = {
  // AI provenance is the one brand-tinted chip (spec §3.5, allowed accent #5).
  ai:            { tone: 'brand', icon: Bot },
  fallback:      { tone: 'warning', icon: LifeBuoy },
  after_hours:   { tone: 'muted', icon: Moon },
  transferred:   { tone: 'info', icon: PhoneForwarded },
  failed:        { tone: 'danger', icon: PhoneOff },
  paused:        { tone: 'muted', icon: CirclePause },
  not_connected: { tone: 'muted', icon: PhoneMissed },
  connecting:    { tone: 'info', icon: PhoneCall },
  unknown:       { tone: 'outline', icon: CircleQuestionMark },
}

export function HandledByBadge({
  call,
  accent = false,
  className,
}: {
  call: HandledByInput
  /**
   * Opt in to the brand-tinted "AI" chip (spec §3.5 #5). Off by default, so lists
   * (calls table, dashboard recent calls) never turn into a column of accent chips
   * and the exceptions (backup, transferred, failed) stand out. Only the single
   * chip in the call sheet header passes it.
   */
  accent?: boolean
  /** @deprecated The AI chip is neutral by default now; kept so existing callers compile. */
  quiet?: boolean
  className?: string
}) {
  const info = handledBy(call)
  const style = HANDLED_BY_STYLE[info.kind]
  const Icon = style.icon
  const tone = style.tone === 'brand' && !accent ? 'neutral' : style.tone
  return (
    <StatusChip tone={tone} title={info.description} icon={<Icon aria-hidden="true" />} className={className}>
      {info.label}
    </StatusChip>
  )
}

/** Status → chip tone. Live statuses (ringing, in progress) also get the pinging dot. */
export const STATUS_TONE: Record<string, StatusTone> = {
  completed:     'success',
  failed:        'danger',
  busy:          'warning',
  'no-answer':   'muted',
  'in-progress': 'info',
  ringing:       'info',
  canceled:      'muted',
  'after-hours': 'muted',
  transferred:   'info',
}

/**
 * Semantic-token classes per status, kept for callers that style their own
 * element. Prefer `CallStatusBadge` (or `STATUS_TONE` with `StatusChip`).
 */
export const STATUS_BADGE_STYLE: Record<string, string> = {
  completed:     'bg-success-soft text-success',
  failed:        'bg-destructive-soft text-destructive',
  busy:          'bg-warning-soft text-warning',
  'no-answer':   'bg-secondary text-muted-foreground',
  'in-progress': 'bg-info-soft text-info',
  ringing:       'bg-info-soft text-info',
  canceled:      'bg-secondary text-muted-foreground',
  'after-hours': 'bg-secondary text-muted-foreground',
  transferred:   'bg-info-soft text-info',
}

export function CallStatusBadge({ status, className }: { status: string; className?: string }) {
  const live = status === 'in-progress' || status === 'ringing'
  return (
    <StatusChip tone={STATUS_TONE[status] ?? 'outline'} live={live} dot={!live} className={className}>
      {statusLabel(status)}
    </StatusChip>
  )
}

const SENTIMENT_META: Record<string, { emoji: string; label: string }> = {
  positive: { emoji: '😊', label: 'Positive' },
  neutral:  { emoji: '😐', label: 'Neutral' },
  negative: { emoji: '😞', label: 'Negative' },
}

const AI_OUTCOME_META: Record<string, { icon: LucideIcon; className: string }> = {
  success: { icon: CircleCheck, className: 'text-success-dot' },
  failure: { icon: CircleX, className: 'text-destructive' },
  unknown: { icon: CircleHelp, className: 'text-muted-foreground' },
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
      <Icon className={cn('size-4', meta.className)} aria-hidden="true" />
    </span>
  )
}

/** Marks a conversation that did not come from a phone call (web, SDK or dashboard test): never billed. */
export function TestCallBadge({ className }: { className?: string }) {
  return (
    <StatusChip
      tone="outline"
      title="Test conversation (web or dashboard): not a phone call, not billed, no automations"
      icon={<FlaskConical aria-hidden="true" />}
      className={className}
    >
      Test
    </StatusChip>
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
