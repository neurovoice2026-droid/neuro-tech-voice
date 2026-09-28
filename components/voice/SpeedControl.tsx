'use client'

import { useEffect, useRef } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SPEED_MAX, SPEED_MIN, SPEED_STEP, speedLabel } from './voice-options'

interface SpeedControlProps {
  id: string
  /** null = the voice's natural pace. */
  value: number | null
  onChange: (value: number | null) => void
  /** Fires when the user lets go (pointer up, key up): a good moment to preview. */
  onCommit?: (value: number | null) => void
  disabled?: boolean
  description?: string
  className?: string
}

/** Where 1× sits on the 0.6–1.5 track (not the middle). */
const NATURAL_PERCENT = ((1 - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100

function normalize(value: number): number | null {
  const rounded = Math.round(value * 100) / 100
  return Math.abs(rounded - 1) < 0.001 ? null : rounded
}

// Arrow keys move one step per press; wait until the user settles so a
// preview isn't generated for every intermediate pace.
const KEY_COMMIT_DELAY_MS = 600

/** "Pace": Sonic speed from 0.6× to 1.5×. */
export function SpeedControl({ id, value, onChange, onCommit, disabled, description, className }: SpeedControlProps) {
  const current = value ?? 1
  const percent = ((current - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100
  const keyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (keyTimer.current) clearTimeout(keyTimer.current)
  }, [])

  const commit = (raw: string) => {
    if (keyTimer.current) clearTimeout(keyTimer.current)
    keyTimer.current = null
    onCommit?.(normalize(Number(raw)))
  }
  const commitAfterKeys = (raw: string) => {
    if (!onCommit) return
    if (keyTimer.current) clearTimeout(keyTimer.current)
    keyTimer.current = setTimeout(() => {
      keyTimer.current = null
      onCommit(normalize(Number(raw)))
    }, KEY_COMMIT_DELAY_MS)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          Pace
        </label>
        <div className="flex items-center gap-1">
          <span className="min-w-14 text-right text-sm font-medium tabular-nums text-foreground" aria-hidden="true">
            {speedLabel(value)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled || value === null}
            onClick={() => {
              onChange(null)
              onCommit?.(null)
            }}
            aria-label="Reset pace to natural"
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={SPEED_MIN}
        max={SPEED_MAX}
        step={SPEED_STEP}
        value={current}
        disabled={disabled}
        aria-valuetext={speedLabel(value) === 'Natural' ? 'Natural pace' : `${speedLabel(value)} speed`}
        aria-describedby={description ? `${id}-description` : undefined}
        onChange={(event) => onChange(normalize(Number(event.target.value)))}
        onPointerUp={(event) => commit(event.currentTarget.value)}
        onKeyUp={(event) => {
          if (/^(Arrow|Home|End|Page)/.test(event.key)) commitAfterKeys(event.currentTarget.value)
        }}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${percent}%, var(--muted) ${percent}%, var(--muted) 100%)`,
        }}
      />
      <div className="relative h-4 text-[11px] text-muted-foreground" aria-hidden="true">
        <span className="absolute left-0">Slower</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${NATURAL_PERCENT}%` }}>
          Natural
        </span>
        <span className="absolute right-0">Faster</span>
      </div>
      {description && (
        <p id={`${id}-description`} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}
