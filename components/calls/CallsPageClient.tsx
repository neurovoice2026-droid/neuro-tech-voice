'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Phone, PhoneIncoming, PhoneOutgoing, Search, Filter,
  Play, Pause, Bot, User, Copy, CheckCheck,
  Mic, FileText, Table2, Mail, ChevronDown, ChevronLeft, ChevronRight,
  Calendar, Timer, TrendingUp, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ─── Demo data ─────────────────────────────────────────────────────────────────
interface DemoCall {
  id: string
  caller_number: string
  direction: 'inbound' | 'outbound'
  status: 'completed' | 'failed' | 'no-answer' | 'busy'
  started_at: string
  duration_seconds: number
  agent_name: string
  sentiment: 'positive' | 'neutral' | 'negative' | null
  summary: string | null
  transcript: { role: 'agent' | 'user'; message: string; time: number }[]
}

const DEMO_CALLS: DemoCall[] = [
  {
    id: '1', caller_number: '+14155552671', direction: 'inbound', status: 'completed',
    started_at: '2026-05-13T09:14:00Z', duration_seconds: 247, agent_name: 'Sarah',
    sentiment: 'positive',
    summary: 'Customer inquired about the Pro plan pricing and features. Expressed interest in upgrading from Free tier. Requested a callback from sales team to discuss enterprise options.',
    transcript: [
      { role: 'agent', message: "Hello! Thank you for calling Neuro Tech. I'm Sarah, your virtual assistant. How can I help you today?", time: 0 },
      { role: 'user',  message: "Hi, I wanted to ask about your Pro plan. What's included?", time: 5 },
      { role: 'agent', message: "Great question! The Pro plan includes 500 minutes per month, up to 3 AI agents, 5 phone numbers, advanced analytics, and priority support. It's $49 per month.", time: 10 },
      { role: 'user',  message: "That sounds good. Can I try it before committing?", time: 18 },
      { role: 'agent', message: "Absolutely! We offer a 14-day free trial with no credit card required. You can cancel anytime during the trial period.", time: 23 },
      { role: 'user',  message: "Perfect. And what about the Enterprise plan? I might need it for my team.", time: 31 },
      { role: 'agent', message: "The Enterprise plan includes unlimited minutes and agents, custom integrations, a dedicated support manager, and SLA guarantees. Would you like me to schedule a call with our sales team?", time: 36 },
      { role: 'user',  message: "Yes please, that would be great!", time: 48 },
      { role: 'agent', message: "Wonderful! I've noted your interest. A member of our sales team will reach out within 24 hours. Is there anything else I can help you with?", time: 52 },
      { role: 'user',  message: "No, that's all. Thank you!", time: 63 },
      { role: 'agent', message: "Thank you for calling Neuro Tech! Have a wonderful day.", time: 66 },
    ],
  },
  {
    id: '2', caller_number: '+14085553847', direction: 'inbound', status: 'completed',
    started_at: '2026-05-13T10:32:00Z', duration_seconds: 183, agent_name: 'Sarah',
    sentiment: 'positive',
    summary: 'Existing customer called to book a dental appointment. Scheduled for May 20th at 2 PM. Patient confirmed contact details and received email confirmation.',
    transcript: [
      { role: 'agent', message: "Good morning! Thank you for calling Bright Smile Dental. I'm Sarah. How can I assist you today?", time: 0 },
      { role: 'user',  message: "Hi, I'd like to schedule a teeth cleaning appointment.", time: 6 },
      { role: 'agent', message: "Of course! I'd be happy to help. Can I get your name and date of birth for our records?", time: 10 },
      { role: 'user',  message: "Sure, it's Maria Johnson, born March 15, 1988.", time: 15 },
      { role: 'agent', message: "Thank you, Maria! I can see your last visit was in November. We have availability on Tuesday May 20th at 2 PM or Thursday May 22nd at 10 AM. Which works better?", time: 20 },
      { role: 'user',  message: "Tuesday at 2 PM would be perfect.", time: 32 },
      { role: 'agent', message: "Excellent! I've booked you for Tuesday, May 20th at 2 PM for a routine cleaning. You'll receive a confirmation email and a reminder the day before.", time: 36 },
      { role: 'user',  message: "Great, thank you so much!", time: 48 },
      { role: 'agent', message: "You're welcome, Maria! See you on May 20th. Have a great day!", time: 51 },
    ],
  },
  {
    id: '3', caller_number: '+13105558234', direction: 'inbound', status: 'completed',
    started_at: '2026-05-13T11:05:00Z', duration_seconds: 312, agent_name: 'Alex',
    sentiment: 'negative',
    summary: 'Customer called with a complaint about a delayed order. Expressed frustration about the 2-week delay. Agent escalated to human support and offered a 15% discount voucher as compensation.',
    transcript: [
      { role: 'agent', message: "Hello! Thank you for reaching out to ShopEasy. I'm Alex. How can I help you today?", time: 0 },
      { role: 'user',  message: "I ordered a product two weeks ago and it still hasn't arrived. This is unacceptable!", time: 5 },
      { role: 'agent', message: "I completely understand your frustration, and I sincerely apologize for this delay. May I have your order number so I can look into this immediately?", time: 12 },
      { role: 'user',  message: "It's SE-2024-78432.", time: 22 },
      { role: 'agent', message: "Thank you. I can see your order. Unfortunately there was a warehouse processing issue that affected several orders. Your package is now with the courier and should arrive within 2 business days.", time: 26 },
      { role: 'user',  message: "Two more days? I needed it last week for an event!", time: 40 },
      { role: 'agent', message: "I completely understand and I'm very sorry this happened. As an apology, I'd like to offer you a 15% discount on your next order, and I'm escalating this to our senior support team to ensure priority handling.", time: 44 },
      { role: 'user',  message: "Fine. But this better not happen again.", time: 58 },
      { role: 'agent', message: "Absolutely. I've flagged this for immediate attention. You'll receive a direct call from our senior team within the hour. Thank you for your patience.", time: 62 },
    ],
  },
  {
    id: '4', caller_number: '+17185557012', direction: 'inbound', status: 'no-answer',
    started_at: '2026-05-13T11:47:00Z', duration_seconds: 0, agent_name: 'Sarah',
    sentiment: null, summary: null, transcript: [],
  },
  {
    id: '5', caller_number: '+13125556789', direction: 'outbound', status: 'completed',
    started_at: '2026-05-13T13:20:00Z', duration_seconds: 156, agent_name: 'Alex',
    sentiment: 'neutral',
    summary: 'Outbound follow-up call for lead qualification. Prospect is interested but not ready to purchase. Requested to be contacted again in 30 days.',
    transcript: [
      { role: 'agent', message: "Hello, may I speak with David Chen? This is Alex calling from Neuro Tech.", time: 0 },
      { role: 'user',  message: "Yes, speaking.", time: 7 },
      { role: 'agent', message: "Hi David! I'm calling to follow up on your interest in our AI phone agent solution. Did you get a chance to review the information we sent?", time: 9 },
      { role: 'user',  message: "Yes I did, it looks interesting. I'm just not sure we're ready for this yet.", time: 18 },
      { role: 'agent', message: "Totally understandable. May I ask what's your main concern — is it the timing, the budget, or something else?", time: 26 },
      { role: 'user',  message: "Mostly timing. We're in the middle of a product launch right now.", time: 35 },
      { role: 'agent', message: "That makes sense. Would it be helpful if I reached back out in about 30 days when things settle down?", time: 41 },
      { role: 'user',  message: "Yes, that would actually work better.", time: 50 },
      { role: 'agent', message: "Perfect! I'll make a note to call you back on June 13th. Good luck with the product launch!", time: 53 },
    ],
  },
  {
    id: '6', caller_number: '+14153001122', direction: 'inbound', status: 'completed',
    started_at: '2026-05-13T14:10:00Z', duration_seconds: 421, agent_name: 'Sarah',
    sentiment: 'positive',
    summary: 'Real estate inquiry about a 3-bedroom property listing. Customer requested viewing on Saturday morning. Agent confirmed appointment and sent property details via email.',
    transcript: [
      { role: 'agent', message: "Good afternoon! Thank you for calling Premier Realty. I'm Sarah. How can I assist you?", time: 0 },
      { role: 'user',  message: "Hi, I saw a listing for a 3-bedroom house on Oak Street. Can I get more details?", time: 5 },
      { role: 'agent', message: "Of course! That's a beautiful property. It's a 3-bedroom, 2-bathroom home, 1,850 sq ft, listed at $685,000. It was built in 2018 and has a modern kitchen and a large backyard.", time: 10 },
      { role: 'user',  message: "Sounds great! Is it still available?", time: 28 },
      { role: 'agent', message: "Yes, it is! In fact, there's been quite a bit of interest. Would you like to schedule a viewing?", time: 33 },
      { role: 'user',  message: "Yes, this Saturday if possible.", time: 40 },
      { role: 'agent', message: "I have Saturday morning at 10 AM or 11:30 AM available. Which works for you?", time: 44 },
      { role: 'user',  message: "10 AM works perfectly.", time: 51 },
      { role: 'agent', message: "Wonderful! I've scheduled your viewing for Saturday at 10 AM. Can I get your email to send the property details and address?", time: 54 },
      { role: 'user',  message: "Sure, it's johnson.mike@gmail.com", time: 64 },
      { role: 'agent', message: "Perfect! You'll receive a confirmation email shortly. Is there anything else you'd like to know about the property?", time: 68 },
      { role: 'user',  message: "What's the neighborhood like?", time: 77 },
      { role: 'agent', message: "It's in a great school district, very family-friendly, and there's a park just two blocks away. The area has excellent walkability and low crime rates.", time: 80 },
      { role: 'user',  message: "Perfect, that's exactly what we're looking for. See you Saturday!", time: 95 },
    ],
  },
  {
    id: '7', caller_number: '+14089994321', direction: 'inbound', status: 'busy',
    started_at: '2026-05-13T15:22:00Z', duration_seconds: 0, agent_name: 'Alex',
    sentiment: null, summary: null, transcript: [],
  },
  {
    id: '8', caller_number: '+17132221567', direction: 'inbound', status: 'completed',
    started_at: '2026-05-12T09:05:00Z', duration_seconds: 198, agent_name: 'Sarah',
    sentiment: 'positive',
    summary: 'Customer inquired about hotel room availability for a weekend stay. Booked a Deluxe King room for 2 nights. Requested early check-in.',
    transcript: [
      { role: 'agent', message: "Good morning! Thank you for calling The Grand Hotel. I'm Sarah, your concierge. How may I help you?", time: 0 },
      { role: 'user',  message: "Hi, do you have rooms available for next weekend, May 23-25?", time: 7 },
      { role: 'agent', message: "Let me check for you! We have our Standard rooms at $189/night and Deluxe King rooms at $249/night, both available for those dates.", time: 12 },
      { role: 'user',  message: "I'll take the Deluxe King. And is early check-in possible?", time: 26 },
      { role: 'agent', message: "Of course! I'll note your early check-in request. We'll do our best to have your room ready by 11 AM, though standard check-in is 3 PM.", time: 32 },
      { role: 'user',  message: "That's fine. Can I book it now?", time: 44 },
      { role: 'agent', message: "Absolutely! I'll need your name and a credit card to secure the reservation. Your total will be $498 for 2 nights.", time: 48 },
    ],
  },
  {
    id: '9', caller_number: '+13109887654', direction: 'inbound', status: 'completed',
    started_at: '2026-05-12T10:45:00Z', duration_seconds: 89, agent_name: 'Alex',
    sentiment: 'neutral',
    summary: 'Quick support call about password reset. Issue resolved in under 2 minutes.',
    transcript: [
      { role: 'agent', message: "Hello! Thank you for calling TechHelp. I'm Alex. What can I help you with today?", time: 0 },
      { role: 'user',  message: "I can't log into my account. I think I forgot my password.", time: 5 },
      { role: 'agent', message: "No problem! I can help you reset it. Can I have your email address associated with the account?", time: 10 },
      { role: 'user',  message: "It's sarah.jones@company.com", time: 17 },
      { role: 'agent', message: "I've sent a password reset link to that email. You should receive it within the next minute.", time: 21 },
      { role: 'user',  message: "Got it! That worked. Thank you.", time: 35 },
      { role: 'agent', message: "You're welcome! Is there anything else I can help with?", time: 38 },
      { role: 'user',  message: "Nope, that's all. Thanks!", time: 42 },
    ],
  },
  {
    id: '10', caller_number: '+18002334567', direction: 'inbound', status: 'no-answer',
    started_at: '2026-05-12T14:33:00Z', duration_seconds: 0, agent_name: 'Sarah',
    sentiment: null, summary: null, transcript: [],
  },
]

