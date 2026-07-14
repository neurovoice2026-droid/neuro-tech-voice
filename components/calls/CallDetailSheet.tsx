'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import {
  PhoneIncoming, PhoneOutgoing, Bot, User, Copy, CheckCheck,
  Play, Pause, Download, Loader2, Mail, FileText, Table2,
  Trash2, Search, ChevronDown,
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
import { DeleteCallDialog } from './DeleteCallDialog'
import type { TranscriptEntry } from '@/types'

const STATUS_BADGE: Record<string, string> = {
  completed:   'border-green-200 bg-green-50 text-green-700',
  failed:      'border-red-200 bg-red-50 text-red-700',
  busy:        'border-amber-200 bg-amber-50 text-amber-700',
  'no-answer': 'border-gray-200 bg-gray-100 text-gray-600',
  'in-progress': 'border-blue-200 bg-blue-50 text-blue-700',
}

function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const audio = new Audio(url)
    audioRef.current = audio
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration))
    audio.addEventListener('timeupdate', () => {
      setCurrent(audio.currentTime)
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0)
    })
    audio.addEventListener('ended', () => setPlaying(false))
    return () => { audio.pause(); audio.src = '' }
  }, [url])

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play(); setPlaying(true) }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audio.currentTime = ratio * duration
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div className="rounded-xl bg-gray-50 border p-4 flex items-center gap-3">
      <button
        onClick={toggle}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div
          onClick={seek}
          className="h-2 w-full rounded-full bg-gray-200 cursor-pointer overflow-hidden"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{fmt(current)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>
      <a href={url} download className="text-muted-foreground hover:text-foreground">
        <Download className="h-4 w-4" />
      </a>
    </div>
  )
}

