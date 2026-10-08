'use client'

import { useId, useSyncExternalStore } from 'react'
import { ThinkingOrb, type OrbState } from 'thinking-orbs'
import { cn } from '@/lib/utils'

export type { OrbState }

/** Surface the orb is painted on. 'dark' = light dots (ink buttons, .app-cover). Never 'auto'. */
export type OrbSurface = 'light' | 'dark'

/** Ink by default; 'brand' tints a live-voice orb on a light surface (purple policy #9). */
export type OrbTone = 'ink' | 'brand'

const BRAND_TINT = '#6d28d9'

function tint(tone: OrbTone, surface: OrbSurface) {
  // A lilac tint goes muddy on the dark cover, so the brand tint is light-surface only.
  return tone === 'brand' && surface === 'light' ? BRAND_TINT : undefined
}

type OrbPx = 64 | 32 | 20

/**
 * Rings of the static stand-in, per orb size: [rx, ry, dots, dot diameter, opacity], in CSS px.
 * A dotted globe (rim, equator, meridian) for the block sizes; the rim alone at 20 px.
 */
const STAND_IN_RINGS: Record<OrbPx, ReadonlyArray<readonly [number, number, number, number, number]>> = {
  64: [[23, 23, 44, 1.7, 1], [23, 8, 30, 1.4, 0.45], [9, 23, 30, 1.4, 0.45]],
  32: [[11.5, 11.5, 26, 1.3, 1], [11.5, 4, 16, 1.1, 0.45], [4.5, 11.5, 16, 1.1, 0.45]],
  20: [[7, 7, 14, 1.5, 1]],
}

const subscribeNever = () => () => {}

/**
 * false in the server HTML and while React hydrates it, true for every other render. The orb's
 * canvas only paints from an effect, so HTML that is not hydrated yet — or never is, like a
 * streamed loading.tsx fallback that is replaced before hydration reaches it — shows a blank
 * canvas; the stand-in fills that gap and is dropped by the re-render right after hydration.
 * Orbs mounted on the client (navigations, button spinners) never render it.
 */
function useServerHtml() {
  return !useSyncExternalStore(subscribeNever, () => true, () => false)
}

/**
 * Static first frame of the orb, in the server HTML only: dots on a sphere, same box and ink as
 * the canvas over it (absolute, so swapping it out never moves anything). Turns slowly unless
 * reduced motion is requested.
 */
function OrbStandIn({ size, surface, tone }: { size: OrbPx; surface: OrbSurface; tone: OrbTone }) {
  const gradientId = `orb-ink-${useId().replace(/[^\w-]/g, '')}`
  const ink = tint(tone, surface) ?? (surface === 'dark' ? '#ffffff' : '#000000')
  const c = size / 2
  return (
    <svg
      data-slot="orb-stand-in"
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      stroke={`url(#${gradientId})`}
      strokeLinecap="round"
      // A zero-length dash per unit of pathLength = that many evenly spaced round dots.
      strokeDasharray="0 1"
      className="pointer-events-none absolute inset-0 motion-safe:animate-spin"
      // Inline so a parent's [&_svg] size rule (buttons, menu items) cannot resize it.
      style={{ width: size, height: size, animationDuration: '8s' }}
    >
      <defs>
        {/* Lit from the top left, like the canvas's near/far shading. */}
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={ink} stopOpacity={1} />
          <stop offset="1" stopColor={ink} stopOpacity={0.4} />
        </linearGradient>
      </defs>
      {STAND_IN_RINGS[size].map(([rx, ry, dots, dot, opacity]) => (
        <ellipse
          key={`${rx}-${ry}`}
          cx={c}
          cy={c}
          rx={rx}
          ry={ry}
          pathLength={dots}
          strokeWidth={dot}
          opacity={opacity}
        />
      ))}
    </svg>
  )
}

interface OrbLoaderProps {
  /** What the system is doing (see the state mapping in FOUNDATION.md). */
  state?: OrbState
  /** Visible label under/next to the orb; also the status text for screen readers. */
  label?: React.ReactNode
  /** Render the label for screen readers only (the orb alone is shown). */
  hideLabel?: boolean
  /** Optional second line (e.g. "You can leave this page"). */
  description?: React.ReactNode
  /** 64 for page/section loaders, 32 for compact card bodies and rows. */
  size?: 64 | 32
  /** Surface the orb sits on. 'dark' for .app-cover / ink. Never 'auto'. */
  surface?: OrbSurface
  tone?: OrbTone
  /** 'stack' = orb above text, centred (pages, sections). 'row' = orb left of text (rows, card headers). */
  layout?: 'stack' | 'row'
  /** Delay before it fades in, so fast loads do not flash. Default 150 ms; 0 for user-initiated work. */
  delayMs?: number
  /** Use it to reserve the height of the content being loaded (e.g. "min-h-[220px]"). */
  className?: string
}

/** Block loader: a labelled thinking orb sized to the region it replaces (role="status"). */
export function OrbLoader({
  state = 'breathing',
  label,
  hideLabel = false,
  description,
  size = 64,
  surface = 'light',
  tone = 'ink',
  layout = 'stack',
  delayMs = 150,
  className,
}: OrbLoaderProps) {
  const showText = !hideLabel && Boolean(label || description)
  const serverHtml = useServerHtml()
  return (
    <div
      role="status"
      aria-live="polite"
      data-slot="orb-loader"
      className={cn(
        'flex animate-in fade-in-0 duration-300',
        layout === 'stack'
          ? 'flex-col items-center justify-center gap-3 text-center'
          : 'flex-row items-center gap-3',
        surface === 'dark' ? 'text-[#dedce0]/80' : 'text-muted-foreground',
        className
      )}
      // Inline so it beats the animate-in shorthand; 'both' keeps it invisible during the delay.
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: 'both' }}
    >
      <span className="relative block shrink-0" style={{ width: size, height: size }}>
        <ThinkingOrb state={state} size={size} theme={surface} color={tint(tone, surface)} aria-hidden />
        {serverHtml && <OrbStandIn size={size} surface={surface} tone={tone} />}
      </span>
      {showText ? (
        <div className={layout === 'stack' ? 'space-y-0.5' : 'min-w-0 space-y-0.5'}>
          {label && (
            <p
              className={cn(
                'text-[13px] leading-[19px]',
                surface === 'dark' ? 'text-[#dedce0]' : 'text-foreground'
              )}
            >
              {label}
            </p>
          )}
          {description && <p className="text-xs leading-4">{description}</p>}
        </div>
      ) : (
        <span className="sr-only">{label || 'Loading…'}</span>
      )}
    </div>
  )
}

interface OrbInlineProps {
  state?: OrbState
  /** 'dark' inside ink buttons and on .app-cover. */
  surface?: OrbSurface
  tone?: OrbTone
  /** Screen-reader text when the orb is the only indicator (e.g. a stat value). Omit inside a labelled button. */
  label?: string
  className?: string
}

/** 20 px orb for buttons, chips, table cells and inline status text. */
export function OrbInline({ state = 'working', surface = 'light', tone = 'ink', label, className }: OrbInlineProps) {
  const serverHtml = useServerHtml()
  return (
    <span
      data-slot="orb-inline"
      className={cn('relative inline-flex size-5 shrink-0 items-center justify-center align-middle', className)}
      {...(label ? { role: 'status' } : { 'aria-hidden': true })}
    >
      <ThinkingOrb state={state} size={20} theme={surface} color={tint(tone, surface)} aria-hidden />
      {serverHtml && <OrbStandIn size={20} surface={surface} tone={tone} />}
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}