const DEMO_STATS = {
  total_calls: 342,
  completed: 287,
  no_answer: 38,
  failed: 17,
  avg_duration: 214,
  total_minutes: 1228,
  month_trend: 12,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function formatNum(n: string) {
  if (n.startsWith('+1') && n.length === 12) return `+1 (${n.slice(2,5)}) ${n.slice(5,8)}-${n.slice(8)}`
  return n
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  'no-answer': 'bg-gray-100 text-gray-500',
  busy: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
}
const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed', 'no-answer': 'No answer', busy: 'Busy', failed: 'Failed',
}
const SENTIMENT_STYLES: Record<string, string> = {
  positive: 'bg-green-50 text-green-700',
  neutral: 'bg-gray-100 text-gray-600',
  negative: 'bg-red-50 text-red-700',
}
const SENTIMENT_EMOJI: Record<string, string> = { positive: '😊', neutral: '😐', negative: '😞' }

// ─── Fake audio player ────────────────────────────────────────────────────────
function FakeAudioPlayer({ durationSeconds }: { durationSeconds: number }) {
  const [playing, setPlaying]   = useState(false)
  const [progress, setProgress] = useState(0)
  const [current, setCurrent]   = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function toggle() {
    if (playing) {
      clearInterval(intervalRef.current!)
      setPlaying(false)
    } else {
      setPlaying(true)
      intervalRef.current = setInterval(() => {
        setCurrent((c) => {
          const next = c + 1
          setProgress((next / durationSeconds) * 100)
          if (next >= durationSeconds) {
            clearInterval(intervalRef.current!)
            setPlaying(false)
            setCurrent(0)
            setProgress(0)
            return 0
          }
          return next
        })
      }, 200)
    }
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-gray-50 p-4">
      <button
        onClick={toggle}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-colors"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-2 w-full rounded-full bg-gray-200 cursor-pointer overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{fmt(current)}</span>
          <span>{fmt(durationSeconds)}</span>
        </div>
      </div>
      <Mic className="h-4 w-4 text-muted-foreground" />
    </div>
  )
}

