'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import {
  PhoneIncoming, PhoneOutgoing, Copy, CheckCheck,
  Play, Pause, Download, Mail, FileText, Table2,
  Trash2, Search, ChevronDown, Route, ClipboardList, ListChecks, RotateCw,
  ThumbsUp, ThumbsDown, Sparkles, Wrench, CircleCheck, CircleX, CircleHelp,
  TriangleAlert, Info, ChevronRight, X, type LucideIcon,
} from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { WorkInProgressBadge } from '@/components/shared/WorkInProgressBadge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EmptyState } from '@/components/shared/EmptyState'
import { OrbInline, OrbLoader } from '@/components/shared/OrbLoader'
import { StatusChip, type StatusTone } from '@/components/shared/StatusChip'
import { cn, formatDuration, formatDate, formatPhoneNumber } from '@/lib/utils'
import { toast } from 'sonner'
import { useCallDetail } from '@/hooks/useCallDetail'
import { readApiError } from '@/hooks/useCalls'
import { DeleteCallDialog } from './DeleteCallDialog'
import { CallStatusBadge, HandledByBadge, TestCallBadge } from './CallBadges'
import {
  AI_OUTCOME_DESCRIPTION,
  callResultLabel,
  languageLabel,
  toolEventLabel,
  describeFailoverReason,
  evaluationResultLabel,
  evaluationResultTone,
  formatCollectedValue,
  handledBy,
  humanizeKey,
  isLiveStatus,
  outcomeLabel,
  providerLabel,
  routingReasonLabel,
  terminationReasonLabel,
} from '@/lib/calls/labels'
import type { Call, CallDetails, TranscriptEntry } from '@/types'
import { CallBusinessSection } from './CallBusinessSection'

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** 11 px tracked uppercase label: section heads, definition terms, transcript speakers. */
const OVERLINE = 'text-[11px] leading-4 font-medium tracking-[0.12em] uppercase text-muted-foreground'

/** Tab panels are focusable scroll containers: an inset outline, so the sheet edge does not clip it. */
const PANEL = 'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring'

/** A titled block of the sheet; blocks are separated by hairlines (see the tab panels). */
function Section({
  title, icon: Icon, iconClassName, titleClassName, action, id, children,
}: {
  title: React.ReactNode
  icon?: LucideIcon
  iconClassName?: string
  titleClassName?: string
  action?: React.ReactNode
  id?: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="py-6 first:pt-0 last:pb-0">
      <div className="mb-3 flex min-h-6 items-center justify-between gap-3">
        <h3 id={id} className={cn('flex items-center gap-1.5', OVERLINE, titleClassName)}>
          {Icon && <Icon className={cn('size-3.5 shrink-0', iconClassName)} aria-hidden="true" />}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={OVERLINE}>{label}</dt>
      <dd className="mt-1 text-sm break-words text-foreground">{children}</dd>
    </div>
  )
}

// ─── Recording ────────────────────────────────────────────────────────────────

const LOAD_FAILED = 'The recording could not be loaded. It may still be processing at the voice provider, or it was removed.'
const TOO_MANY = 'Too many recording requests right now. Please wait a minute and try again.'

type PlayerFailure = { message: string; retry: boolean }

/**
 * The audio route streams the recording without byte ranges, so the player
 * downloads it once (on first Play) into a Blob and plays the object URL,
 * which the browser can seek freely. The download link keeps using the route.
 */
