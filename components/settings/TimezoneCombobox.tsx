'use client'

import { useMemo } from 'react'
import { Combobox } from '@base-ui/react/combobox'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supportedTimeZones, timeZoneOffsetLabel } from '@/app/api/settings/timezone'

interface ZoneOption {
  value: string
  label: string
  offset: string
  /** Lower-case text the search matches: "europe bucharest gmt+03:00". */
  search: string
}

function buildOptions(current: string): ZoneOption[] {
  const now = new Date()
  const zones = supportedTimeZones()
  if (current && !zones.includes(current)) zones.unshift(current)
  return zones.map((zone) => {
    const offset = timeZoneOffsetLabel(zone, now)
    const label = zone.replace(/_/g, ' ')
    return { value: zone, label, offset, search: `${label} ${offset}`.toLowerCase().replace(/\//g, ' ') }
  })
}

interface TimezoneComboboxProps {
  id: string
  value: string
  onChange: (zone: string) => void
  disabled?: boolean
  describedBy?: string
}

/** Searchable IANA time zone picker ("Bucharest", "new york", "GMT+2" all find a match). */
export function TimezoneCombobox({ id, value, onChange, disabled, describedBy }: TimezoneComboboxProps) {
  const options = useMemo(() => buildOptions(value), [value])
  const selected = options.find((o) => o.value === value) ?? null

  return (
    <Combobox.Root<ZoneOption>
      items={options}
      value={selected}
      onValueChange={(option) => {
        if (option) onChange(option.value)
      }}
      itemToStringLabel={(option) => option.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      filter={(option, query) => {
        const tokens = query.toLowerCase().replace(/[_/]/g, ' ').split(/\s+/).filter(Boolean)
        return tokens.every((token) => option.search.includes(token))
      }}
      limit={80}
      disabled={disabled}
    >
      <div className="relative w-full sm:max-w-sm">
        <Combobox.Input
          id={id}
          placeholder="Search for a city or region"
          aria-describedby={describedBy}
          className="h-9 w-full rounded-lg border border-input bg-transparent pr-9 pl-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
        />
        <Combobox.Trigger
          aria-label="Show time zones"
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground outline-none"
        >
          <ChevronDownIcon className="size-4" aria-hidden="true" />
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-50 outline-none">
          <Combobox.Popup className="max-h-[min(var(--available-height),20rem)] w-[var(--anchor-width)] min-w-[16rem] overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <Combobox.Empty className="px-2 py-1.5 text-sm text-muted-foreground">No time zone matches that search.</Combobox.Empty>
            <Combobox.List>
              {(option: ZoneOption) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className={cn(
                    'flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none',
                    'data-highlighted:bg-accent data-highlighted:text-accent-foreground'
                  )}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    <Combobox.ItemIndicator>
                      <CheckIcon className="size-4" aria-hidden="true" />
                    </Combobox.ItemIndicator>
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{option.offset}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
