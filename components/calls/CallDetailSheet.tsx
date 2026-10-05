'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import {
  PhoneIncoming, PhoneOutgoing, Bot, User, Copy, CheckCheck,
  Play, Pause, Download, Loader2, Mail, FileText, Table2,
  Trash2, Search, ChevronDown, Route, ClipboardList, ListChecks, RotateCw,
} from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { WorkInProgressBadge } from '@/components/shared/WorkInProgressBadge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatDuration, formatDate, formatPhoneNumber } from '@/lib/utils'
import { toast } from 'sonner'
import { useCallDetail } from '@/hooks/useCallDetail'
import { readApiError } from '@/hooks/useCalls'
import { DeleteCallDialog } from './DeleteCallDialog'
import { CallStatusBadge, HandledByBadge } from './CallBadges'
import {
  callResultLabel,
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
import type { Call, TranscriptEntry } from '@/types'

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon?: typeof Bot }) {
  return (
    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </h3>
  )
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground mb-0.5">{label}</dt>
      <dd className="font-medium text-sm break-words">{children}</dd>
    </div>
  )
}

// ─── Recording ────────────────────────────────────────────────────────────────

function AudioPlayer({ url, fallbackDuration }: { url: string; fallbackDuration: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [failed, setFailed] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)

  const total = duration || fallbackDuration
  const progress = total ? Math.min(100, (current / total) * 100) : 0

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused) {
      audio.pause()
      return
    }
    setBuffering(true)
    audio.play().then(
      () => setBuffering(false),
      () => {
        setBuffering(false)
        setFailed(true)
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

  if (failed) {
    return (
      <p className="rounded-xl border bg-gray-50 p-4 text-sm text-muted-foreground" role="status">
        The recording could not be loaded. It may still be processing at the voice provider, or it was removed.
      </p>
    )
  }

  return (
    <div className="rounded-xl bg-gray-50 border p-4 flex items-center gap-3">
      <audio
        ref={audioRef}
        src={url}
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
          setFailed(true)
        }}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause recording' : 'Play recording'}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2"
      >
        {buffering ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
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
            'h-2 w-full rounded-full bg-gray-200 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            duration ? 'cursor-pointer' : 'cursor-default'
          )}
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1" aria-hidden="true">
          <span>{fmtClock(current)}</span>
          <span>{fmtClock(total)}</span>
        </div>
      </div>
      <a
        href={url}
        download
        aria-label="Download recording"
        className="rounded text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Download className="h-4 w-4" />
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
    <section aria-labelledby="call-recording-title">
      <h3 id="call-recording-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Recording
      </h3>
      {available ? (
        <AudioPlayer url={`/api/calls/${encodeURIComponent(call.id)}/audio`} fallbackDuration={call.duration_seconds} />
      ) : (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </section>
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
    <section>
      <SectionTitle icon={Route}>Call handling</SectionTitle>
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <HandledByBadge call={call} />
          <p className="text-sm text-muted-foreground">{info.description}</p>
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
          {routing && <InfoItem label="Routing">{routing}</InfoItem>}
          <InfoItem label="Voice provider">{provider ?? '—'}</InfoItem>
          {ended && <InfoItem label="How the call ended">{ended}</InfoItem>}
        </dl>
        {failover.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">{failoverTitle}</p>
            <ul className="list-disc space-y-0.5 pl-5 text-sm">
              {failover.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>
        )}
        {(call.routing_reason || call.failover_reason || call.provider_call_id) && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
              Technical details for support
            </summary>
            <dl className="mt-2 space-y-1 font-mono break-all">
              {call.routing_reason && <div><dt className="inline">routing: </dt><dd className="inline">{call.routing_reason}</dd></div>}
              {call.failover_reason && <div><dt className="inline">failover: </dt><dd className="inline">{call.failover_reason}</dd></div>}
              {call.provider_call_id && <div><dt className="inline">provider call id: </dt><dd className="inline">{call.provider_call_id}</dd></div>}
            </dl>
          </details>
        )}
      </div>
    </section>
  )
}

