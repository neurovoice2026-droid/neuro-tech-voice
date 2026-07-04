'use client'

import { useEffect, useRef, useState } from 'react'

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

const STATS = [
  { target: 100, prefix: '', suffix: '', label: 'free minutes / mo' },
  { target: 24, prefix: '', suffix: '/7', label: 'call coverage' },
  { target: 5, prefix: '', suffix: '', label: 'native integrations' },
  { target: 10, prefix: '<', suffix: ' min', label: 'to launch your agent' },
] as const

function StatTile({ target, prefix, suffix, label }: (typeof STATS)[number]) {
  const value = useCountUp(target)
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-border bg-white/70 px-4 py-4 shadow-sm backdrop-blur-md">
      <span className="text-xl font-semibold text-primary md:text-2xl">
        {prefix}
        {value}
        {suffix}
      </span>
      <span className="text-center text-[11px] leading-tight text-muted-foreground md:text-xs">
        {label}
      </span>
    </div>
  )
}

export function HeroStats() {
  return (
    <div className="mt-10 grid w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 grid-cols-2 gap-3 duration-700 delay-500 sm:grid-cols-4">
      {STATS.map((stat) => (
        <StatTile key={stat.label} {...stat} />
      ))}
    </div>
  )
}
