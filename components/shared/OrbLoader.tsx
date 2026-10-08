'use client'

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
      <ThinkingOrb
        state={state}
        size={size}
        theme={surface}
        color={tint(tone, surface)}
        aria-hidden
        className="shrink-0"
      />
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
  return (
    <span
      data-slot="orb-inline"
      className={cn('inline-flex size-5 shrink-0 items-center justify-center align-middle', className)}
      {...(label ? { role: 'status' } : { 'aria-hidden': true })}
    >
      <ThinkingOrb state={state} size={20} theme={surface} color={tint(tone, surface)} aria-hidden />
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}
