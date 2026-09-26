'use client'

import { Clock, Copy, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  ALWAYS_OPEN_HOURS,
  DEFAULT_WORKING_HOURS,
  WEEKDAYS,
  WEEKDAY_LABELS,
  isAlwaysOpen,
  type Weekday,
  type WorkingHoursErrors,
} from '@/app/api/scheduling/hours'
import type { WorkingHours, WorkingHourSlot } from '@/types'

interface WorkingHoursEditorProps {
  value: WorkingHours
  onChange: (next: WorkingHours) => void
  errors?: WorkingHoursErrors
  /** Keeps ids unique when two editors are on one page. */
  idPrefix: string
  disabled?: boolean
  /** Shows the "Answer 24/7" preset (agent hours); booking hours don't need it. */
  allowAlwaysOpen?: boolean
}

export function WorkingHoursEditor({
  value,
  onChange,
  errors = {},
  idPrefix,
  disabled = false,
  allowAlwaysOpen = true,
}: WorkingHoursEditorProps) {
  const setDay = (day: Weekday, patch: Partial<WorkingHourSlot>) => {
    onChange({ ...value, [day]: { ...value[day], ...patch } })
  }

  const copyMonday = () => {
    const monday = value.monday
    const next = { ...value }
    for (const day of WEEKDAYS) {
      if (day !== 'monday' && next[day]?.enabled) next[day] = { ...next[day], start: monday.start, end: monday.end }
    }
    onChange(next)
  }

  const alwaysOpen = isAlwaysOpen(value)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {allowAlwaysOpen && (
          <Button
            type="button"
            size="sm"
            variant={alwaysOpen ? 'secondary' : 'outline'}
            onClick={() => onChange(structuredClone(ALWAYS_OPEN_HOURS))}
            disabled={disabled}
            aria-pressed={alwaysOpen}
          >
            <Clock aria-hidden="true" />
            Answer 24/7
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(structuredClone(DEFAULT_WORKING_HOURS))}
          disabled={disabled}
        >
          <Sun aria-hidden="true" />
          Weekdays 9:00–18:00
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={copyMonday} disabled={disabled || !value.monday?.enabled}>
          <Copy aria-hidden="true" />
          Copy Monday to open days
        </Button>
      </div>

      <ul className="divide-y rounded-lg border">
        {WEEKDAYS.map((day) => {
          const slot = value[day] ?? DEFAULT_WORKING_HOURS[day]
          const error = errors[day]
          const switchId = `${idPrefix}-${day}-open`
          const errorId = `${idPrefix}-${day}-error`
          return (
            <li key={day} className="px-3 py-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 items-center gap-3 sm:w-40">
                  <Switch
                    id={switchId}
                    checked={slot.enabled}
                    onCheckedChange={(checked) => setDay(day, { enabled: checked })}
                    disabled={disabled}
                    aria-describedby={error ? errorId : undefined}
                  />
                  <label htmlFor={switchId} className="text-sm font-medium">
                    {WEEKDAY_LABELS[day]}
                  </label>
                </div>
                {slot.enabled ? (
                  // Full width on phones: two time inputs don't fit next to the switch indent at 375 px.
                  <div className="flex min-w-0 items-center gap-2">
                    <Input
                      type="time"
                      value={slot.start}
                      onChange={(e) => setDay(day, { start: e.target.value })}
                      disabled={disabled}
                      aria-label={`${WEEKDAY_LABELS[day]} opening time`}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? errorId : undefined}
                      className="h-8 min-w-0 flex-1 sm:w-[7.5rem] sm:flex-none"
                    />
                    <span className="shrink-0 text-xs text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={slot.end}
                      onChange={(e) => setDay(day, { end: e.target.value })}
                      disabled={disabled}
                      aria-label={`${WEEKDAY_LABELS[day]} closing time`}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? errorId : undefined}
                      className="h-8 min-w-0 flex-1 sm:w-[7.5rem] sm:flex-none"
                    />
                  </div>
                ) : (
                  <p className="pl-11 text-sm text-muted-foreground sm:pl-0">Closed</p>
                )}
              </div>
              {error && (
                <p id={errorId} className={cn('mt-1.5 text-xs text-destructive sm:pl-44')} role="alert">
                  {error}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
