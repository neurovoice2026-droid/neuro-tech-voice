import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { LiveDot } from '@/components/shared/LiveDot'
import { cn } from '@/lib/utils'
import { HeroStats } from '@/components/marketing/HeroStats'
import { HeroVisual } from '@/components/marketing/HeroVisual'

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* pt-28/36 reserves room for the sticky marketing nav, added in a later pass */}
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 pb-20 pt-28 text-center sm:px-6 md:pb-28 md:pt-36 lg:px-8">
        {/* Badge */}
        <div className="mb-6 inline-flex animate-in fade-in slide-in-from-bottom-2 items-center gap-2 rounded-full border border-border bg-white/70 px-4 py-1.5 backdrop-blur-md duration-700">
          <LiveDot />
          <span className="text-sm font-medium text-foreground/80">
            Your AI agent is always on
          </span>
        </div>

        {/* Headline */}
        <h1 className="max-w-4xl animate-in fade-in slide-in-from-bottom-4 text-balance text-5xl font-semibold leading-[1.2] tracking-tight duration-700 delay-100 md:text-6xl lg:text-7xl">
          Turn missed calls into{' '}
          <span className="relative inline-block">
            booked
            {/* svg is a replaced element — sizing it via top/bottom/left/right directly
                derives height from the viewBox ratio instead of the insets, so the insets
                live on this wrapper and the svg just fills it. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -left-2 -right-2 -top-3 bottom-0 translate-y-1"
            >
              <svg
                viewBox="0 0 286 73"
                fill="none"
                preserveAspectRatio="none"
                className="h-full w-full text-primary"
              >
                <path
                  d="M142.293 1C106.854 16.8908 6.08202 7.17705 1.23654 43.3756C-2.10604 68.3466 29.5633 73.2652 122.688 71.7518C215.814 70.2384 316.298 70.689 275.761 38.0785C230.14 1.37835 97.0503 24.4575 52.9384 1"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  pathLength="1"
                  className="[stroke-dasharray:1] [stroke-dashoffset:1] motion-reduce:[stroke-dashoffset:0] motion-safe:animate-[draw-underline_1s_ease-out_0.6s_forwards]"
                />
              </svg>
            </span>
          </span>{' '}
          meetings.
        </h1>

        {/* Subtext */}
        <p className="mt-6 max-w-xl animate-in fade-in slide-in-from-bottom-4 text-lg text-muted-foreground duration-700 delay-200">
          Neuro Tech Voice answers, qualifies, and books your customers automatically —
          a natural-sounding AI voice agent, live on your business number in minutes.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex animate-in fade-in slide-in-from-bottom-4 flex-col items-center gap-3 duration-700 delay-300 sm:flex-row">
          <Link
            href="/register"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'purple-glow h-12 rounded-full px-7 text-base'
            )}
          >
            Start free
            <ArrowRight className="h-4 w-4 transition-transform group-hover/button:translate-x-0.5" />
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'h-12 rounded-full px-7 text-base'
            )}
          >
            Sign in
          </Link>
        </div>
        <p className="mt-3 animate-in fade-in duration-700 delay-500 text-xs text-muted-foreground">
          No credit card required · 100 free minutes every month
        </p>

        {/* Stats */}
        <HeroStats />

        {/* Visual */}
        <HeroVisual />
      </div>
    </section>
  )
}
