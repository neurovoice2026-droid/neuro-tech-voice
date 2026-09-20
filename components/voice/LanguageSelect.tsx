'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { cn } from '@/lib/utils'
import { languageOption, VOICE_LANGUAGES } from './voice-options'

interface LanguageSelectProps {
  id: string
  value: string
  onChange: (language: string) => void
  disabled?: boolean
  className?: string
}

/** One of the 14 agent languages, with flags. */
export function LanguageSelect({ id, value, onChange, disabled, className }: LanguageSelectProps) {
  const selected = languageOption(value)
  return (
    <Select value={value} onValueChange={(next) => next && onChange(String(next))} disabled={disabled}>
      <SelectTrigger id={id} className={cn('h-9 w-full', className)}>
        <SelectValue>
          {() =>
            selected ? (
              <span className="flex items-center gap-2">
                <FlagIcon country={selected.country} />
                {selected.label}
              </span>
            ) : (
              'Choose a language'
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {VOICE_LANGUAGES.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex items-center gap-2">
              <FlagIcon country={option.country} />
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
