'use client'

import { useState } from 'react'
import { AlertCircle, Globe, Loader2, MicOff, RotateCw, Search, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { VoiceCard } from '@/components/voice/VoiceCard'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { cn } from '@/lib/utils'
import { useAudioPreview, voicePreviewSource, type AudioPreview } from '@/hooks/useAudioPreview'
import {
  useVoiceCatalog,
  type VoiceCatalog,
  type VoiceCatalogSource,
  type VoiceGenderFilter,
} from '@/hooks/useVoiceCatalog'
import type { VoiceOption } from '@/types'

export interface VoicePickerProps {
  /** The highlighted voice (the pending choice, or the agent's current voice). */
  selectedVoiceId: string | null
  onSelect: (voice: VoiceOption) => void
  /** Agent language: the initial language filter and the language of generated previews. */
  defaultLanguage?: string
  layout: 'onboarding' | 'dashboard'
  /** Blocks selection (e.g. while a save is in flight); previews still work. */
  disabled?: boolean
}

const ALL_LANGUAGES = 'all'

const GENDERS: ReadonlyArray<{ value: VoiceGenderFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
]

const SOURCES: ReadonlyArray<{ value: VoiceCatalogSource; label: string; hint: string }> = [
  {
    value: 'workspace',
    label: 'Recommended & yours',
    hint: 'Recommended voices plus the voices saved or cloned in your workspace.',
  },
  {
    value: 'library',
    label: 'Voice library',
    hint: 'Thousands of community voices. A library voice is added to your workspace when you choose it.',
  },
]

function initialLanguage(defaultLanguage: string | undefined): string {
  const code = defaultLanguage?.toLowerCase().split(/[-_]/)[0]
  return code && AGENT_LANGUAGES.some((l) => l.value === code) ? code : ALL_LANGUAGES
}

function LanguageOption({ value }: { value: string }) {
  if (value === ALL_LANGUAGES) {
    return (
      <span className="flex items-center gap-2">
        <Globe className="size-4 text-muted-foreground" aria-hidden="true" />
        All languages
      </span>
    )
  }
  const lang = AGENT_LANGUAGES.find((l) => l.value === value)
  if (!lang) return <span>{value}</span>
  return (
    <span className="flex items-center gap-2">
      <FlagIcon country={lang.country} />
      {lang.label}
    </span>
  )
}

export function VoicePicker({ selectedVoiceId, onSelect, defaultLanguage, layout, disabled = false }: VoicePickerProps) {
  const [source, setSource] = useState<VoiceCatalogSource>('workspace')
  const [search, setSearch] = useState('')
  const [language, setLanguage] = useState(() => initialLanguage(defaultLanguage))
  const [gender, setGender] = useState<VoiceGenderFilter>('all')

  const filters = { search, language, gender }
  const workspace = useVoiceCatalog({ source: 'workspace', ...filters, enabled: source === 'workspace' })
  const library = useVoiceCatalog({ source: 'library', ...filters, enabled: source === 'library' })
  const active = source === 'workspace' ? workspace : library
  const preview = useAudioPreview()

  // Generated previews speak the agent's language — that is what callers will hear.
  const previewLanguage = defaultLanguage || (language !== ALL_LANGUAGES ? language : null)

  const activeFilters = (language !== ALL_LANGUAGES ? 1 : 0) + (gender !== 'all' ? 1 : 0) + (search.trim() ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setLanguage(ALL_LANGUAGES)
    setGender('all')
  }

  const changeSource = (value: unknown) => {
    const next: VoiceCatalogSource = value === 'library' ? 'library' : 'workspace'
    if (next === source) return
    preview.stop()
    setSource(next)
  }

  const onboarding = layout === 'onboarding'
  const busy = active.isLoading || active.isDebouncing
  const statusText = busy
    ? 'Loading voices…'
    : active.error
      ? 'Could not load voices'
      : `${active.voices.length}${active.hasMore ? '+' : ''} voice${active.voices.length === 1 ? '' : 's'}`

  return (
    <Tabs value={source} onValueChange={changeSource} className="gap-4">
      <div
        className={cn(
          'space-y-3',
          onboarding && 'sticky top-[70px] z-10 -mx-1 rounded-2xl border bg-background/90 p-3 backdrop-blur-md',
        )}
      >
        <TabsList className="w-full sm:w-fit" aria-label="Voice source">
          {SOURCES.map((s) => (
            <TabsTrigger key={s.value} value={s.value} className="px-3">
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search voices by name, accent or style…"
              aria-label="Search voices"
              maxLength={100}
              className={cn('pl-9 pr-9', onboarding ? 'h-10' : 'h-9')}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <Select value={language} onValueChange={(v) => v && setLanguage(v)}>
            <SelectTrigger aria-label="Filter by language" className={cn('w-full sm:w-48', onboarding ? 'h-10' : 'h-9')}>
              <SelectValue>{(value: string) => <LanguageOption value={value} />}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_LANGUAGES}>
                <LanguageOption value={ALL_LANGUAGES} />
              </SelectItem>
              {AGENT_LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  <LanguageOption value={l.value} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div role="group" aria-label="Filter by gender" className="flex gap-1 rounded-lg border bg-muted/50 p-1">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                type="button"
                aria-pressed={gender === g.value}
                onClick={() => setGender(g.value)}
                className={cn(
                  'flex-1 rounded-md px-3 py-1 text-xs font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-none',
                  gender === g.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            {busy && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
            {statusText}
          </p>
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 rounded text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X className="size-3" aria-hidden="true" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {SOURCES.map((s) => (
        <TabsContent key={s.value} value={s.value} className="space-y-3">
          <p className="text-xs text-muted-foreground">{s.hint}</p>
          <VoiceResults
            catalog={s.value === 'workspace' ? workspace : library}
            source={s.value}
            layout={layout}
            selectedVoiceId={selectedVoiceId}
            onSelect={onSelect}
            disabled={disabled}
            preview={preview}
            previewLanguage={previewLanguage}
            hasFilters={activeFilters > 0}
            onClearFilters={clearFilters}
            onBrowseLibrary={() => changeSource('library')}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}

// ─── Results grid ─────────────────────────────────────────────────────────────

interface VoiceResultsProps {
  catalog: VoiceCatalog
  source: VoiceCatalogSource
  layout: VoicePickerProps['layout']
  selectedVoiceId: string | null
  onSelect: (voice: VoiceOption) => void
  disabled: boolean
  preview: AudioPreview
  previewLanguage: string | null
  hasFilters: boolean
  onClearFilters: () => void
  onBrowseLibrary: () => void
}

function VoiceResults({
  catalog,
  source,
  layout,
  selectedVoiceId,
  onSelect,
  disabled,
  preview,
  previewLanguage,
  hasFilters,
  onClearFilters,
  onBrowseLibrary,
}: VoiceResultsProps) {
  const onboarding = layout === 'onboarding'
  const gridClass = onboarding
    ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
    : 'grid grid-cols-1 gap-2 sm:grid-cols-2'

  if (catalog.error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-12 text-center">
        <AlertCircle className="size-8 text-destructive/70" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">We couldn&apos;t load these voices</p>
          <p className="mt-1 text-xs text-muted-foreground">{catalog.error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={catalog.retry} className="gap-1.5">
          <RotateCw aria-hidden="true" /> Try again
        </Button>
      </div>
    )
  }

  if (catalog.isLoading && catalog.voices.length === 0) {
    return (
      <div className={gridClass} aria-busy="true" aria-label="Loading voices">
        {Array.from({ length: onboarding ? 9 : 6 }).map((_, i) => (
          <Skeleton key={i} className={onboarding ? 'h-[180px] rounded-2xl' : 'h-16 rounded-xl'} />
        ))}
      </div>
    )
  }

  if (catalog.voices.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-12 text-center">
        <MicOff className="size-8 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {hasFilters
            ? 'No voices match your filters.'
            : source === 'workspace'
              ? 'No voices in your workspace yet.'
              : 'No voices found in the library.'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
          {source === 'workspace' && (
            <Button variant="outline" size="sm" onClick={onBrowseLibrary}>
              Browse the voice library
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          gridClass,
          !onboarding && 'max-h-[28rem] overflow-y-auto p-0.5 pr-1',
          catalog.isLoading && 'opacity-60 transition-opacity',
        )}
        aria-busy={catalog.isLoading}
      >
        {catalog.voices.map((voice) => (
          <VoiceCard
            key={`${voice.provider}:${voice.voiceId}`}
            voice={voice}
            variant={onboarding ? 'card' : 'compact'}
            selected={selectedVoiceId === voice.voiceId}
            disabled={disabled}
            previewStatus={preview.statusFor(voice.voiceId)}
            onSelect={onSelect}
            onTogglePreview={(v) => preview.toggle(v.voiceId, voicePreviewSource(v, previewLanguage))}
          />
        ))}
      </div>

      {catalog.loadMoreError && (
        <p role="alert" className="text-center text-xs text-destructive">
          {catalog.loadMoreError}
        </p>
      )}

      {catalog.hasMore && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size={onboarding ? 'lg' : 'sm'}
            onClick={catalog.loadMore}
            disabled={catalog.isLoadingMore || catalog.isLoading}
            className="gap-2"
          >
            {catalog.isLoadingMore ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : catalog.loadMoreError ? (
              <RotateCw aria-hidden="true" />
            ) : (
              <Sparkles aria-hidden="true" />
            )}
            {catalog.loadMoreError ? 'Try again' : 'Load more voices'}
          </Button>
        </div>
      )}
    </div>
  )
}
