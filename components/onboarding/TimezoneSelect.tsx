'use client'

import { useMemo } from 'react'
import { Globe } from 'lucide-react'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { timeZoneGroups, timeZoneOption } from '@/app/onboarding/_lib/timezones'

interface TimezoneSelectProps {
  id: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  describedBy?: string
}

export function TimezoneSelect({ id, value, onChange, invalid, describedBy }: TimezoneSelectProps) {
  // ~420 zones with their offsets (tens of milliseconds on a phone): built once
  // per mount, and again only for a zone the runtime doesn't list.
  const allGroups = useMemo(() => timeZoneGroups(null), [])
  const groups = useMemo(
    () => (!value || allGroups.some((group) => group.zones.some((zone) => zone.id === value)) ? allGroups : timeZoneGroups(value)),
    [allGroups, value]
  )

  return (
    <Select value={value} onValueChange={(next) => typeof next === 'string' && next && onChange(next)}>
      <SelectTrigger
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn('h-11 w-full min-w-0 bg-background px-3')}
      >
        <SelectValue>
          {(current: string) => (
            <span className="flex min-w-0 items-center gap-2">
              <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{current ? timeZoneOption(current).label : 'Select your time zone'}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {groups.map((group) => (
          <SelectGroup key={group.region}>
            <SelectLabel>{group.region}</SelectLabel>
            {group.zones.map((zone) => (
              <SelectItem key={zone.id} value={zone.id}>
                <span className="truncate">{zone.city}</span>
                <span className="text-xs text-muted-foreground">{zone.offset}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