function TranscriptView({ transcript }: { transcript: TranscriptEntry[] }) {
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
    navigator.clipboard.writeText(text)
    toast.success('Transcript copied')
  }

  function downloadTxt() {
    const text = transcript.map((t) => `[${t.role === 'agent' ? 'Agent' : 'Caller'}] ${t.message}`).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    a.download = 'transcript.txt'
    a.click()
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
        <FileText className="h-8 w-8 mb-2 opacity-40" />
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
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transcript…"
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={copyAll}>
          <Copy className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Copy</span>
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={downloadTxt}>
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Download</span>
        </Button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative max-h-[420px] overflow-y-auto space-y-3 pr-1"
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
                  ? <Bot className="h-3.5 w-3.5 text-purple-600" />
                  : <User className="h-3.5 w-3.5 text-gray-500" />}
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
            onClick={scrollToBottom}
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
      const res = await fetch(`/api/calls/${callId}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      if (res.ok) { setSent(true); toast.success('Sent successfully!') }
      else { toast.error('Integration not connected') }
    })
  }

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', iconColor)} />
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {label}
            {workInProgress && <WorkInProgressBadge />}
          </p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {sent ? (
        <span className="text-xs text-green-600 flex items-center gap-1">
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
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : buttonLabel}
        </Button>
      )}
    </div>
  )
}

interface CallDetailSheetProps {
  callId: string | null
  onClose: () => void
  onDeleted: (id: string) => void
  defaultTab?: string
}

export function CallDetailSheet({ callId, onClose, onDeleted, defaultTab = 'overview' }: CallDetailSheetProps) {
  const { call, isLoading } = useCallDetail(callId)
  const [tab, setTab] = useState(defaultTab)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  // gmail = email-to-owner via Resend (always available); the Google actions
  // require their integration to be connected.
  const [connected, setConnected] = useState<Record<string, boolean>>({
    gmail: true, google_docs: false, google_sheets: false,
  })

  useEffect(() => { setTab(defaultTab) }, [defaultTab, callId])

  useEffect(() => {
    if (!callId) return
    let active = true
    Promise.all(
      ['google_docs', 'google_sheets'].map((t) =>
        fetch(`/api/integrations/${t}`)
          .then((r) => (r.ok ? r.json() : { connected: false }))
          .then((d) => [t, !!d.connected] as const)
          .catch(() => [t, false] as const)
      )
    ).then((entries) => {
      if (active) setConnected((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
    })
    return () => { active = false }
  }, [callId])

  function copyNumber() {
    if (!call?.caller_number) return
    navigator.clipboard.writeText(call.caller_number)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const SENTIMENT_DATA = {
    positive: { emoji: '😊', label: 'Positive', color: 'text-green-600', desc: 'Customer seemed happy and satisfied' },
    neutral:  { emoji: '😐', label: 'Neutral',  color: 'text-gray-700', desc: 'Conversation was balanced' },
    negative: { emoji: '😞', label: 'Negative', color: 'text-red-600',  desc: 'Customer seemed frustrated' },
  }

  return (
    <>
      <Sheet open={!!callId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0 gap-0 overflow-hidden">
          {/* Header */}
          <SheetHeader className="px-5 py-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between pr-6">
              <div>
                <SheetTitle>Call details</SheetTitle>
                <SheetDescription className="font-mono">
                  {call?.caller_number ? formatPhoneNumber(call.caller_number) : 'Loading…'}
                </SheetDescription>
              </div>
              {call && (
                <Badge variant="outline" className={cn('capitalize', STATUS_BADGE[call.status])}>
                  {call.status}
                </Badge>
              )}
            </div>
          </SheetHeader>

          {isLoading || !call ? (
            <div className="p-5 space-y-3 flex-1">
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
                {/* Call info grid */}
                <div className="rounded-xl bg-gray-50 border p-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Direction</p>
                      <p className="flex items-center gap-1.5 font-medium">
                        {call.direction === 'inbound'
                          ? <PhoneIncoming className="h-4 w-4 text-blue-500" />
                          : <PhoneOutgoing className="h-4 w-4 text-purple-500" />}
                        {call.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Duration</p>
                      <p className="font-medium">{formatDuration(call.duration_seconds)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Started</p>
                      <p className="font-medium text-xs">{call.started_at ? formatDate(call.started_at) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Ended</p>
                      <p className="font-medium text-xs">{call.ended_at ? formatDate(call.ended_at) : '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Sentiment */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Sentiment analysis
                  </p>
                  {call.sentiment ? (() => {
                    const s = SENTIMENT_DATA[call.sentiment as keyof typeof SENTIMENT_DATA]
                    return (
                      <div className="flex flex-col items-center py-4 rounded-xl bg-gray-50 border gap-2">
                        <span className="text-4xl">{s.emoji}</span>
                        <p className={cn('text-xl font-bold', s.color)}>{s.label}</p>
                        <p className="text-sm text-muted-foreground">{s.desc}</p>
                      </div>
                    )
                  })() : (
                    <p className="text-sm text-muted-foreground">Analysis pending…</p>
                  )}
                </div>

                {/* Summary */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Call summary
                  </p>
                  {call.summary ? (
                    <div className="rounded-xl bg-purple-50 border border-purple-100 p-4">
                      <p className="flex items-center gap-1.5 text-xs text-purple-600 font-medium mb-2">
                        <Bot className="h-3.5 w-3.5" /> AI Summary
                      </p>
                      <p className="text-sm leading-relaxed">{call.summary}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Summary not available</p>
                  )}
                </div>

                {/* Recording */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Recording
                  </p>
                  {call.recording_url ? (
                    <AudioPlayer url={call.recording_url} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No recording available</p>
                  )}
                </div>
              </TabsContent>

              {/* --- TRANSCRIPT --- */}
              <TabsContent value="transcript" className="flex-1 overflow-y-auto p-5">
                <TranscriptView transcript={call.transcript ?? []} />
              </TabsContent>

              {/* --- ACTIONS --- */}
              <TabsContent value="actions" className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Integrations */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Send to integrations
                  </p>
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
                </div>

                {/* Call management */}
                <div className="border-t pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Call management
                  </p>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2"
                      onClick={copyNumber}
                    >
                      {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copied!' : 'Copy caller number'}
                    </Button>
                  </div>
                </div>

                {/* Danger zone */}
                <div className="border-t pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-3">
                    Danger zone
                  </p>
                  <div className="rounded-xl border border-red-100 p-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <Trash2 className="h-4 w-4 text-red-500" /> Delete this call record
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Permanently removes the call, transcript, and associated data.
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
                </div>
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