const EVALUATION_TONE: Record<'success' | 'failure' | 'unknown', string> = {
  success: 'border-green-200 bg-green-50 text-green-700',
  failure: 'border-red-200 bg-red-50 text-red-700',
  unknown: 'border-gray-200 bg-gray-100 text-gray-600',
}

function AnalysisSections({ call }: { call: Call }) {
  const data = Object.entries(call.analysis?.data ?? {})
  const evaluation = Object.entries(call.analysis?.evaluation ?? {})
  if (data.length === 0 && evaluation.length === 0) return null

  return (
    <>
      {data.length > 0 && (
        <section>
          <SectionTitle icon={ClipboardList}>Details collected</SectionTitle>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <caption className="sr-only">Information the agent collected during the call</caption>
              <thead className="bg-gray-50/80">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Field</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.map(([key, value]) => (
                  <tr key={key} className="border-t">
                    <th scope="row" className="px-3 py-2 text-left font-medium align-top">{humanizeKey(key)}</th>
                    <td className="px-3 py-2 break-words">{formatCollectedValue(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {evaluation.length > 0 && (
        <section>
          <SectionTitle icon={ListChecks}>Evaluation</SectionTitle>
          <ul className="space-y-2">
            {evaluation.map(([key, item]) => {
              const tone = evaluationResultTone(item.result)
              return (
                <li key={key} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{humanizeKey(key)}</p>
                    <Badge variant="outline" className={cn('text-xs', EVALUATION_TONE[tone])}>
                      {evaluationResultLabel(item.result)}
                    </Badge>
                  </div>
                  {item.rationale && <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{item.rationale}</p>}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}

// ─── Transcript ───────────────────────────────────────────────────────────────

function TranscriptView({ transcript, callId }: { transcript: TranscriptEntry[]; callId: string }) {
  const [search, setSearch] = useState('')
  const [atBottom, setAtBottom] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  function highlightText(text: string) {
    if (!search) return text
    const parts = text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === search.toLowerCase()
        ? <mark key={i} className="bg-yellow-200 rounded px-0.5">{part}</mark>
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
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <FileText className="h-8 w-8 mb-2 opacity-40" aria-hidden="true" />
        <p className="text-sm">No transcript available</p>
      </div>
    )
  }

  const agentWords  = transcript.filter((t) => t.role === 'agent').reduce((s, t) => s + t.message.split(' ').length, 0)
  const callerWords = transcript.filter((t) => t.role === 'user').reduce((s, t) => s + t.message.split(' ').length, 0)
  const total = agentWords + callerWords || 1
  const agentPct  = Math.round((agentWords / total) * 100)
  const callerPct = 100 - agentPct

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transcript…"
            aria-label="Search transcript"
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={copyAll} aria-label="Copy transcript">
          <Copy className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Copy</span>
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={downloadTxt} aria-label="Download transcript">
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Download</span>
        </Button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative max-h-[420px] overflow-y-auto space-y-3 pr-1"
        role="log"
        aria-label="Call transcript"
      >
        {transcript.map((msg, i) => {
          const isAgent = msg.role === 'agent'
          return (
            <div key={i} className={cn('flex items-end gap-2', isAgent ? '' : 'flex-row-reverse')}>
              <div className={cn(
                'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
                isAgent ? 'bg-purple-100' : 'bg-gray-100'
              )}>
                {isAgent
                  ? <Bot className="h-3.5 w-3.5 text-purple-600" aria-label="Agent" />
                  : <User className="h-3.5 w-3.5 text-gray-500" aria-label="Caller" />}
              </div>
              <div className={cn('flex flex-col gap-1 max-w-[85%]', isAgent ? 'items-start' : 'items-end')}>
                <div className={cn(
                  'rounded-xl px-3 py-2 text-sm leading-relaxed',
                  isAgent
                    ? 'bg-purple-50 border border-purple-100 rounded-tl-sm'
                    : 'bg-white border border-gray-200 rounded-tr-sm'
                )}>
                  {highlightText(msg.message)}
                </div>
                <span className="text-[11px] text-muted-foreground px-1">
                  at {formatDuration(msg.time_in_call_secs)}
                </span>
              </div>
            </div>
          )
        })}

        {/* Scroll to bottom */}
        {!atBottom && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to the end of the transcript"
            className="sticky bottom-2 ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-muted shadow-sm border hover:bg-muted/80"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Stats */}
      <p className="text-xs text-muted-foreground">
        {transcript.length} messages · Agent spoke {agentPct}% · Caller spoke {callerPct}%
      </p>
    </div>
  )
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function IntegrationAction({
  icon: Icon, iconColor, label, description, buttonLabel, callId, type, connected, workInProgress,
}: {
  icon: typeof Bot; iconColor: string; label: string; description: string
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
    <div className="flex items-center justify-between gap-3 py-3 px-3 border-b last:border-0">
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', iconColor)} aria-hidden="true" />
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {label}
            {workInProgress && <WorkInProgressBadge />}
          </p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {sent ? (
        <span className="text-xs text-green-600 flex items-center gap-1" role="status">
          <CheckCheck className="h-3.5 w-3.5" /> Sent!
        </span>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={!connected || isPending || workInProgress}
          onClick={handleSend}
          title={workInProgress ? 'Coming soon' : !connected ? 'Connect this integration first' : undefined}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Sending" /> : buttonLabel}
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

const SENTIMENT_DATA = {
  positive: { emoji: '😊', label: 'Positive', color: 'text-green-600', desc: 'Customer seemed happy and satisfied' },
  neutral:  { emoji: '😐', label: 'Neutral',  color: 'text-gray-700', desc: 'Conversation was balanced' },
  negative: { emoji: '😞', label: 'Negative', color: 'text-red-600',  desc: 'Customer seemed frustrated' },
} as const

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

  return (
    <>
      <Sheet open={!!callId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0 gap-0 overflow-hidden">
          {/* Header */}
          <SheetHeader className="px-5 py-4 border-b flex-shrink-0">
            <div className="flex items-start justify-between gap-3 pr-6">
              <div className="min-w-0">
                <SheetTitle>Call details</SheetTitle>
                <SheetDescription className="font-mono truncate">
                  {call ? (call.caller_number ? formatPhoneNumber(call.caller_number) : 'Unknown caller') : 'Loading…'}
                </SheetDescription>
              </div>
              {call && (
                <div className="flex flex-wrap justify-end gap-1.5">
                  <CallStatusBadge status={call.status} />
                  <HandledByBadge call={call} />
                </div>
              )}
            </div>
          </SheetHeader>

          {!call && error ? (
            <div className="p-5 flex flex-1 flex-col items-center justify-center gap-3 text-center" role="alert">
              <p className="text-sm font-medium">This call could not be loaded</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={refetch}>
                <RotateCw className="h-3.5 w-3.5" /> Try again
              </Button>
            </div>
          ) : isLoading || !call ? (
            <div className="p-5 space-y-3 flex-1" aria-busy="true" aria-label="Loading call">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
              <TabsList variant="line" className="px-5 pt-1 flex-shrink-0 border-b rounded-none w-full justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>

              {/* --- OVERVIEW --- */}
              <TabsContent value="overview" className="flex-1 overflow-y-auto p-5 space-y-5">
                {(call.summary_title || outcome) && (
                  <div className="space-y-1.5">
                    {call.summary_title && <p className="text-base font-semibold leading-snug">{call.summary_title}</p>}
                    {outcome && (
                      <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 text-xs">
                        {outcome}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Call info grid */}
                <dl className="rounded-xl bg-gray-50 border p-4 grid grid-cols-2 gap-3 text-sm">
                  <InfoItem label="Direction">
                    <span className="flex items-center gap-1.5">
                      {call.direction === 'inbound'
                        ? <PhoneIncoming className="h-4 w-4 text-blue-500" aria-hidden="true" />
                        : <PhoneOutgoing className="h-4 w-4 text-purple-500" aria-hidden="true" />}
                      {call.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                    </span>
                  </InfoItem>
                  <InfoItem label="Duration">{call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : '—'}</InfoItem>
                  <InfoItem label="Started"><span className="text-xs">{call.started_at ? formatDate(call.started_at) : '—'}</span></InfoItem>
                  <InfoItem label="Ended"><span className="text-xs">{call.ended_at ? formatDate(call.ended_at) : '—'}</span></InfoItem>
                  {call.from_number && <InfoItem label="From"><span className="font-mono text-xs">{formatPhoneNumber(call.from_number)}</span></InfoItem>}
                  {call.to_number && <InfoItem label="To"><span className="font-mono text-xs">{formatPhoneNumber(call.to_number)}</span></InfoItem>}
                  <InfoItem label="Outcome">{outcome ?? '—'}</InfoItem>
                  <InfoItem label="Call result">{result ?? '—'}</InfoItem>
                </dl>

                <CallHandlingSection call={call} />

                {/* Sentiment */}
                <section>
                  <SectionTitle>Sentiment analysis</SectionTitle>
                  {call.sentiment ? (() => {
                    const s = SENTIMENT_DATA[call.sentiment]
                    return (
                      <div className="flex flex-col items-center py-4 rounded-xl bg-gray-50 border gap-2">
                        <span className="text-4xl" role="img" aria-label={`${s.label} sentiment`}>{s.emoji}</span>
                        <p className={cn('text-xl font-bold', s.color)}>{s.label}</p>
                        <p className="text-sm text-muted-foreground">{s.desc}</p>
                      </div>
                    )
                  })() : (
                    <p className="text-sm text-muted-foreground">
                      {isLiveStatus(call.status) ? 'Analysis pending…' : 'No sentiment for this call'}
                    </p>
                  )}
                </section>

                {/* Summary */}
                <section>
                  <SectionTitle>Call summary</SectionTitle>
                  {call.summary ? (
                    <div className="rounded-xl bg-purple-50 border border-purple-100 p-4">
                      <p className="flex items-center gap-1.5 text-xs text-purple-600 font-medium mb-2">
                        <Bot className="h-3.5 w-3.5" aria-hidden="true" /> AI Summary
                      </p>
                      <p className="text-sm leading-relaxed whitespace-pre-line">{call.summary}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Summary not available</p>
                  )}
                </section>

                <AnalysisSections call={call} />

                <RecordingSection call={call} />
              </TabsContent>

              {/* --- TRANSCRIPT --- */}
              <TabsContent value="transcript" className="flex-1 overflow-y-auto p-5">
                <TranscriptView transcript={call.transcript ?? []} callId={call.id} />
              </TabsContent>

              {/* --- ACTIONS --- */}
              <TabsContent value="actions" className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Integrations */}
                <section>
                  <SectionTitle>Send to integrations</SectionTitle>
                  <div className="rounded-xl border divide-y">
                    <IntegrationAction
                      icon={Table2} iconColor="text-green-600"
                      label="Log to Google Sheets"
                      description="Add this call to your call-log spreadsheet"
                      buttonLabel="Send" callId={call.id} type="google_sheets" connected={connected.google_sheets}
                      workInProgress
                    />
                    <IntegrationAction
                      icon={FileText} iconColor="text-blue-600"
                      label="Create call report"
                      description="Generate a formatted report in Google Docs"
                      buttonLabel="Create" callId={call.id} type="google_docs" connected={connected.google_docs}
                      workInProgress
                    />
                    <IntegrationAction
                      icon={Mail} iconColor="text-red-500"
                      label="Email summary"
                      description="Send call summary to your email"
                      buttonLabel="Send email" callId={call.id} type="gmail" connected={connected.gmail}
                    />
                  </div>
                </section>

                {/* Call management */}
                <section className="border-t pt-4">
                  <SectionTitle>Call management</SectionTitle>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2"
                      onClick={copyNumber}
                      disabled={!call.caller_number}
                    >
                      {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copied!' : 'Copy caller number'}
                    </Button>
                  </div>
                </section>

                {/* Danger zone */}
                <section className="border-t pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-3">
                    Danger zone
                  </h3>
                  <div className="rounded-xl border border-red-100 p-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <Trash2 className="h-4 w-4 text-red-500" aria-hidden="true" /> Delete this call record
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Permanently removes the call, transcript and recording, including the copy at the voice provider.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteOpen(true)}
                    >
                      Delete
                    </Button>
                  </div>
                </section>
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
