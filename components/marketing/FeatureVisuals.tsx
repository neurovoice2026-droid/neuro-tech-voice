'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Check, CalendarClock, ChevronLeft, ChevronRight, TrendingUp, Play, User, Bot,
} from 'lucide-react'
import { LiveDot } from '@/components/shared/LiveDot'
import { cn } from '@/lib/utils'

// Shared "product screenshot" chrome so each visual reads as a real dashboard
// panel rather than a decorative shape - matches the browser-window mockup
// pattern used for the actual product preview in similar SaaS marketing sites.
function MockupWindow({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-primary/15 bg-white shadow-2xl shadow-primary/10">
      <div className="flex items-center gap-1.5 border-b border-border/70 bg-muted/40 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
        <span className="ml-2 truncate rounded-md bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          {path}
        </span>
      </div>
      <div className="bg-gradient-to-br from-primary/[0.04] to-transparent p-7 sm:p-9">
        {children}
      </div>
    </div>
  )
}

export function AvailabilityVisual() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return (
    <MockupWindow path="app.neurotechvoice.com/agent">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LiveDot />
          <span className="text-sm font-medium text-foreground">Agent online</span>
        </div>
        <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-700">
          ACTIVE
        </span>
      </div>

      <div className="mt-8 flex items-end gap-3">
        <span className="text-6xl font-bold leading-none tracking-tight text-primary">24/7</span>
        <span className="mb-1 text-sm text-muted-foreground">coverage, every week</span>
      </div>

      <div className="mt-8 grid grid-cols-7 gap-2">
        {days.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-medium uppercase text-muted-foreground">{d}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
          </div>
        ))}
      </div>
    </MockupWindow>
  )
}

export function VoiceVisual() {
  return (
    <MockupWindow path="app.neurotechvoice.com/agent/voice">
      <div className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Play className="h-3.5 w-3.5 fill-current" />
        </span>
        <div className="flex h-9 flex-1 items-end gap-[3px]" aria-hidden="true">
          {Array.from({ length: 22 }).map((_, i) => (
            <span
              key={i}
              className="w-1 flex-1 origin-bottom rounded-full bg-primary/60 motion-safe:animate-[waveform_1.4s_ease-in-out_infinite]"
              style={{
                height: `${(28 + Math.abs(Math.sin(i * 1.3)) * 65).toFixed(2)}%`,
                animationDelay: `${i * 55}ms`,
              }}
            />
          ))}
        </div>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">0:12</span>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-end gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <User className="h-3.5 w-3.5" />
          </span>
          <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-foreground">
            Hi, I&apos;d like to book a demo for next week.
          </div>
        </div>
        <div className="flex items-end justify-end gap-2">
          <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            I&apos;d love to help! Let me check our calendar...
          </div>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Bot className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </MockupWindow>
  )
}

export function SchedulingVisual() {
  const cells = Array.from({ length: 35 })
  const bookedIndex = 17

  return (
    <MockupWindow path="app.neurotechvoice.com/calendar">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">July 2026</span>
        <div className="flex items-center gap-1 text-muted-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="text-center text-[10px] font-medium uppercase text-muted-foreground">
            {d}
          </span>
        ))}
        {cells.map((_, i) => (
          <div key={i} className="relative aspect-square">
            <div
              className={cn(
                'flex h-full w-full items-center justify-center rounded-lg text-xs',
                i === bookedIndex
                  ? 'bg-primary font-semibold text-primary-foreground'
                  : 'text-foreground/50'
              )}
            >
              {i + 1}
            </div>
            {i === bookedIndex && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-white ring-2 ring-primary" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <CalendarClock className="h-4.5 w-4.5" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Demo Call booked</p>
          <p className="text-xs text-muted-foreground">Tomorrow, 2:00 PM, confirmed automatically</p>
        </div>
      </div>
    </MockupWindow>
  )
}

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, duration])

  return value
}

export function AnalyticsVisual() {
  const calls = useCountUp(247)
  const sentiment = useCountUp(94)
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const bars = [40, 65, 50, 80, 60, 90, 70]

  return (
    <MockupWindow path="app.neurotechvoice.com/analytics">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Calls this week</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-700">
          <TrendingUp className="h-3 w-3" />
          +12%
        </span>
      </div>

      <div className="mt-6 flex h-28 items-end justify-between gap-2" aria-hidden="true">
        {bars.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-24 w-full items-end rounded-t-md bg-primary/10">
              <div className="w-full rounded-t-md bg-primary" style={{ height: `${h}%` }} />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">{days[i]}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-muted/60 px-4 py-3">
          <p className="text-2xl font-bold text-foreground">{calls}</p>
          <p className="text-xs text-muted-foreground">calls this week</p>
        </div>
        <div className="rounded-2xl bg-muted/60 px-4 py-3">
          <p className="text-2xl font-bold text-foreground">{sentiment}%</p>
          <p className="text-xs text-muted-foreground">positive sentiment</p>
        </div>
      </div>
    </MockupWindow>
  )
}