function AudioPlayer({ url, fallbackDuration }: { url: string; fallbackDuration: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [failure, setFailure] = useState<PlayerFailure | null>(null)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)

  const total = duration || fallbackDuration
  const progress = total ? Math.min(100, (current / total) * 100) : 0

  // Abort an in-flight download and free the Blob when the call changes or
  // the player unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [url])

  /** Downloads the recording once; null when it failed or was cancelled. */
  async function download(): Promise<string | null> {
    if (objectUrlRef.current) return objectUrlRef.current
    const controller = new AbortController()
    abortRef.current = controller
    setDownloading(true)
    try {
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
      if (!res.ok) {
        const message = res.status === 429 ? TOO_MANY : await readApiError(res, LOAD_FAILED)
        if (!controller.signal.aborted) setFailure({ message, retry: res.status === 429 || res.status >= 500 })
        return null
      }
      const blob = await res.blob()
      if (controller.signal.aborted) return null
      objectUrlRef.current = URL.createObjectURL(blob)
      return objectUrlRef.current
    } catch (err) {
      // Cancelled by the user or by unmount: nothing went wrong.
      if (controller.signal.aborted) return null
      console.warn('Recording download failed', err)
      setFailure({ message: 'The recording could not be downloaded. Check your connection and try again.', retry: true })
      return null
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setDownloading(false)
      }
    }
  }

  async function toggle() {
    let audio = audioRef.current
    if (!audio) return
    if (abortRef.current) {
      // Pressed again while downloading: stop.
      abortRef.current.abort()
      return
    }
    if (!audio.paused) {
      audio.pause()
      return
    }
    if (!objectUrlRef.current) {
      // Touch the element inside the click so Safari still allows play()
      // after the download's await (it has no src yet, so nothing loads).
      audio.load()
      const objectUrl = await download()
      audio = audioRef.current
      if (!objectUrl || !audio) return
      audio.src = objectUrl
    }
    setBuffering(true)
    audio.play().then(
      () => setBuffering(false),
      (err: unknown) => {
        setBuffering(false)
        const name = err instanceof DOMException ? err.name : null
        // Pausing while it buffers rejects the pending play() with AbortError:
        // the recording is fine, the user just stopped it.
        if (name === 'AbortError') return
        if (name === 'NotSupportedError') {
          setFailure({ message: LOAD_FAILED, retry: false })
          return
        }
        // e.g. NotAllowedError (browser playback policy): keep the player so
        // the user can try again; a broken source is reported via onError.
        setPlaying(false)
        console.warn('Recording playback did not start', err)
        toast.error('Playback did not start', { description: 'Press play to try again.' })
      },
    )
  }

  function seekTo(seconds: number) {
    const audio = audioRef.current
    if (!audio || !duration) return
    audio.currentTime = Math.max(0, Math.min(duration, seconds))
  }

  function seekClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    seekTo(((e.clientX - rect.left) / rect.width) * duration)
  }

  function seekKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key]
    if (step !== undefined) {
      e.preventDefault()
      seekTo(current + step)
    } else if (e.key === 'Home') {
      e.preventDefault()
      seekTo(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      seekTo(duration)
    }
  }

  if (failure) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary p-4 text-[13px] leading-[19px] text-muted-foreground"
        role="status"
      >
        <p className="min-w-0 flex-1">{failure.message}</p>
        {failure.retry && (
          <Button type="button" variant="outline" size="sm" onClick={() => setFailure(null)}>
            <RotateCw aria-hidden="true" /> Try again
          </Button>
        )}
      </div>
    )
  }

  const busy = downloading || buffering

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white py-3 pr-2 pl-3 shadow-hair">
      <audio
        ref={audioRef}
        preload="none"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          if (Number.isFinite(d)) setDuration(d)
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onError={() => {
          setPlaying(false)
          setBuffering(false)
          setFailure({ message: LOAD_FAILED, retry: false })
        }}
      />
      {/* Not `loading`: pressing again while it downloads cancels the download. */}
      <Button
        type="button"
        size="icon"
        onClick={() => void toggle()}
        aria-label={downloading ? 'Loading recording — press to cancel' : playing ? 'Pause recording' : 'Play recording'}
        aria-busy={busy}
        className="shrink-0"
      >
        {busy ? <OrbInline state="working" surface="dark" /> : playing ? <Pause /> : <Play className="ml-0.5" />}
      </Button>
      <div className="min-w-0 flex-1">
        <div
          role="slider"
          tabIndex={duration ? 0 : -1}
          aria-label="Recording position"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${fmtClock(current)} of ${fmtClock(total)}`}
          aria-disabled={!duration}
          onClick={seekClick}
          onKeyDown={seekKey}
          className={cn(
            'flex h-4 w-full items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring',
            duration ? 'cursor-pointer' : 'cursor-default'
          )}
        >
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="mt-0.5 flex justify-between text-xs text-muted-foreground tabular-nums" aria-hidden="true">
          <span>{fmtClock(current)}</span>
          <span>{fmtClock(total)}</span>
        </div>
      </div>
      <a
        href={url}
        download
        aria-label="Download recording"
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'tap-44 shrink-0 text-muted-foreground hover:text-foreground')}
      >
        <Download />
      </a>
    </div>
  )
}

function RecordingSection({ call }: { call: Call }) {
  const status = call.recording_status ?? 'unknown'
  const available = status !== 'deleted' && status !== 'unavailable' && (call.has_recording === true || status === 'available')
  let message = 'No recording available'
  if (status === 'pending' || (isLiveStatus(call.status) && status !== 'deleted')) message = 'The recording will appear here once the call has been processed.'
  else if (status === 'deleted') message = 'The recording was deleted.'
  else if (status === 'unavailable') message = 'This call was not recorded.'

  return (
    <Section id="call-recording-title" title="Recording">
      {available ? (
        <AudioPlayer key={call.id} url={`/api/calls/${encodeURIComponent(call.id)}/audio`} fallbackDuration={call.duration_seconds} />
      ) : (
        <p className="text-[13px] text-muted-foreground">{message}</p>
      )}
    </Section>
  )
}

// ─── Routing / analysis ───────────────────────────────────────────────────────

function CallHandlingSection({ call }: { call: Call }) {
  const info = handledBy(call)
  const routing = routingReasonLabel(call.routing_reason)
  const failover = describeFailoverReason(call.failover_reason, call.primary_provider)
  const ended = terminationReasonLabel(call.termination_reason)
  const provider = providerLabel(call.provider)
  const failoverTitle = call.routing_reason === 'provider_fallback' ? 'Why the backup agent answered' : 'What went wrong'

  return (
    <Section title="Call handling" icon={Route}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <HandledByBadge call={call} />
          <p className="text-[13px] leading-[19px] text-muted-foreground">{info.description}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          {routing && <InfoItem label="Routing">{routing}</InfoItem>}
          <InfoItem label="Voice provider">{provider ?? '—'}</InfoItem>
          {ended && <InfoItem label="How the call ended">{ended}</InfoItem>}
        </dl>
        {failover.length > 0 && (
          <div className="rounded-xl bg-warning-soft px-4 py-3">
            <p className="text-[13px] font-medium text-warning">{failoverTitle}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] leading-[19px] text-foreground/80">
              {failover.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>
        )}
        {(call.routing_reason || call.failover_reason || call.provider_call_id || call.details?.provider_error || call.termination_reason) && (
          <details className="group text-xs text-muted-foreground">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md outline-none select-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-3.5 transition-transform duration-200 group-open:rotate-90" aria-hidden="true" />
              Technical details for support
            </summary>
            <dl className="mt-2 space-y-1 rounded-xl bg-secondary p-3 font-mono break-all">
              {call.routing_reason && <div><dt className="inline">routing: </dt><dd className="inline">{call.routing_reason}</dd></div>}
              {call.failover_reason && <div><dt className="inline">failover: </dt><dd className="inline">{call.failover_reason}</dd></div>}
              {call.provider_call_id && <div><dt className="inline">provider call id: </dt><dd className="inline">{call.provider_call_id}</dd></div>}
              {call.termination_reason && <div><dt className="inline">ended: </dt><dd className="inline">{call.termination_reason}</dd></div>}
              {call.details?.provider_error && (
                <div>
                  <dt className="inline">provider error: </dt>
                  <dd className="inline">{call.details.provider_error.code}{call.details.provider_error.reason ? ` · ${call.details.provider_error.reason}` : ''}</dd>
                </div>
              )}
              {(call.details?.warnings ?? []).map((w, i) => (
                <div key={i}><dt className="inline">warning: </dt><dd className="inline">{w}</dd></div>
              ))}
              {typeof call.details?.queue_wait_secs === 'number' && call.details.queue_wait_secs > 0 && (
                <div><dt className="inline">queue wait: </dt><dd className="inline">{call.details.queue_wait_secs}s</dd></div>
              )}
            </dl>
          </details>
        )}
      </div>
    </Section>
  )
}

const EVALUATION_TONE: Record<'success' | 'failure' | 'unknown', StatusTone> = {
  success: 'success',
  failure: 'danger',
  unknown: 'muted',
}

function AnalysisSections({ call }: { call: Call }) {
  const data = Object.entries(call.analysis?.data ?? {})
  const evaluation = Object.entries(call.analysis?.evaluation ?? {})
  if (data.length === 0 && evaluation.length === 0) return null

  return (
    <>
      {data.length > 0 && (
        <Section title="Details collected" icon={ClipboardList}>
          <div className="overflow-hidden rounded-2xl shadow-hair">
            <table className="w-full text-sm">
              <caption className="sr-only">Information the agent collected during the call</caption>
              <thead>
                <tr className="border-b border-rule">
                  <th scope="col" className={cn('h-9 px-4 text-left', OVERLINE)}>Field</th>
                  <th scope="col" className={cn('h-9 px-4 text-left', OVERLINE)}>Value</th>
                </tr>
              </thead>
              <tbody>
                {data.map(([key, value]) => (
                  <tr key={key} className="border-b border-rule last:border-b-0">
                    <th scope="row" className="w-[42%] px-4 py-2.5 text-left align-top font-normal text-muted-foreground">{humanizeKey(key)}</th>
                    <td className="px-4 py-2.5 break-words text-foreground">{formatCollectedValue(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {evaluation.length > 0 && (
        <Section title="Evaluation" icon={ListChecks}>
          <ul className="overflow-hidden rounded-2xl shadow-hair">
            {evaluation.map(([key, item]) => {
              const tone = evaluationResultTone(item.result)
              return (
                <li key={key} className="border-b border-rule px-4 py-3.5 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{humanizeKey(key)}</p>
                    <StatusChip tone={EVALUATION_TONE[tone]} dot>
                      {evaluationResultLabel(item.result)}
                    </StatusChip>
                  </div>
                  {item.rationale && <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">{item.rationale}</p>}
                </li>
              )
            })}
          </ul>
        </Section>
      )}
    </>
  )
}

// ─── AI outcome + owner feedback ──────────────────────────────────────────────

const AI_OUTCOME_STYLE = {
  success: { icon: CircleCheck, className: 'text-success-dot' },
  failure: { icon: CircleX, className: 'text-destructive' },
  unknown: { icon: CircleHelp, className: 'text-muted-foreground' },
} as const

function FeedbackControl({ call }: { call: Call }) {
  const [value, setValue] = useState<'like' | 'dislike' | null>(call.owner_feedback ?? null)
  const [isPending, start] = useTransition()

  function send(next: 'like' | 'dislike') {
    const feedback = value === next ? null : next
    start(async () => {
      try {
        const res = await fetch(`/api/calls/${encodeURIComponent(call.id)}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback }),
        })
        if (!res.ok) {
          toast.error(await readApiError(res, 'Could not save your feedback.'))
          return
        }
        setValue(feedback)
        toast.success(feedback ? 'Thanks, your feedback was saved.' : 'Feedback removed.')
      } catch (e) {
        toast.error(e instanceof Error && e.message ? e.message : 'Could not save your feedback.')
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <p id={`feedback-${call.id}`} className="text-[13px] text-muted-foreground">Was this call handled well?</p>
      <div role="group" aria-labelledby={`feedback-${call.id}`} className="flex gap-1.5">
        <Button
          type="button" variant="outline" size="icon-sm"
          className={cn('tap-44', value === 'like' && 'bg-success-soft text-success shadow-none! hover:bg-success-soft')}
          aria-pressed={value === 'like'} aria-label="Handled well" disabled={isPending} onClick={() => send('like')}
        >
          <ThumbsUp aria-hidden="true" />
        </Button>
        <Button
          type="button" variant="outline" size="icon-sm"
          className={cn('tap-44', value === 'dislike' && 'bg-destructive-soft text-destructive shadow-none! hover:bg-destructive-soft')}
          aria-pressed={value === 'dislike'} aria-label="Not handled well" disabled={isPending} onClick={() => send('dislike')}
        >
          <ThumbsDown aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

/** Re-runs the provider's analysis with the agent's current success criteria and fields. */
function ReanalyzeAction({ call, onDone }: { call: Call; onDone: () => void }) {
  const [isPending, start] = useTransition()
  if (!call.details?.can_reanalyze) return null

  function run() {
    start(async () => {
      try {
        const res = await fetch(`/api/calls/${encodeURIComponent(call.id)}/reanalyze`, { method: 'POST' })
        if (!res.ok) {
          toast.error(await readApiError(res, 'Could not analyse this call again.'))
          return
        }
        toast.success('The call was analysed again.')
        onDone()
      } catch (e) {
        toast.error(e instanceof Error && e.message ? e.message : 'Could not analyse this call again.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-3 border-t border-[#e6e4ec] pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs leading-4 text-muted-foreground sm:max-w-[34ch]">
        Re-runs the AI analysis with your current success criteria and the details you ask the agent to collect.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="self-start sm:self-auto"
        onClick={run}
        loading={isPending}
        loadingState="solving"
        loadingText="Analysing…"
      >
        <RotateCw aria-hidden="true" />
        Analyse again
      </Button>
    </div>
  )
}

/** call_successful, shown as the AI's verdict on the call's goal (never as caller sentiment). */
function AiOutcomeSection({ call, onReanalyzed }: { call: Call; onReanalyzed: () => void }) {
  const verdict = call.call_successful ?? null
  const look = verdict ? AI_OUTCOME_STYLE[verdict] : null
  return (
    <Section title="AI outcome" icon={Sparkles} iconClassName="text-brand">
      <div className="space-y-3 rounded-2xl bg-secondary p-4">
        {verdict && look ? (
          <div className="flex items-start gap-2.5">
            <look.icon className={cn('mt-0.5 size-[18px] shrink-0', look.className)} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{callResultLabel(verdict)}</p>
              <p className="text-[13px] leading-[19px] text-muted-foreground">{AI_OUTCOME_DESCRIPTION[verdict]}</p>
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            {isLiveStatus(call.status) && <OrbInline state="solving" />}
            {isLiveStatus(call.status) ? 'Analysis pending…' : 'No AI verdict for this call.'}
          </p>
        )}
        {!call.is_test && !isLiveStatus(call.status) && <FeedbackControl key={call.id} call={call} />}
        <ReanalyzeAction call={call} onDone={onReanalyzed} />
      </div>
    </Section>
  )
}

// ─── Transcript ───────────────────────────────────────────────────────────────

type TimelineItem =
  | { type: 'message'; at: number; entry: TranscriptEntry }
  | { type: 'tool'; at: number; event: CallDetails['tool_events'][number] }

/** Spoken turns plus the agent's tool use (transfer, voicemail, end call…), in call order. */
function timelineOf(transcript: TranscriptEntry[], toolEvents: CallDetails['tool_events']): TimelineItem[] {
  const items: TimelineItem[] = transcript.map((entry) => ({ type: 'message', at: entry.time_in_call_secs, entry }))
  for (const event of toolEvents) items.push({ type: 'tool', at: event.at_secs, event })
  // Stable: a tool event lands after the turn it belongs to.
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => a.item.at - b.item.at || (a.item.type === b.item.type ? a.i - b.i : a.item.type === 'message' ? -1 : 1))
    .map(({ item }) => item)
}

function TranscriptView({ transcript, callId, toolEvents = [] }: { transcript: TranscriptEntry[]; callId: string; toolEvents?: CallDetails['tool_events'] }) {
  const [search, setSearch] = useState('')
  const [atBottom, setAtBottom] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  function highlightText(text: string) {
    if (!search) return text
    const parts = text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === search.toLowerCase()
        ? <mark key={i} className="rounded-sm bg-brand-soft px-0.5 text-brand">{part}</mark>
        : part
    )
  }

  function copyAll() {
    const text = transcript.map((t) => `${t.role === 'agent' ? 'Agent' : 'Caller'}: ${t.message}`).join('\n')
    navigator.clipboard.writeText(text).then(
      () => toast.success('Transcript copied'),
      () => toast.error('Could not copy to the clipboard'),
    )
  }

  function downloadTxt() {
    const text = transcript.map((t) => `[${t.role === 'agent' ? 'Agent' : 'Caller'}] ${t.message}`).join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript-${callId}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40)
  }

  function scrollToBottom() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }

  if (transcript.length === 0) {
    return <EmptyState icon={FileText} title="No transcript available" />
  }

  const agentWords  = transcript.filter((t) => t.role === 'agent').reduce((s, t) => s + t.message.split(' ').length, 0)
  const callerWords = transcript.filter((t) => t.role === 'user').reduce((s, t) => s + t.message.split(' ').length, 0)
  const total = agentWords + callerWords || 1
  const agentPct  = Math.round((agentWords / total) * 100)
  const callerPct = 100 - agentPct

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transcript…"
            aria-label="Search transcript"
            className="h-9 rounded-full pr-10 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setSearch('')}
              aria-label="Clear transcript search"
              className="tap-44 absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X />
            </Button>
          )}
        </div>
        <Button variant="ghost" size="sm" className="tap-44 h-9 px-2.5 sm:px-3" onClick={copyAll} aria-label="Copy transcript">
          <Copy aria-hidden="true" />
          <span className="hidden sm:inline">Copy</span>
        </Button>
        <Button variant="ghost" size="sm" className="tap-44 h-9 px-2.5 sm:px-3" onClick={downloadTxt} aria-label="Download transcript">
          <Download aria-hidden="true" />
          <span className="hidden sm:inline">Download</span>
        </Button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative max-h-[min(560px,62vh)] overflow-y-auto rounded-2xl bg-secondary p-3 sm:p-4"
        role="log"
        aria-label="Call transcript"
      >
        <div className="flex flex-col gap-4">
          {timelineOf(transcript, toolEvents).map((item, i) => {
            if (item.type === 'tool') {
              return (
                <div key={`tool-${i}`} className="flex justify-center" role="note">
                  <span
                    className={cn(
                      'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs',
                      item.event.ok ? 'bg-white text-muted-foreground shadow-hair' : 'bg-destructive-soft text-destructive'
                    )}
                  >
                    <Wrench className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{toolEventLabel(item.event)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0 tabular-nums">at {formatDuration(item.event.at_secs)}</span>
                  </span>
                </div>
              )
            }
            const msg = item.entry
            const isAgent = msg.role === 'agent'
            return (
              <div key={i} className={cn('flex flex-col gap-1', isAgent ? 'items-start' : 'items-end')}>
                <p className="flex items-baseline gap-1.5 px-1">
                  <span className={OVERLINE}>{isAgent ? 'Agent' : 'Caller'}</span>
                  <span className="text-[11px] leading-4 text-muted-foreground tabular-nums">at {formatDuration(msg.time_in_call_secs)}</span>
                </p>
                <div
                  className={cn(
                    'max-w-[85%] px-3.5 py-2.5 text-sm leading-[21px] break-words',
                    isAgent
                      ? 'rounded-2xl rounded-bl-md bg-white text-foreground shadow-hair'
                      : 'rounded-2xl rounded-br-md bg-primary text-white'
                  )}
                >
                  {highlightText(msg.message)}
                </div>
              </div>
            )
          })}
        </div>

        {/* Scroll to bottom */}
        {!atBottom && (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={scrollToBottom}
            aria-label="Scroll to the end of the transcript"
            className="sticky bottom-0 mt-2 ml-auto flex"
          >
            <ChevronDown />
          </Button>
        )}
      </div>

      {/* Stats */}
      <p className="text-xs text-muted-foreground tabular-nums">
        {transcript.length} messages · Agent spoke {agentPct}% · Caller spoke {callerPct}%
      </p>
    </div>
  )
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function IntegrationAction({
  icon: Icon, label, description, buttonLabel, callId, type, connected, workInProgress,
}: {
  icon: LucideIcon; label: string; description: string
  buttonLabel: string; callId: string; type: string; connected: boolean; workInProgress?: boolean
}) {
  const [sent, setSent] = useState(false)
  const [isPending, start] = useTransition()

  function handleSend() {
    start(async () => {
      try {
        const res = await fetch(`/api/calls/${encodeURIComponent(callId)}/integrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type }),
        })
        if (!res.ok) {
          toast.error(await readApiError(res, 'Could not send this call.'))
          return
        }
        setSent(true)
        toast.success('Sent successfully!')
      } catch (e) {
        toast.error(e instanceof Error && e.message ? e.message : 'Could not send this call.')
      }
    })
  }

  return (
    <div className="flex min-h-14 items-center gap-3 border-b border-rule px-4 py-3 last:border-b-0">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary" aria-hidden="true">
        <Icon className="size-4 text-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
          {label}
          {workInProgress && <WorkInProgressBadge />}
        </p>
        <p className="text-xs leading-4 text-muted-foreground">{description}</p>
      </div>
      {sent ? (
        <StatusChip tone="success" icon={<CheckCheck aria-hidden="true" />} role="status">
          Sent!
        </StatusChip>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={!connected || workInProgress}
          loading={isPending}
          onClick={handleSend}
          title={workInProgress ? 'Coming soon' : !connected ? 'Connect this integration first' : undefined}
        >
          {buttonLabel}
        </Button>
      )}
    </div>
  )
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

interface CallDetailSheetProps {
  callId: string | null
  onClose: () => void
  onDeleted: (id: string) => void
  defaultTab?: string
}

export function CallDetailSheet({ callId, onClose, onDeleted, defaultTab = 'overview' }: CallDetailSheetProps) {
  const { call, isLoading, error, refetch } = useCallDetail(callId)
  const [tab, setTab] = useState(defaultTab)
  const [tabFor, setTabFor] = useState(`${callId}:${defaultTab}`)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  // gmail = email-to-owner via Resend (always available); the Google actions
  // require their integration to be connected.
  const [connected, setConnected] = useState<Record<string, boolean>>({
    gmail: true, google_docs: false, google_sheets: false,
  })

  // Opening another call (or the same call on another tab) resets the tab.
  const tabKey = `${callId}:${defaultTab}`
  if (tabKey !== tabFor) {
    setTabFor(tabKey)
    setTab(defaultTab)
  }

  useEffect(() => {
    if (!callId) return
    let active = true
    Promise.all(
      ['google_docs', 'google_sheets'].map((t) =>
        fetch(`/api/integrations/${t}`)
          .then((r) => (r.ok ? r.json() : { connected: false }))
          .then((d: { connected?: boolean }) => [t, !!d.connected] as const)
          // Unknown connection state: keep the action disabled rather than offer a broken button.
          .catch(() => [t, false] as const)
      )
    ).then((entries) => {
      if (active) setConnected((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
    })
    return () => { active = false }
  }, [callId])

  function copyNumber() {
    if (!call?.caller_number) return
    navigator.clipboard.writeText(call.caller_number).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => toast.error('Could not copy to the clipboard'),
    )
  }

  const outcome = outcomeLabel(call?.outcome)
  const result = callResultLabel(call?.call_successful)
  const language = languageLabel(call?.details?.main_language)
  const inbound = call?.direction === 'inbound'
  const meta = call
    ? [
        call.started_at ? formatDate(call.started_at) : null,
        call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : null,
      ].filter(Boolean).join(' · ')
    : ''

  return (
    <>
      <Sheet open={!!callId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="gap-0 overflow-hidden p-0">
          {/* Header */}
          <SheetHeader className="shrink-0">
            <p className={cn('flex items-center gap-1.5', OVERLINE)}>
              {call && (inbound
                ? <PhoneIncoming className="size-3.5" aria-hidden="true" />
                : <PhoneOutgoing className="size-3.5" aria-hidden="true" />)}
              {call ? (inbound ? 'Inbound call' : 'Outbound call') : 'Call'}
            </p>
            <SheetTitle className="mt-1 truncate tabular-nums">
              {call ? (call.caller_number ? formatPhoneNumber(call.caller_number) : 'Unknown caller') : 'Call details'}
            </SheetTitle>
            {/* While the call loads, the meta line and chip row keep their space,
                so the tabs and body do not move down when the data arrives. */}
            {call ? (
              <SheetDescription className="tabular-nums">{meta || 'Call details'}</SheetDescription>
            ) : (
              <p aria-hidden="true" className="invisible text-[13px] leading-[19px]">—</p>
            )}
            <div className="mt-2.5 flex min-h-6 flex-wrap gap-1.5">
              {call && (
                <>
                  {call.is_test && <TestCallBadge />}
                  <CallStatusBadge status={call.status} />
                  <HandledByBadge call={call} accent />
                </>
              )}
            </div>
          </SheetHeader>

          {!call && error ? (
            <div className="flex flex-1 items-center justify-center p-6" role="alert">
              <EmptyState
                bare
                icon={TriangleAlert}
                iconClassName="bg-destructive-soft text-destructive shadow-none"
                title="This call could not be loaded"
                description={error}
                action={
                  <Button variant="outline" size="sm" onClick={refetch}>
                    <RotateCw aria-hidden="true" /> Try again
                  </Button>
                }
              />
            </div>
          ) : isLoading || !call ? (
            <OrbLoader label="Loading call…" className="min-h-[50vh] flex-1" />
          ) : (
            <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
              <div className="shrink-0 px-6 pt-4">
                <TabsList className="w-full sm:w-fit">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  <TabsTrigger value="actions">Actions</TabsTrigger>
                </TabsList>
              </div>

              {/* --- OVERVIEW --- */}
              <TabsContent value="overview" className={cn(PANEL, 'min-h-0 flex-1 divide-y divide-rule overflow-y-auto px-6 pt-5 pb-8')}>
                <section aria-labelledby="call-summary-title" className="py-6 first:pt-0">
                  {(call.summary_title || outcome) && (
                    <div className="mb-4 space-y-2">
                      {call.summary_title && (
                        <p className="text-[15px] leading-[22px] font-medium text-foreground">{call.summary_title}</p>
                      )}
                      {outcome && <StatusChip tone="neutral">{outcome}</StatusChip>}
                    </div>
                  )}
                  <h3 id="call-summary-title" className={cn('mb-2 flex items-center gap-1.5', OVERLINE)}>
                    <Sparkles className="size-3.5 text-brand" aria-hidden="true" />
                    AI summary
                  </h3>
                  {call.summary ? (
                    <div className="rounded-2xl bg-secondary p-4">
                      <p className="text-sm leading-[22px] whitespace-pre-line text-foreground">{call.summary}</p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">Summary not available</p>
                  )}
                </section>

                {/* Call info */}
                <section aria-label="Call information" className="py-6">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <InfoItem label="Direction">
                      <span className="flex items-center gap-1.5">
                        {inbound
                          ? <PhoneIncoming className="size-4 text-muted-foreground" aria-hidden="true" />
                          : <PhoneOutgoing className="size-4 text-muted-foreground" aria-hidden="true" />}
                        {inbound ? 'Inbound' : 'Outbound'}
                      </span>
                    </InfoItem>
                    <InfoItem label="Duration"><span className="tabular-nums">{call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : '—'}</span></InfoItem>
                    <InfoItem label="Started"><span className="tabular-nums">{call.started_at ? formatDate(call.started_at) : '—'}</span></InfoItem>
                    <InfoItem label="Ended"><span className="tabular-nums">{call.ended_at ? formatDate(call.ended_at) : '—'}</span></InfoItem>
                    {call.from_number && <InfoItem label="From"><span className="tabular-nums">{formatPhoneNumber(call.from_number)}</span></InfoItem>}
                    {call.to_number && <InfoItem label="To"><span className="tabular-nums">{formatPhoneNumber(call.to_number)}</span></InfoItem>}
                    <InfoItem label="Outcome">{outcome ?? '—'}</InfoItem>
                    <InfoItem label="AI outcome">{result ?? '—'}</InfoItem>
                    {language && <InfoItem label="Language">{language}</InfoItem>}
                  </dl>
                </section>

                <AiOutcomeSection call={call} onReanalyzed={refetch} />

                <RecordingSection call={call} />

                <CallBusinessSection key={call.id} callId={call.id} />

                <CallHandlingSection call={call} />

                <AnalysisSections call={call} />

                {/* Danger zone */}
                <Section id="call-danger-zone" title="Danger zone" titleClassName="text-destructive">
                  <div className="flex flex-col gap-3 rounded-2xl p-4 shadow-[0_0_0_1px_rgb(179_38_30/0.18)] sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <Trash2 className="size-4 text-destructive" aria-hidden="true" /> Delete this call record
                      </p>
                      <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                        Permanently removes the call, transcript and recording, including the copy at the voice provider.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="self-start sm:self-auto"
                      onClick={() => setDeleteOpen(true)}
                    >
                      Delete
                    </Button>
                  </div>
                </Section>
              </TabsContent>

              {/* --- TRANSCRIPT --- */}
              <TabsContent value="transcript" className={cn(PANEL, 'min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-8')}>
                {call.details?.content_purged && (
                  <Alert role="note" className="mb-4">
                    <Info aria-hidden="true" />
                    <AlertDescription>
                      The transcript, summary and recording were removed by your retention setting (Agent › Call handling › Privacy).
                    </AlertDescription>
                  </Alert>
                )}
                <TranscriptView transcript={call.transcript ?? []} callId={call.id} toolEvents={call.details?.tool_events ?? []} />
              </TabsContent>

              {/* --- ACTIONS --- */}
              <TabsContent value="actions" className={cn(PANEL, 'min-h-0 flex-1 divide-y divide-rule overflow-y-auto px-6 pt-5 pb-8')}>
                {/* Integrations */}
                <Section title="Send to integrations">
                  <div className="overflow-hidden rounded-2xl shadow-hair">
                    <IntegrationAction
                      icon={Table2}
                      label="Log to Google Sheets"
                      description="Add this call to your call-log spreadsheet"
                      buttonLabel="Send" callId={call.id} type="google_sheets" connected={connected.google_sheets}
                      workInProgress
                    />
                    <IntegrationAction
                      icon={FileText}
                      label="Create call report"
                      description="Generate a formatted report in Google Docs"
                      buttonLabel="Create" callId={call.id} type="google_docs" connected={connected.google_docs}
                      workInProgress
                    />
                    <IntegrationAction
                      icon={Mail}
                      label="Email summary"
                      description="Send call summary to your email"
                      buttonLabel="Send email" callId={call.id} type="gmail" connected={connected.gmail}
                    />
                  </div>
                </Section>

                {/* Call management */}
                <Section title="Call management">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyNumber}
                    disabled={!call.caller_number}
                  >
                    {copied ? <CheckCheck className="text-success-dot" aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    {copied ? 'Copied!' : 'Copy caller number'}
                  </Button>
                </Section>
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
          onDeleted={(id) => { onDeleted(id); onClose() }}
        />
      )}
    </>
  )
}
