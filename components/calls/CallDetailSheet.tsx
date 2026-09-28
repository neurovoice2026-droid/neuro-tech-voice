'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  AlertTriangle, BookOpen, Bot, CalendarCheck, CheckCheck, CheckCircle2, ChevronDown, Copy, Download,
  FileText, Loader2, Mail, MessageSquare, PhoneIncoming, PhoneOff, PhoneOutgoing, RefreshCw, Scissors,
  Search, Table2, Trash2, User, Wrench, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/EmptyState'
import { UpgradeNotice } from '@/components/shared/UpgradeNotice'
import { cn, formatDate, formatDuration, formatPhoneNumber } from '@/lib/utils'
import { useCallDetail, type CallDetail } from '@/hooks/useCallDetail'
import { DeleteCallDialog } from './DeleteCallDialog'
import {
  callerLabel, endReasonLabel, FallbackBadge, formatIntent, OutcomeChip, SENTIMENT_META, StatusBadge,
  TagChips, TestBadge, toolLabel,
} from './call-display'
import type { TranscriptEntry } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function humanKey(key: string): string {
  const text = key.replace(/[_-]+/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function transcriptAsText(call: CallDetail): string {
  const who = (t: TranscriptEntry) => (t.role === 'agent' ? call.agent_name || 'Agent' : 'Caller')
  return (call.transcript ?? []).map((t) => `[${clock(t.time_in_call_secs)}] ${who(t)}: ${t.message}`).join('\n')
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>
}

// ─── Recording ────────────────────────────────────────────────────────────────

function RecordingSection({ call }: { call: CallDetail }) {
  const [failed, setFailed] = useState(false)

  if (call.recording_url) {
    return (
      <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
        {failed ? (
          <p className="text-sm text-muted-foreground">The recording couldn’t be loaded right now. Please try again in a moment.</p>
        ) : (
          // Native controls: keyboard, screen reader and seeking support for free.
          <audio
            controls
            preload="none"
            src={call.recording_url}
            onError={() => setFailed(true)}
            className="w-full"
            aria-label="Call recording"
          />
        )}
        <a
          href={call.recording_url}
          download
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <Download aria-hidden="true" className="size-3.5" /> Download recording
        </a>
      </div>
    )
  }
  if (call.recording_available && !call.recordings_entitled) {
    return (
      <UpgradeNotice
        compact
        feature="Call recordings"
        requiredPlan={call.recordings_required_plan}
      />
    )
  }
  return <p className="text-sm text-muted-foreground">This call wasn’t recorded.</p>
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function Overview({ call }: { call: CallDetail }) {
  const analysis = call.analysis
  const sentiment = call.sentiment ? SENTIMENT_META[call.sentiment] : null
  const labels = new Map(call.lead_fields.map((f) => [f.key, f.label]))
  const extracted = Object.entries(call.extracted ?? {}).filter(([, v]) => typeof v === 'string' && v.trim())
  const documents = Array.from(new Map((call.knowledge_sources ?? []).map((s) => [s.document_id, s.document_name])).values())
  const intent = formatIntent(call.intent)
  const inProgress = call.status === 'in-progress'
  const hasTranscript = (call.transcript ?? []).length > 0

  return (
    <div className="space-y-5">
      {inProgress && (
        <p className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <Loader2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 animate-spin" />
          This call is still going. The summary and outcome appear a moment after it ends.
        </p>
      )}

      <section>
        <SectionTitle>Summary</SectionTitle>
        {call.summary ? (
          <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
            <p className="text-sm leading-relaxed">{call.summary}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {inProgress
              ? 'Not ready yet.'
              : hasTranscript
                ? 'The summary is being prepared. Check back in a minute.'
                : 'There was no conversation to summarise.'}
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border p-3">
          <p className="mb-1.5 text-xs text-muted-foreground">Outcome</p>
          <OutcomeChip outcome={call.outcome} />
          {intent && <p className="mt-2 text-sm"><span className="text-muted-foreground">Reason: </span>{intent}</p>}
        </div>
        <div className="rounded-xl border p-3">
          <p className="mb-1.5 text-xs text-muted-foreground">Caller sentiment</p>
          {sentiment ? (
            <p className={cn('flex items-center gap-2 text-sm font-medium', sentiment.text)}>
              <span aria-hidden="true" className={cn('size-2.5 rounded-full', sentiment.dot)} />
              {sentiment.label}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Not analysed yet</p>
          )}
          {analysis?.sentiment_reason && <p className="mt-1.5 text-sm text-muted-foreground">{analysis.sentiment_reason}</p>}
        </div>
      </section>

      {(analysis?.flag_reason || analysis?.follow_up_required) && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle aria-hidden="true" className="size-4" />
            {analysis.flag_reason ? 'Needs your attention' : 'Follow-up suggested'}
          </p>
          <p className="mt-1">{analysis.flag_reason ?? analysis.follow_up_reason ?? 'Someone should get back to this caller.'}</p>
        </section>
      )}

      {(extracted.length > 0 || analysis?.caller_name) && (
        <section>
          <SectionTitle>Details collected</SectionTitle>
          <dl className="divide-y rounded-xl border">
            {analysis?.caller_name && !extracted.some(([k]) => k === 'name') && (
              <div className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-3">
                <dt className="text-xs text-muted-foreground sm:w-36 sm:shrink-0 sm:text-sm">Name</dt>
                <dd className="text-sm break-words">{analysis.caller_name}</dd>
              </div>
            )}
            {extracted.map(([key, value]) => (
              <div key={key} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-3">
                <dt className="text-xs text-muted-foreground sm:w-36 sm:shrink-0 sm:text-sm">{labels.get(key) ?? humanKey(key)}</dt>
                <dd className="text-sm break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {(call.tags ?? []).length > 0 && (
        <section>
          <SectionTitle>Tags</SectionTitle>
          <TagChips tags={call.tags} max={20} />
        </section>
      )}

      <section>
        <SectionTitle>Recording</SectionTitle>
        <RecordingSection call={call} />
      </section>

      {documents.length > 0 && (
        <section>
          <SectionTitle>Answered from your documents</SectionTitle>
          <ul className="flex flex-wrap gap-1.5">
            {documents.map((name) => (
              <li key={name} className="inline-flex max-w-full items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs">
                <BookOpen aria-hidden="true" className="size-3.5 shrink-0 text-purple-600" />
                <span className="truncate">{name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border bg-muted/30 p-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="mb-0.5 text-xs text-muted-foreground">Direction</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              {call.direction === 'outbound' ? (
                <><PhoneOutgoing aria-hidden="true" className="size-4 text-purple-500" /> Outbound</>
              ) : (
                <><PhoneIncoming aria-hidden="true" className="size-4 text-blue-500" /> Inbound</>
              )}
            </dd>
          </div>
          <div>
            <dt className="mb-0.5 text-xs text-muted-foreground">Duration</dt>
            <dd className="font-medium">{call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : '—'}</dd>
          </div>
          <div>
            <dt className="mb-0.5 text-xs text-muted-foreground">Started</dt>
            <dd className="text-xs font-medium">{call.started_at ? formatDate(call.started_at) : '—'}</dd>
          </div>
          <div>
            <dt className="mb-0.5 text-xs text-muted-foreground">Ended</dt>
            <dd className="text-xs font-medium">{call.ended_at ? formatDate(call.ended_at) : '—'}</dd>
          </div>
          {call.agent_name && (
            <div>
              <dt className="mb-0.5 text-xs text-muted-foreground">Agent</dt>
              <dd className="font-medium">{call.agent_name}</dd>
            </div>
          )}
          {endReasonLabel(call.end_reason) && (
            <div>
              <dt className="mb-0.5 text-xs text-muted-foreground">How it ended</dt>
              <dd className="font-medium">{endReasonLabel(call.end_reason)}</dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  )
}

// ─── Transcript ───────────────────────────────────────────────────────────────

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded bg-yellow-200 px-0.5">{part}</mark>
    ) : (
      part
    )
  )
}

function TranscriptView({ call }: { call: CallDetail }) {
  const transcript = useMemo(() => call.transcript ?? [], [call.transcript])
  const [query, setQuery] = useState('')
  const [atBottom, setAtBottom] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const matches = query.trim()
    ? transcript.filter((t) => t.message.toLowerCase().includes(query.trim().toLowerCase())).length
    : null

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(transcriptAsText(call))
      toast.success('Transcript copied')
    } catch {
      toast.error('Couldn’t copy. Your browser blocked clipboard access.')
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([transcriptAsText(call)], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript-${call.started_at?.slice(0, 10) ?? call.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (transcript.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No transcript"
        description={call.status === 'in-progress' ? 'The transcript appears when the call ends.' : 'Nothing was said on this call.'}
      />
    )
  }

  const words = (role: TranscriptEntry['role']) =>
    transcript.filter((t) => t.role === role).reduce((sum, t) => sum + t.message.split(/\s+/).filter(Boolean).length, 0)
  const agentWords = words('agent')
  const total = agentWords + words('user') || 1
  const agentPct = Math.round((agentWords / total) * 100)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this transcript"
            aria-label="Search this transcript"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => void copyAll()} aria-label="Copy transcript">
          <Copy aria-hidden="true" className="size-3.5" />
          <span className="hidden sm:inline">Copy</span>
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={download} aria-label="Download transcript">
          <Download aria-hidden="true" className="size-3.5" />
          <span className="hidden sm:inline">Download</span>
        </Button>
      </div>
      {matches !== null && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {matches === 0 ? 'No matches' : `${matches} ${matches === 1 ? 'message matches' : 'messages match'}`}
        </p>
      )}

      <div
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current
          if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40)
        }}
        className="relative max-h-[60vh] space-y-3 overflow-y-auto pr-1"
        role="log"
        aria-label="Call transcript"
      >
        {transcript.map((msg, i) => {
          const isAgent = msg.role === 'agent'
          const docs = isAgent
            ? Array.from(new Map((msg.sources ?? []).map((s) => [s.document_id, s])).values())
            : []
          return (
            <div key={i} className={cn('flex items-end gap-2', !isAgent && 'flex-row-reverse')}>
              <div className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', isAgent ? 'bg-purple-100' : 'bg-gray-100')}>
                {isAgent ? <Bot aria-hidden="true" className="size-3.5 text-purple-600" /> : <User aria-hidden="true" className="size-3.5 text-gray-500" />}
              </div>
              <div className={cn('flex min-w-0 max-w-[85%] flex-col gap-1', isAgent ? 'items-start' : 'items-end')}>
                <span className="sr-only">{isAgent ? 'Agent' : 'Caller'}:</span>
                {msg.message && (
                  <div
                    className={cn(
                      'rounded-xl px-3 py-2 text-sm leading-relaxed break-words',
                      isAgent ? 'rounded-tl-sm border border-purple-100 bg-purple-50' : 'rounded-tr-sm border border-gray-200 bg-white'
                    )}
                  >
                    {highlight(msg.message, query.trim())}
                    {msg.interrupted && (
                      <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-[11px] text-muted-foreground" title="The caller spoke over the agent here">
                        <Scissors aria-hidden="true" className="size-3" /> interrupted
                      </span>
                    )}
                  </div>
                )}
                {(msg.tool_calls ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(msg.tool_calls ?? []).map((tool, j) => (
                      <span
                        key={j}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]',
                          tool.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        )}
                      >
                        {tool.ok ? <CheckCircle2 aria-hidden="true" className="size-3" /> : <XCircle aria-hidden="true" className="size-3" />}
                        {toolLabel(tool.name)}
                        {!tool.ok && <span className="sr-only">(didn’t work)</span>}
                      </span>
                    ))}
                  </div>
                )}
                {docs.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {docs.map((doc) => (
                      <span
                        key={doc.document_id}
                        title={doc.excerpt || undefined}
                        className="inline-flex max-w-full items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
                      >
                        <BookOpen aria-hidden="true" className="size-3 shrink-0 text-purple-600" />
                        <span className="truncate">Answered from {doc.document_name}</span>
                      </span>
                    ))}
                  </div>
                )}
                <span className="px-1 text-[11px] text-muted-foreground">{clock(msg.time_in_call_secs)}</span>
              </div>
            </div>
          )
        })}
        {!atBottom && (
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}
            aria-label="Scroll to the end of the transcript"
            className="sticky bottom-2 ml-auto flex size-7 items-center justify-center rounded-full border bg-muted shadow-sm hover:bg-muted/80"
          >
            <ChevronDown className="size-4" />
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {transcript.length} messages · Agent spoke {agentPct}% · Caller spoke {100 - agentPct}%
      </p>
    </div>
  )
}

// ─── Activity timeline ────────────────────────────────────────────────────────

interface TimelineItem {
  key: string
  at: number | null
  icon: typeof Bot
  tone: 'ok' | 'fail' | 'info' | 'warn'
  title: string
  detail?: string | null
}

function secondsInto(call: CallDetail, iso: string): number | null {
  const start = Date.parse(call.started_at ?? '')
  const at = Date.parse(iso)
  if (!Number.isFinite(start) || !Number.isFinite(at)) return null
  return Math.max(0, Math.round((at - start) / 1000))
}

function buildTimeline(call: CallDetail): TimelineItem[] {
  const items: TimelineItem[] = []

  if (call.tool_invocations.length > 0) {
    for (const inv of call.tool_invocations) {
      if (inv.tool_name === 'get_call_context') continue
      items.push({
        key: `tool-${inv.id}`,
        at: secondsInto(call, inv.created_at),
        icon: Wrench,
        tone: inv.ok ? 'ok' : 'fail',
        title: inv.ok ? toolLabel(inv.tool_name) : `${toolLabel(inv.tool_name)} (didn’t work)`,
        detail: inv.result_summary,
      })
    }
  } else {
    ;(call.transcript ?? []).forEach((turn, i) => {
      ;(turn.tool_calls ?? []).forEach((tool, j) => {
        if (tool.name === 'get_call_context') return
        items.push({
          key: `turn-${i}-${j}`,
          at: turn.time_in_call_secs,
          icon: Wrench,
          tone: tool.ok ? 'ok' : 'fail',
          title: tool.ok ? toolLabel(tool.name) : `${toolLabel(tool.name)} (didn’t work)`,
        })
      })
    })
  }

  for (const booking of call.bookings) {
    let when = booking.starts_at
    try {
      when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: booking.timezone }).format(new Date(booking.starts_at))
    } catch {
      // Unknown time zone on an old row: show the stored timestamp.
    }
    items.push({
      key: `booking-${booking.id}`,
      at: secondsInto(call, booking.created_at),
      icon: CalendarCheck,
      tone: booking.status === 'cancelled' ? 'warn' : 'ok',
      title: `${booking.status === 'cancelled' ? 'Appointment cancelled' : booking.status === 'rescheduled' ? 'Appointment rescheduled' : 'Appointment booked'}${booking.service ? `: ${booking.service}` : ''}`,
      detail: `${booking.caller_name} · ${when}`,
    })
  }

  for (const message of call.messages) {
    items.push({
      key: `message-${message.id}`,
      at: secondsInto(call, message.created_at),
      icon: MessageSquare,
      tone: message.urgency === 'urgent' ? 'warn' : 'info',
      title: `${message.urgency === 'urgent' ? 'Urgent message' : 'Message'}${message.recipient_name ? ` for ${message.recipient_name}` : ''}`,
      detail: message.body,
    })
  }

  items.sort((a, b) => (a.at ?? Number.MAX_SAFE_INTEGER) - (b.at ?? Number.MAX_SAFE_INTEGER))

  const ended = endReasonLabel(call.end_reason)
  if (ended && call.status !== 'in-progress') {
    items.push({ key: 'ended', at: call.duration_seconds || null, icon: PhoneOff, tone: 'info', title: ended })
  }
  return items
}

const TONE_CLASSES: Record<TimelineItem['tone'], string> = {
  ok: 'bg-emerald-100 text-emerald-700',
  fail: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  warn: 'bg-amber-100 text-amber-800',
}

function Activity({ call }: { call: CallDetail }) {
  const items = buildTimeline(call)
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Wrench}
        title="No actions on this call"
        description="Bookings, messages, transfers and other things your agent does during a call show up here."
      />
    )
  }
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {items.map((item) => (
        <li key={item.key} className="relative">
          <span className={cn('absolute -left-[31px] flex size-5 items-center justify-center rounded-full ring-4 ring-background', TONE_CLASSES[item.tone])}>
            <item.icon aria-hidden="true" className="size-3" />
          </span>
          <p className="text-sm font-medium">{item.title}</p>
          {item.detail && <p className="mt-0.5 text-sm break-words text-muted-foreground">{item.detail}</p>}
          {item.at !== null && <p className="mt-0.5 text-[11px] text-muted-foreground">at {clock(item.at)}</p>}
        </li>
      ))}
    </ol>
  )
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function IntegrationAction({
  icon: Icon, iconColor, label, description, buttonLabel, callId, type, available, unavailableReason,
}: {
  icon: typeof Bot
  iconColor: string
  label: string
  description: string
  buttonLabel: string
  callId: string
  type: 'email' | 'google_docs' | 'google_sheets'
  available: boolean
  unavailableReason?: string
}) {
  const [sent, setSent] = useState(false)
  const [isPending, start] = useTransition()

  function send() {
    start(async () => {
      try {
        const res = await fetch(`/api/calls/${callId}/integrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type }),
        })
        const body = (await res.json().catch(() => null)) as { message?: string; error?: { message?: string } } | null
        if (!res.ok) {
          toast.error(body?.error?.message ?? 'That didn’t work. Please try again.')
          return
        }
        setSent(true)
        toast.success(body?.message ?? 'Sent')
      } catch {
        toast.error('We couldn’t reach the server. Check your connection and try again.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', iconColor)} />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{available ? description : unavailableReason}</p>
        </div>
      </div>
      {sent ? (
        <span className="flex items-center gap-1 text-xs text-green-600">
          <CheckCheck aria-hidden="true" className="size-3.5" /> Done
        </span>
      ) : (
        <Button variant="outline" size="sm" disabled={!available || isPending} onClick={send} className="self-start sm:self-auto">
          {isPending ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : null}
          {isPending ? 'Sending…' : buttonLabel}
        </Button>
      )}
    </div>
  )
}

function Actions({ call, onDelete }: { call: CallDetail; onDelete: () => void }) {
  const [connected, setConnected] = useState<{ callId: string; docs: boolean; sheets: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
  const number = callerLabel(call)

  useEffect(() => {
    if (!call.integrations_entitled) return
    const controller = new AbortController()
    const check = (type: string) =>
      fetch(`/api/integrations/${type}`, { signal: controller.signal, cache: 'no-store' })
        .then((r) => (r.ok ? (r.json() as Promise<{ connected?: boolean }>) : { connected: false }))
        .then((d) => !!d.connected)
        .catch(() => false)
    Promise.all([check('google_docs'), check('google_sheets')]).then(([docs, sheets]) => {
      if (!controller.signal.aborted) setConnected({ callId: call.id, docs, sheets })
    })
    return () => controller.abort()
  }, [call.id, call.integrations_entitled])

  const status = connected?.callId === call.id ? connected : null

  async function copyNumber() {
    if (!number) return
    try {
      await navigator.clipboard.writeText(number)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Couldn’t copy. Your browser blocked clipboard access.')
    }
  }

  const googleReason = !call.integrations_entitled
    ? 'Part of a higher plan.'
    : status === null
      ? 'Checking the connection…'
      : 'Connect it first on the Integrations page.'

  return (
    <div className="space-y-5">
      <section>
        <SectionTitle>Send this call</SectionTitle>
        <div className="divide-y rounded-xl border px-3">
          <IntegrationAction
            icon={Mail} iconColor="text-red-500" label="Email the summary"
            description="Sends the summary and details to your account email"
            buttonLabel="Send email" callId={call.id} type="email" available
          />
          <IntegrationAction
            icon={FileText} iconColor="text-blue-600" label="Create a call report"
            description="A formatted report in Google Docs"
            buttonLabel="Create" callId={call.id} type="google_docs"
            available={!!status?.docs} unavailableReason={googleReason}
          />
          <IntegrationAction
            icon={Table2} iconColor="text-green-600" label="Log to Google Sheets"
            description="Adds a row to your call-log spreadsheet"
            buttonLabel="Add row" callId={call.id} type="google_sheets"
            available={!!status?.sheets} unavailableReason={googleReason}
          />
        </div>
        {!call.integrations_entitled && (
          <UpgradeNotice compact className="mt-2" feature="Google integrations" requiredPlan={call.integrations_required_plan} />
        )}
      </section>

      <section>
        <SectionTitle>Caller</SectionTitle>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => void copyNumber()} disabled={!number}>
          {copied ? <CheckCheck aria-hidden="true" className="size-4 text-green-500" /> : <Copy aria-hidden="true" className="size-4" />}
          {copied ? 'Copied' : 'Copy caller number'}
        </Button>
      </section>

      <section className="border-t pt-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-600">Delete</h3>
        <div className="flex flex-col gap-3 rounded-xl border border-red-100 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Trash2 aria-hidden="true" className="size-4 text-red-500" /> Delete this call
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Removes the transcript, summary and recording, including the copies kept by our voice providers.
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={onDelete} className="self-start">
            Delete
          </Button>
        </div>
      </section>
    </div>
  )
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

const PENDING_REFRESH_MS = 10_000
/** About three minutes of automatic refreshes per opened call. */
const MAX_PENDING_REFRESHES = 18

interface CallDetailSheetProps {
  callId: string | null
  onClose: () => void
  onDeleted: (id: string) => void
  defaultTab?: string
}

export function CallDetailSheet({ callId, onClose, onDeleted, defaultTab = 'overview' }: CallDetailSheetProps) {
  const { call, isLoading, error, refetch } = useCallDetail(callId)
  const [tabState, setTabState] = useState<{ key: string; tab: string }>({ key: '', tab: defaultTab })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [refreshes, setRefreshes] = useState<{ callId: string | null; count: number }>({ callId: null, count: 0 })

  // A call that is still going, or whose summary is being written, refreshes
  // itself for a few minutes so the owner doesn't have to reopen it.
  const pending = !!call && (call.status === 'in-progress' || (!call.outcome && (call.transcript ?? []).length > 0))
  const refreshCount = refreshes.callId === callId ? refreshes.count : 0
  useEffect(() => {
    if (!pending || !callId || isLoading || refreshCount >= MAX_PENDING_REFRESHES) return
    const timer = setTimeout(() => {
      setRefreshes({ callId, count: refreshCount + 1 })
      refetch()
    }, PENDING_REFRESH_MS)
    return () => clearTimeout(timer)
  }, [pending, callId, isLoading, refreshCount, refetch])

  // A new call (or a new requested tab) starts on the requested tab.
  const tabKey = `${callId}:${defaultTab}`
  const tab = tabState.key === tabKey ? tabState.tab : defaultTab
  const number = call ? callerLabel(call) : null

  return (
    <>
      <Sheet open={!!callId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="flex flex-col gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          <SheetHeader className="shrink-0 border-b px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3 pr-8">
              <div className="min-w-0">
                <SheetTitle className={cn('truncate', call && number && 'font-mono')}>
                  {call ? (number ? formatPhoneNumber(number) : 'Unknown caller') : 'Call details'}
                </SheetTitle>
                <SheetDescription>
                  {call?.started_at ? formatDate(call.started_at) : isLoading ? 'Loading…' : ' '}
                </SheetDescription>
              </div>
              {call && <StatusBadge status={call.status} className="shrink-0" />}
            </div>
            {call && (call.is_test || call.fallback_used) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {call.is_test && <TestBadge />}
                {call.fallback_used && <FallbackBadge />}
              </div>
            )}
          </SheetHeader>

          {error && !call ? (
            <div className="flex-1 p-5">
              <EmptyState
                icon={PhoneOff}
                title="We couldn’t open this call"
                description={error}
                action={
                  <Button variant="outline" onClick={refetch} className="gap-2">
                    <RefreshCw aria-hidden="true" className="size-4" /> Try again
                  </Button>
                }
              />
            </div>
          ) : !call ? (
            <div className="flex-1 space-y-4 p-5" aria-busy="true" aria-label="Loading call">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
              </div>
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ) : (
            <Tabs
              value={tab}
              onValueChange={(value) => setTabState({ key: tabKey, tab: String(value) })}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <TabsList variant="line" className="w-full shrink-0 justify-start overflow-x-auto rounded-none border-b px-3 group-data-horizontal/tabs:h-11 sm:px-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="flex-1 overflow-y-auto p-4 sm:p-5">
                <Overview call={call} />
              </TabsContent>
              <TabsContent value="transcript" className="flex-1 overflow-y-auto p-4 sm:p-5">
                <TranscriptView call={call} />
              </TabsContent>
              <TabsContent value="activity" className="flex-1 overflow-y-auto p-4 sm:p-5">
                <Activity call={call} />
              </TabsContent>
              <TabsContent value="actions" className="flex-1 overflow-y-auto p-4 sm:p-5">
                <Actions call={call} onDelete={() => setDeleteOpen(true)} />
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      {call && (
        <DeleteCallDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          callId={call.id}
          onDeleted={(id) => {
            onDeleted(id)
            onClose()
          }}
        />
      )}
    </>
  )
}
