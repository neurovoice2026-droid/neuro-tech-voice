'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock, Mic, CalendarPlus, CalendarClock, ChartColumn, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const CARD = 'rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/5 to-transparent p-8 shadow-lg shadow-primary/5 sm:p-10'
const EYEBROW = 'inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary'

export function AvailabilityVisual() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return (
    <div className={CARD}>
      <div className={EYEBROW}>
        <Clock className="h-3.5 w-3.5" />
        ALWAYS ON
      </div>
      <div className="mt-8">
        <span className="text-6xl font-bold tracking-tight text-primary">24/7</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Every hour, every day, no exceptions</p>
      <div className="mt-8 flex gap-2">
        {days.map((d, i) => (
          <div
            key={i}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground motion-safe:animate-pulse"
            style={{ animationDelay: `${i * 150}ms`, animationDuration: '2.4s' }}
          >
            {d}
          </div>
        ))}
      </div>
    </div>
  )
}

export function VoiceVisual() {
  return (
    <div className={CARD}>
      <div className={EYEBROW}>
        <Mic className="h-3.5 w-3.5" />
        SOUNDS HUMAN
      </div>
      <div className="mt-8 flex h-16 items-end justify-center gap-1.5" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="w-2 origin-bottom rounded-full bg-primary motion-safe:animate-[waveform_1.2s_ease-in-out_infinite]"
            style={{ height: `${20 + (i % 5) * 10}px`, animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
      <div className="mt-8 space-y-2">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-foreground">
          Hi, I&apos;d like to book a demo for next week.
        </div>
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          I&apos;d love to help! Let me check our calendar...
        </div>
      </div>
    </div>
  )
}

export function SchedulingVisual() {
  const cells = Array.from({ length: 28 })
  const bookedIndex = 16
  return (
    <div className={CARD}>
      <div className={EYEBROW}>
        <CalendarPlus className="h-3.5 w-3.5" />
        AUTOMATIC BOOKING
      </div>
      <div className="mt-8 grid grid-cols-7 gap-1.5">
        {cells.map((_, i) => (
          <div
            key={i}
            className={cn(
              'relative aspect-square rounded-md',
              i === bookedIndex ? 'bg-primary' : 'bg-primary/10'
            )}
          >
            {i === bookedIndex && (
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-primary shadow">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <CalendarClock className="h-4.5 w-4.5" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Demo Call</p>
          <p className="text-xs text-muted-foreground">Tomorrow, 2:00 PM · Confirmed</p>
        </div>
      </div>
    </div>
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
  const bars = [40, 65, 50, 80, 60, 90, 70]

  return (
    <div className={CARD}>
      <div className={EYEBROW}>
        <ChartColumn className="h-3.5 w-3.5" />
        FULL VISIBILITY
      </div>
      <div className="mt-8 flex h-24 items-end justify-between gap-2" aria-hidden="true">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-md bg-primary/70" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-muted px-4 py-3">
          <p className="text-2xl font-bold text-foreground">{calls}</p>
          <p className="text-xs text-muted-foreground">calls this week</p>
        </div>
        <div className="rounded-2xl bg-muted px-4 py-3">
          <p className="text-2xl font-bold text-foreground">{sentiment}%</p>
          <p className="text-xs text-muted-foreground">positive sentiment</p>
        </div>
      </div>
    </div>
  )
}
