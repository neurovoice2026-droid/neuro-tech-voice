'use client'

import { useEffect, useState } from 'react'
import { Mic, PhoneIncoming, CalendarCheck2 } from 'lucide-react'
import { LiveDot } from '@/components/shared/LiveDot'

const WAVEFORM_BARS = 9

function useElapsedTime() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function HeroVisual() {
  const elapsed = useElapsedTime()

  return (
    <div className="relative mt-16 h-[26rem] w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-700 sm:h-[30rem] md:h-[34rem]">
      {/* Ambient gradient blobs */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <div className="h-72 w-72 rounded-full bg-primary/20 blur-3xl motion-safe:animate-[float_9s_ease-in-out_infinite]" />
      </div>
      <div
        aria-hidden="true"
        className="absolute left-[18%] top-[62%] h-56 w-56 rounded-full bg-primary/10 blur-3xl motion-safe:animate-[float_11s_ease-in-out_infinite_1s]"
      />

      {/* Main call card */}
      <div className="glass-card absolute left-1/2 top-1/2 w-72 -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 sm:w-80">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Mic className="h-5 w-5" />
          </span>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">Neuro Voice Agent</p>
            <p className="text-xs text-muted-foreground">On your business line</p>
          </div>
        </div>

        <div className="mt-6 flex h-12 items-end justify-center gap-1" aria-hidden="true">
          {Array.from({ length: WAVEFORM_BARS }).map((_, i) => (
            <span
              key={i}
              className="w-1.5 origin-bottom rounded-full bg-primary motion-safe:animate-[waveform_1.1s_ease-in-out_infinite]"
              style={{
                height: `${18 + (i % 4) * 8}px`,
                animationDelay: `${i * 90}ms`,
              }}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 rounded-full bg-muted px-3 py-1.5">
          <LiveDot />
          <span className="text-xs font-medium text-foreground/80">
            Call in progress · {elapsed}
          </span>
        </div>
      </div>

      {/* Floating: incoming call */}
      <div className="glass-card absolute left-2 top-6 flex -rotate-6 items-center gap-2 rounded-2xl px-4 py-3 sm:left-6 sm:top-10">
        <PhoneIncoming className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-foreground/80">Incoming call…</span>
      </div>

      {/* Floating: booking confirmed */}
      <div className="glass-card absolute bottom-4 right-2 flex rotate-6 items-center gap-2 rounded-2xl px-4 py-3 sm:bottom-10 sm:right-6">
        <CalendarCheck2 className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-foreground/80">Booked: Tomorrow, 2:00 PM</span>
      </div>

      {/* Fade into next section */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-background/0 to-background md:h-16"
      />
    </div>
  )
}
