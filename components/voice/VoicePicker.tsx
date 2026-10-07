'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Globe, Loader2, MicOff, RotateCw, Search, Sparkles, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { VoiceCard } from '@/components/voice/VoiceCard'
import { VoiceDesignDialog } from '@/components/voice/VoiceDesignDialog'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { cn } from '@/lib/utils'
import { useAudioPreview, voicePreviewSource, type AudioPreview } from '@/hooks/useAudioPreview'
import {
  isAbortError,
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
  /**
   * Offers "Design a voice" (Voice Design) when given. `unavailableReason`
   * disables it with an explanation (plan, custom-voice limit).
   */
  design?: { onSaved: (voice: VoiceOption) => void; unavailableReason?: string | null }
}

const ALL_LANGUAGES = 'all'
const ALL = 'all'

const GENDERS: ReadonlyArray<{ value: VoiceGenderFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'neutral', label: 'Neutral' },
]

const AGES: Record<string, string> = { [ALL]: 'Any age', young: 'Young', middle_aged: 'Middle-aged', old: 'Older' }
const SORTS: Record<string, string> = { cloned_by_count: 'Most used', trending: 'Trending', created_date: 'Newest' }

const SOURCES: ReadonlyArray<{ value: VoiceCatalogSource; label: string; hint: string }> = [
  {
    value: 'workspace',
    label: 'Recommended & yours',
    hint: 'Voices we recommend for your language, plus the voices saved, cloned or designed in your workspace.',
  },
  {
    value: 'library',
    label: 'Voice library',
    hint: 'Thousands of community voices. A library voice is added to your workspace when you choose it.',
  },
]

/** Library accents for one language (GET /api/voices/accents); empty while loading or unavailable. */
function useAccents(language: string, enabled: boolean): { accents: Array<{ value: string; label: string }>; unavailable: boolean } {
  const [state, setState] = useState<{ key: string | null; accents: Array<{ value: string; label: string }>; unavailable: boolean }>({
    key: null,
    accents: [],
    unavailable: false,
  })
  useEffect(() => {
    if (!enabled || language === ALL_LANGUAGES || state.key === language) return
    const controller = new AbortController()
    fetch(`/api/voices/accents?language=${encodeURIComponent(language)}`, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`accents ${res.status}`)
        const data = (await res.json()) as { accents?: Array<{ value: string; label: string }> }
        setState({ key: language, accents: Array.isArray(data.accents) ? data.accents : [], unavailable: false })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) return
        // The accent filter is optional: hide it rather than block the picker.
        setState({ key: language, accents: [], unavailable: true })
      })
    return () => controller.abort()
  }, [enabled, language, state.key])
  return state.key === language ? { accents: state.accents, unavailable: state.unavailable } : { accents: [], unavailable: false }
}

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

