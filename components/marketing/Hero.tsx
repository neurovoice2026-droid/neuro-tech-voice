import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LiveDot } from '@/components/shared/LiveDot'
import { SplineScene } from '@/components/ui/splite'
import { cn } from '@/lib/utils'

const ROBOT_SCENE_URL = 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode'

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-2 lg:px-8">
        {/* Left: copy */}
        <div className="flex flex-col items-start text-left">
          {/* Badge */}
          <div className="mb-6 inline-flex animate-in fade-in slide-in-from-bottom-2 items-center gap-2 rounded-full border border-border bg-white/70 px-4 py-1.5 backdrop-blur-md duration-700">
            <LiveDot />
            <span className="text-sm font-medium text-foreground/80">
              Your AI agent is always on
            </span>
          </div>

          {/* Headline */}
          <h1 className="max-w-xl animate-in fade-in slide-in-from-bottom-4 text-balance text-4xl font-semibold leading-[1.2] tracking-tight duration-700 delay-100 md:text-5xl lg:text-6xl">
            Your AI agent turns missed calls into{' '}
            <span className="relative inline-block">
              booked
              {/* svg is a replaced element - sizing it via top/bottom/left/right directly
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
          <p className="mt-6 max-w-lg animate-in fade-in slide-in-from-bottom-4 text-lg text-muted-foreground duration-700 delay-200">
            Neuro Tech Voice answers, qualifies, and books your customers automatically
            with a natural-sounding AI voice agent, live on your business number in minutes.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex animate-in fade-in slide-in-from-bottom-4 flex-row items-center gap-3 duration-700 delay-300">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'purple-glow h-12 rounded-full px-5 text-base sm:px-7'
              )}
            >
              Start free
              <ArrowRight className="h-4 w-4 transition-transform group-hover/button:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'h-12 rounded-full px-5 text-base sm:px-7'
              )}
            >
              Sign in
            </Link>
          </div>
          <p className="mt-3 animate-in fade-in duration-700 delay-500 text-xs text-muted-foreground">
            No credit card required · 5 free minutes every month
          </p>
        </div>

        {/* Right: interactive 3D agent */}
        <Card className="relative h-[420px] w-full animate-in fade-in slide-in-from-right-4 overflow-hidden rounded-3xl border-0 bg-neutral-950 duration-700 delay-300 sm:h-[480px] lg:h-[560px]">
          <div aria-hidden="true" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="h-80 w-80 rounded-full bg-primary/40 blur-3xl motion-safe:animate-[float_9s_ease-in-out_infinite]" />
          </div>
          <SplineScene scene={ROBOT_SCENE_URL} className="relative z-10 h-full w-full" />
        </Card>
      </div>
    </section>
  )
}
