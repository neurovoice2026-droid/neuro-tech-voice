'use client'

import { useId, useRef } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TRIGGER_TYPES, type TriggerType } from '@/lib/workflows/types'
import { cn } from '@/lib/utils'
import { TRIGGER_META } from './meta'

interface TriggerPickerProps {
  value: TriggerType | null
  keyword: string
  keywordError?: string
  onChange: (trigger: TriggerType) => void
  onKeywordChange: (keyword: string) => void
}

export function TriggerPicker({ value, keyword, keywordError, onChange, onKeywordChange }: TriggerPickerProps) {
  const keywordId = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  // Arrow keys move between options, like a native radio group.
  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const delta = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = (index + delta + TRIGGER_TYPES.length) % TRIGGER_TYPES.length
    onChange(TRIGGER_TYPES[next])
    refs.current[next]?.focus()
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">What should start this workflow?</p>
      <div role="radiogroup" aria-label="When the workflow runs" className="grid gap-2 sm:grid-cols-2">
        {TRIGGER_TYPES.map((type, index) => {
          const meta = TRIGGER_META[type]
          const Icon = meta.icon
          const selected = value === type
          const focusable = value ? selected : index === 0
          return (
            <button
              key={type}
              ref={(el) => {
                refs.current[index] = el
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={focusable ? 0 : -1}
              onClick={() => onChange(type)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'flex items-start gap-3 rounded-xl border-2 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'border-purple-500 bg-purple-50/70' : 'border-border hover:border-purple-200 hover:bg-muted/40'
              )}
            >
              <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', meta.tone)}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{meta.label}</span>
                <span className="block text-xs leading-relaxed text-muted-foreground">{meta.description}</span>
              </span>
              {selected ? <CheckCircle2 className="size-4 shrink-0 text-purple-600" aria-hidden="true" /> : null}
            </button>
          )
        })}
      </div>

      {value === 'keyword_detected' ? (
        <div className="space-y-1.5 rounded-xl border bg-muted/20 p-3">
          <Label htmlFor={keywordId} className="text-xs font-medium">Words or phrases to listen for</Label>
          <Input
            id={keywordId}
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder="emergency, cancel my appointment, refund"
            aria-invalid={keywordError ? true : undefined}
            aria-describedby={`${keywordId}-help`}
            className="text-sm"
          />
          {keywordError ? (
            <p id={`${keywordId}-help`} className="text-[11px] text-destructive">{keywordError}</p>
          ) : (
            <p id={`${keywordId}-help`} className="text-[11px] leading-relaxed text-muted-foreground">
              Separate several with commas. We match whole words, ignore capital letters and accents you leave out, and listen to both
              the caller and the agent, so pick words your callers use.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
