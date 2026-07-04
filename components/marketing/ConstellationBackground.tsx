import { Mic, Phone, MessageCircle, Sparkles, Waves, CircleCheckBig, Calendar, Bot } from 'lucide-react'

const ICONS = [Mic, Phone, MessageCircle, Sparkles, Waves, CircleCheckBig, Calendar, Bot]
const COUNT = 28

// Deterministic pseudo-random generator (mulberry32) so the "random" layout is
// identical on server and client — Math.random() here would desync SSR/CSR
// and throw a hydration mismatch.
function seededRandom(seed: number) {
  let t = seed + 0x6d2b79f5
  return function next() {
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PARTICLES = Array.from({ length: COUNT }, (_, i) => {
  const rand = seededRandom(i + 1)
  const Icon = ICONS[Math.floor(rand() * ICONS.length)]
  return {
    Icon,
    left: rand() * 96 + 2,
    top: rand() * 96 + 2,
    size: 14 + Math.floor(rand() * 3) * 6,
    baseOpacity: 0.06 + rand() * 0.22,
    duration: 8 + rand() * 4,
    delay: rand() * 8,
    dx: (rand() - 0.5) * 8,
    dy: (rand() - 0.5) * 8,
  }
})

export function ConstellationBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {PARTICLES.map(({ Icon, left, top, size, baseOpacity, duration, delay, dx, dy }, i) => (
        <span
          key={i}
          className="animate-twinkle absolute text-primary"
          style={
            {
              left: `${left}%`,
              top: `${top}%`,
              '--base-opacity': baseOpacity,
              '--twinkle-duration': `${duration}s`,
              '--twinkle-delay': `${delay}s`,
              '--dx': `${dx}px`,
              '--dy': `${dy}px`,
            } as React.CSSProperties
          }
        >
          <Icon size={size} strokeWidth={1.5} />
        </span>
      ))}
    </div>
  )
}