// ─── Transcript ───────────────────────────────────────────────────────────────
function TranscriptView({ transcript }: { transcript: DemoCall['transcript'] }) {
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)

  function highlight(text: string) {
    if (!search) return <>{text}</>
    const parts = text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return <>{parts.map((p, i) => p.toLowerCase() === search.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 rounded px-0.5">{p}</mark>
      : p
    )}</>
  }

  function copyAll() {
    const text = transcript.map((t) => `${t.role === 'agent' ? 'Agent' : 'Caller'}: ${t.message}`).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (transcript.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">No transcript available for this call</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transcript…" className="pl-8 h-8 text-sm" />
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={copyAll}>
          {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>

      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {transcript.map((msg, i) => {
          const isAgent = msg.role === 'agent'
          return (
            <div key={i} className={cn('flex items-end gap-2', !isAgent && 'flex-row-reverse')}>
              <div className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full', isAgent ? 'bg-purple-100' : 'bg-gray-100')}>
                {isAgent ? <Bot className="h-3.5 w-3.5 text-purple-600" /> : <User className="h-3.5 w-3.5 text-gray-500" />}
              </div>
              <div className={cn('flex max-w-[85%] flex-col gap-1', isAgent ? 'items-start' : 'items-end')}>
                <div className={cn('rounded-xl px-3 py-2 text-sm leading-relaxed', isAgent ? 'bg-purple-50 border border-purple-100 rounded-tl-sm' : 'bg-white border border-gray-200 rounded-tr-sm')}>
                  {highlight(msg.message)}
                </div>
                <span className="px-1 text-[11px] text-muted-foreground">{fmt(msg.time)}</span>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {transcript.length} messages · {transcript.filter(t => t.role === 'agent').length} from agent · {transcript.filter(t => t.role === 'user').length} from caller
      </p>
    </div>
  )
}

// ─── Call detail sheet ────────────────────────────────────────────────────────
function CallDetailSheet({ call, onClose }: { call: DemoCall | null; onClose: () => void }) {
  const [tab, setTab] = useState('overview')
  const [copiedNum, setCopiedNum] = useState(false)
  const [actionSent, setActionSent] = useState<Record<string, boolean>>({})

  useEffect(() => { setTab('overview') }, [call?.id])

  if (!call) return null

  function sendAction(key: string) {
    setTimeout(() => setActionSent((p) => ({ ...p, [key]: true })), 800)
  }

  const sentimentInfo = call.sentiment ? {
    positive: { emoji: '😊', label: 'Positive', color: 'text-green-700', bg: 'bg-green-50', desc: 'Caller seemed happy and satisfied with the interaction.' },
    neutral:  { emoji: '😐', label: 'Neutral',  color: 'text-gray-600', bg: 'bg-gray-50',  desc: 'Conversation was balanced without strong emotional indicators.' },
    negative: { emoji: '😞', label: 'Negative', color: 'text-red-700',  bg: 'bg-red-50',   desc: 'Caller expressed frustration. Consider follow-up.' },
  }[call.sentiment] : null

  return (
    <Sheet open={!!call} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="flex-shrink-0 border-b px-5 py-4">
          <div className="flex items-center justify-between pr-6">
            <div>
              <SheetTitle className="font-mono">{formatNum(call.caller_number)}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{relativeTime(call.started_at)} · Agent: {call.agent_name}</p>
            </div>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_STYLES[call.status])}>
              {STATUS_LABELS[call.status]}
            </span>
          </div>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col overflow-hidden">
          <TabsList variant="line" className="w-full justify-start rounded-none border-b px-5 pt-1 flex-shrink-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="flex-1 space-y-5 overflow-y-auto p-5">
            {/* Info grid */}
            <div className="rounded-xl border bg-gray-50 p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Direction', call.direction === 'inbound' ? '↙ Inbound' : '↗ Outbound'],
                  ['Duration',  fmt(call.duration_seconds)],
                  ['Started',   new Date(call.started_at).toLocaleString()],
                  ['Agent',     call.agent_name],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-0.5 font-medium">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Sentiment */}
            {sentimentInfo && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sentiment</p>
                <div className={cn('flex items-center gap-4 rounded-xl border p-4', sentimentInfo.bg)}>
                  <span className="text-4xl">{sentimentInfo.emoji}</span>
                  <div>
                    <p className={cn('font-bold text-lg', sentimentInfo.color)}>{sentimentInfo.label}</p>
                    <p className="text-sm text-muted-foreground">{sentimentInfo.desc}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Summary */}
            {call.summary && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Summary</p>
                <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-purple-600">
                    <Bot className="h-3.5 w-3.5" /> Generated by AI
                  </p>
                  <p className="text-sm leading-relaxed">{call.summary}</p>
                </div>
              </div>
            )}

            {/* Recording */}
            {call.status === 'completed' && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recording</p>
                <FakeAudioPlayer durationSeconds={call.duration_seconds} />
                <p className="mt-1.5 text-[11px] text-muted-foreground">Demo preview — actual recordings stored in your account</p>
              </div>
            )}
          </TabsContent>

          {/* Transcript */}
          <TabsContent value="transcript" className="flex-1 overflow-y-auto p-5">
            <TranscriptView transcript={call.transcript} />
          </TabsContent>

          {/* Actions */}
          <TabsContent value="actions" className="flex-1 space-y-5 overflow-y-auto p-5">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Send to integrations</p>
              <div className="divide-y rounded-xl border">
                {[
                  { key: 'sheets', icon: Table2,   color: 'text-green-600', label: 'Log to Google Sheets',   desc: 'Add this call to your spreadsheet' },
                  { key: 'docs',   icon: FileText,  color: 'text-blue-600',  label: 'Create Docs report',     desc: 'Generate a formatted call report' },
                  { key: 'gmail',  icon: Mail,      color: 'text-red-500',   label: 'Email summary',          desc: 'Send the AI summary to your inbox' },
                ].map(({ key, icon: Icon, color, label, desc }) => (
                  <div key={key} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-start gap-3">
                      <Icon className={cn('mt-0.5 h-4 w-4 flex-shrink-0', color)} />
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                    {actionSent[key] ? (
                      <span className="flex items-center gap-1 text-xs text-green-600"><CheckCheck className="h-3.5 w-3.5" /> Sent!</span>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => sendAction(key)}>Send</Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Call management</p>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => {
                navigator.clipboard.writeText(call.caller_number)
                setCopiedNum(true)
                setTimeout(() => setCopiedNum(false), 2000)
              }}>
                {copiedNum ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                {copiedNum ? 'Copied!' : 'Copy caller number'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function CallsPageClient() {
  const [calls] = useState(DEMO_CALLS)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedCall, setSelectedCall] = useState<DemoCall | null>(null)
  const [page, setPage]         = useState(1)
  const pageSize = 8

  const filtered = calls.filter((c) => {
    const matchSearch = !search || c.caller_number.includes(search) || c.agent_name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(filtered.length / pageSize)

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Call History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every conversation your AI agent has handled.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { icon: Phone,       bg: 'bg-blue-100',   color: 'text-blue-600',   value: DEMO_STATS.total_calls,   label: 'Total calls',     sub: 'All time' },
          { icon: Calendar,    bg: 'bg-purple-100',  color: 'text-purple-600', value: '87',                    label: 'This month',      sub: `↑ ${DEMO_STATS.month_trend}% vs last month` },
          { icon: Timer,       bg: 'bg-green-100',   color: 'text-green-600',  value: fmt(DEMO_STATS.avg_duration), label: 'Avg duration', sub: 'Per completed call' },
          { icon: TrendingUp,  bg: 'bg-amber-100',   color: 'text-amber-600',  value: `${DEMO_STATS.total_minutes}m`, label: 'Talk time', sub: 'This month' },
        ].map(({ icon: Icon, bg, color, value, label, sub }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className={cn('mb-3 flex h-9 w-9 items-center justify-center rounded-lg', bg)}>
              <Icon className={cn('h-4.5 w-4.5', color)} />
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search calls…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="h-9 pl-9" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? 'all'); setPage(1) }}>
          <SelectTrigger className="h-9 w-40">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="no-answer">No answer</SelectItem>
            <SelectItem value="busy">Busy</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} calls</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Caller</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Direction</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Duration</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Agent</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Sentiment</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Time</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginated.length === 0 ? (
              <tr><td colSpan={8} className="py-16 text-center text-muted-foreground">No calls match your filters</td></tr>
            ) : paginated.map((call) => (
              <tr
                key={call.id}
                onClick={() => setSelectedCall(call)}
                className="cursor-pointer transition-colors hover:bg-muted/40"
              >
                <td className="px-4 py-3 font-mono text-xs font-medium">{formatNum(call.caller_number)}</td>
                <td className="px-4 py-3">
                  {call.direction === 'inbound'
                    ? <span className="flex items-center gap-1 text-blue-600"><PhoneIncoming className="h-3.5 w-3.5" /> In</span>
                    : <span className="flex items-center gap-1 text-purple-600"><PhoneOutgoing className="h-3.5 w-3.5" /> Out</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_STYLES[call.status])}>
                    {STATUS_LABELS[call.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{call.duration_seconds > 0 ? fmt(call.duration_seconds) : '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{call.agent_name}</td>
                <td className="px-4 py-3">
                  {call.sentiment ? (
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', SENTIMENT_STYLES[call.sentiment])}>
                      {SENTIMENT_EMOJI[call.sentiment]} {call.sentiment}
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{relativeTime(call.started_at)}</td>
                <td className="px-4 py-3">
                  <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={(e) => { e.stopPropagation(); setSelectedCall(call) }}>
                    <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail sheet */}
      <CallDetailSheet call={selectedCall} onClose={() => setSelectedCall(null)} />
    </div>
  )
}