export function VoicePicker({ selectedVoiceId, onSelect, defaultLanguage, layout, disabled = false, design }: VoicePickerProps) {
  const [source, setSource] = useState<VoiceCatalogSource>('workspace')
  const [search, setSearch] = useState('')
  const [language, setLanguageState] = useState(() => initialLanguage(defaultLanguage))
  const [gender, setGender] = useState<VoiceGenderFilter>('all')
  // Library-only filters. Phone conversation voices are the default use case.
  const [phoneVoicesOnly, setPhoneVoicesOnly] = useState(true)
  const [accent, setAccent] = useState(ALL)
  const [age, setAge] = useState(ALL)
  const [studioQuality, setStudioQuality] = useState(false)
  const [sort, setSort] = useState('cloned_by_count')
  const [designOpen, setDesignOpen] = useState(false)

  // An accent belongs to one language.
  const setLanguage = (value: string) => {
    setLanguageState(value)
    setAccent(ALL)
  }

  const filters = { search, language, gender }
  const libraryFilters = { useCase: phoneVoicesOnly ? ('conversational' as const) : ('all' as const), accent, age, highQuality: studioQuality, sort }
  const workspace = useVoiceCatalog({ source: 'workspace', ...filters, enabled: source === 'workspace' })
  const library = useVoiceCatalog({ source: 'library', ...filters, library: libraryFilters, enabled: source === 'library' })
  const active = source === 'workspace' ? workspace : library
  const preview = useAudioPreview()
  const accentOptions = useAccents(language, source === 'library')

  // Generated previews speak the agent's language — that is what callers will hear.
  const previewLanguage = defaultLanguage || (language !== ALL_LANGUAGES ? language : null)

  const libraryFilterCount =
    source === 'library' ? (!phoneVoicesOnly ? 1 : 0) + (accent !== ALL ? 1 : 0) + (age !== ALL ? 1 : 0) + (studioQuality ? 1 : 0) : 0
  const activeFilters = (language !== ALL_LANGUAGES ? 1 : 0) + (gender !== 'all' ? 1 : 0) + (search.trim() ? 1 : 0) + libraryFilterCount
  const clearFilters = () => {
    setSearch('')
    setLanguage(ALL_LANGUAGES)
    setGender('all')
    setPhoneVoicesOnly(true)
    setAge(ALL)
    setStudioQuality(false)
  }
  const accentItems: Record<string, string> = { [ALL]: 'Any accent', ...Object.fromEntries(accentOptions.accents.map((a) => [a.value, a.label])) }
  // Only the language narrows the list: an empty "Recommended & yours" then
  // means no curated voice for it yet (default voices are retiring), not a
  // filter to clear. The library has voices for every language.
  const languageLabel = language !== ALL_LANGUAGES ? (AGENT_LANGUAGES.find((l) => l.value === language)?.label ?? null) : null
  const onlyLanguageFilter = !!languageLabel && !search.trim() && gender === 'all'

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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="w-full sm:w-fit" aria-label="Voice source">
            {SOURCES.map((s) => (
              <TabsTrigger key={s.value} value={s.value} className="px-3">
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {design && (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDesignOpen(true)}
                disabled={!!design.unavailableReason}
                aria-describedby={design.unavailableReason ? 'voice-design-unavailable' : undefined}
                className="gap-1.5"
              >
                <Wand2 aria-hidden="true" /> Design a voice
              </Button>
              {design.unavailableReason && (
                <p id="voice-design-unavailable" className="text-[11px] text-muted-foreground">
                  {design.unavailableReason}
                </p>
              )}
            </div>
          )}
        </div>

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

        {source === 'library' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" role="group" aria-label="Voice library filters">
            <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
              <Switch id="voice-filter-phone" size="sm" checked={phoneVoicesOnly} onCheckedChange={(v) => setPhoneVoicesOnly(v)} />
              <Label htmlFor="voice-filter-phone" className="cursor-pointer text-xs font-normal">
                Phone conversation voices
              </Label>
            </div>
            {language !== ALL_LANGUAGES && !accentOptions.unavailable && accentOptions.accents.length > 0 && (
              <Select items={accentItems} value={accent} onValueChange={(v) => typeof v === 'string' && setAccent(v)}>
                <SelectTrigger aria-label="Filter by accent" className="h-9 w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(accentItems).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select items={AGES} value={age} onValueChange={(v) => typeof v === 'string' && setAge(v)}>
              <SelectTrigger aria-label="Filter by age" className="h-9 w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AGES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
              <Switch id="voice-filter-studio" size="sm" checked={studioQuality} onCheckedChange={(v) => setStudioQuality(v)} />
              <Label htmlFor="voice-filter-studio" className="cursor-pointer text-xs font-normal">
                Studio quality
              </Label>
            </div>
            <Select items={SORTS} value={sort} onValueChange={(v) => typeof v === 'string' && setSort(v)}>
              <SelectTrigger aria-label="Sort voices" className="h-9 w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SORTS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
            emptyLanguage={onlyLanguageFilter ? languageLabel : null}
            onClearFilters={clearFilters}
            onBrowseLibrary={() => changeSource('library')}
          />
        </TabsContent>
      ))}

      {design && (
        <VoiceDesignDialog
          open={designOpen}
          onOpenChange={setDesignOpen}
          language={previewLanguage}
          onSaved={(voice) => {
            changeSource('workspace')
            design.onSaved(voice)
          }}
        />
      )}
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
  /** The language label when it is the only filter (dedicated empty state for the workspace list). */
  emptyLanguage: string | null
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
  emptyLanguage,
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

  if (catalog.voices.length === 0 && source === 'workspace' && emptyLanguage) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-10 text-center">
        <Globe className="size-8 text-muted-foreground/60" aria-hidden="true" />
        <div className="max-w-md space-y-1">
          <p className="text-sm font-medium">No recommended {emptyLanguage} voices yet</p>
          <p className="text-xs text-muted-foreground">
            We are still adding recommended voices for {emptyLanguage}. Choose one from the voice library instead: it is
            added to your workspace when you pick it.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={onBrowseLibrary} className="gap-1.5">
            <Search aria-hidden="true" /> Browse {emptyLanguage} voices in the library
          </Button>
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Show all languages
          </Button>
        </div>
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
