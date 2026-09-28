'use client'

import { Globe, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { cn } from '@/lib/utils'
import type { VoiceQuery } from '@/hooks/useVoices'
import { GENDER_OPTIONS, VOICE_LANGUAGES, languageOption, type VoiceGender } from './voice-options'

export interface AccentChip {
  id: string
  label: string
  count: number
}

interface VoiceFiltersProps {
  query: VoiceQuery
  onChange: (patch: Partial<VoiceQuery>) => void
  accentChips: AccentChip[]
  idPrefix: string
  compact?: boolean
}

const ALL = 'all'

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

export function hasActiveFilters(query: VoiceQuery, defaultLanguage: string | null): boolean {
  return Boolean(query.q.trim() || query.gender || query.accent || query.language !== defaultLanguage || !query.native)
}

/** Search, language (with flags), gender, native-speaker switch and accent chips. */
export function VoiceFilters({ query, onChange, accentChips, idPrefix, compact = false }: VoiceFiltersProps) {
  const language = languageOption(query.language)

  return (
    <div className="space-y-3">
      <div className={cn('flex flex-col gap-2', !compact && '@2xl/voice-picker:flex-row @2xl/voice-picker:items-center')}>
        <div className="relative min-w-0 flex-1">
          <label htmlFor={`${idPrefix}-search`} className="sr-only">
            Search voices
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={`${idPrefix}-search`}
            type="search"
            value={query.q}
            onChange={(event) => onChange({ q: event.target.value })}
            placeholder="Search voices, e.g. calm"
            className="h-9 pr-8 pl-8"
            maxLength={100}
            autoComplete="off"
          />
          {query.q && (
            <button
              type="button"
              onClick={() => onChange({ q: '' })}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2 @sm/voice-picker:flex-row @sm/voice-picker:items-center">
          <Select
            value={query.language ?? ALL}
            onValueChange={(value) => onChange({ language: value === ALL || !value ? null : String(value), accent: null })}
          >
            <SelectTrigger className="h-9 w-full @sm/voice-picker:w-52" aria-label="Language">
              <SelectValue>
                {() =>
                  language ? (
                    <span className="flex items-center gap-2">
                      <FlagIcon country={language.country} />
                      {language.label}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Globe className="size-4 text-muted-foreground" aria-hidden="true" />
                      All languages
                    </span>
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>
                <span className="flex items-center gap-2">
                  <Globe className="size-4 text-muted-foreground" aria-hidden="true" />
                  All languages
                </span>
              </SelectItem>
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

          <div role="group" aria-label="Gender" className="flex rounded-lg border bg-muted/50 p-0.5">
            {[{ value: null, label: 'All' }, ...GENDER_OPTIONS].map((option) => {
              const active = query.gender === option.value
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ gender: option.value as VoiceGender | null })}
                  className={cn(
                    'flex-1 rounded-md px-2.5 py-2 text-xs font-medium sm:py-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 @sm/voice-picker:flex-none',
                    active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {(query.language || accentChips.length > 1 || query.accent) && (
        <div className="flex flex-col gap-2 @md/voice-picker:flex-row @md/voice-picker:items-center">
          {query.language && (
            <label htmlFor={`${idPrefix}-native`} className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Switch
                id={`${idPrefix}-native`}
                size="sm"
                checked={query.native}
                onCheckedChange={(checked) => onChange({ native: checked, accent: null })}
              />
              Native speakers only
            </label>
          )}
          {(accentChips.length > 1 || query.accent) && (
            <div
              role="group"
              aria-label="Accent"
              className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"
            >
              <Chip active={!query.accent} onClick={() => onChange({ accent: null })}>
                All accents
              </Chip>
              {accentChips.map((chip) => (
                <Chip key={chip.id} active={query.accent === chip.id} onClick={() => onChange({ accent: query.accent === chip.id ? null : chip.id })}>
                  {chip.label}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
