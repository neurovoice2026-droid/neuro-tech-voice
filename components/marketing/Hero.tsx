import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { LiveDot } from '@/components/shared/LiveDot'
import { SplineScene } from '@/components/ui/splite'
import { cn } from '@/lib/utils'

const ROBOT_SCENE_URL = 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode'

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Ambient color field the glass panels blur/refract against */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 -translate-x-1/2">
          <div className="h-[28rem] w-[28rem] rounded-full bg-primary/30 blur-3xl motion-safe:animate-[float_11s_ease-in-out_infinite]" />
        </div>
        <div className="absolute right-0 top-1/3 translate-x-1/3">
          <div className="h-[24rem] w-[24rem] rounded-full bg-[hsl(280_65%_70%)]/25 blur-3xl motion-safe:animate-[float_13s_ease-in-out_infinite_1.5s]" />
        </div>
        <div className="absolute bottom-0 left-1/3">
          <div className="h-[22rem] w-[22rem] rounded-full bg-[hsl(250_55%_45%)]/20 blur-3xl motion-safe:animate-[float_10s_ease-in-out_infinite_0.7s]" />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-6 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:gap-8 lg:px-8">
        {/* Left: glass panel with copy */}
        <div className="relative flex animate-in fade-in slide-in-from-bottom-4 flex-col justify-center overflow-hidden rounded-[2rem] border border-white/60 bg-white/40 p-8 text-left shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7),0_20px_50px_-20px_rgba(88,28,135,0.25)] backdrop-blur-2xl duration-700 sm:p-10 lg:p-12">
          {/* Badge */}
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/90 bg-white/80 px-4 py-1.5 shadow-sm">
            <LiveDot />
            <span className="text-sm font-medium text-foreground/80">
              Your AI agent is always on
            </span>
          </div>

          {/* Headline */}
          <h1 className="max-w-xl text-balance text-4xl font-semibold leading-[1.2] tracking-tight md:text-5xl lg:text-6xl">
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
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Neuro Tech Voice answers, qualifies, and books your customers automatically
            with a natural-sounding AI voice agent, live on your business number in minutes.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'purple-glow h-12 rounded-full px-7 text-base shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_12px_28px_-8px_rgba(124,58,237,0.55)]'
              )}
            >
              Start free
              <ArrowRight className="h-4 w-4 transition-transform group-hover/button:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'h-12 rounded-full border-white/70 bg-white/50 px-7 text-base text-foreground shadow-sm backdrop-blur-xl hover:bg-white/70'
              )}
            >
              Sign in
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            No credit card required · 5 free minutes every month
          </p>
        </div>

        {/* Right: glass stage with interactive 3D agent */}
        <div className="relative min-h-[420px] animate-in fade-in slide-in-from-right-4 overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950/85 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_25px_60px_-15px_rgba(88,28,135,0.45)] backdrop-blur-2xl duration-700 delay-150 sm:min-h-[480px] lg:min-h-0">
          <div aria-hidden="true" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="h-80 w-80 rounded-full bg-primary/40 blur-3xl motion-safe:animate-[float_9s_ease-in-out_infinite]" />
          </div>
          <SplineScene scene={ROBOT_SCENE_URL} className="relative z-10 h-full w-full" />
        </div>
      </div>
    </section>
  )
}
