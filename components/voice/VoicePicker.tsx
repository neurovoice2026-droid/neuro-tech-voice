'use client'

import { useEffect, useRef, useState, type FocusEvent } from 'react'
import { AlertCircle, ChevronDown, Globe, MicOff, RotateCw, Search, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/EmptyState'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { Chip } from '@/components/shared/OptionCard'
import { OrbInline, OrbLoader } from '@/components/shared/OrbLoader'
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
        <Globe className="size-3.5 text-muted-foreground" aria-hidden="true" />
        All languages
      </span>
    )
  }
  const lang = AGENT_LANGUAGES.find((l) => l.value === value)
  if (!lang) return <span>{value}</span>
  return (
    <span className="flex items-center gap-2">
      <FlagIcon country={lang.country} className="h-3 w-[18px]" />
      {lang.label}
    </span>
  )
}

/** A select rendered as the toolbar's white filter pill. */
function FilterSelect({
  items,
  value,
  onChange,
  label,
}: {
  items: Record<string, string>
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => typeof v === 'string' && onChange(v)}>
      <SelectTrigger size="sm" aria-label={label} className="relative tap-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([itemValue, itemLabel]) => (
          <SelectItem key={itemValue} value={itemValue}>
            {itemLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  // Where the wait shows: in the search field while a search runs, next to the
  // count while a filter refetches shown results, and as the big orb in the
  // results area on a first load (see VoiceResults).
  const firstLoad = active.isLoading && active.voices.length === 0 && !active.error
  const searching = busy && !!search.trim() && !firstLoad
  const refreshing = busy && !searching && active.voices.length > 0

  // Onboarding: browsers scroll a newly focused element only when it is outside
  // the viewport, so a card half under the sticky toolbar (md+) or the fixed step
  // bar would stay covered. On keyboard focus, move the page just enough to show
  // the whole card (or control) and its ring. Instant, so the browser's own focus
  // scroll cannot cancel it; the page's scroll-padding gives the fixed bars' room.
  const toolbarRef = useRef<HTMLDivElement>(null)
  const revealFocused = (e: FocusEvent<HTMLElement>) => {
    const target = e.target
    if (!(target instanceof HTMLElement) || !target.matches(':focus-visible')) return
    const box = (target.closest<HTMLElement>('[data-voice-card]') ?? target).getBoundingClientRect()
    const page = getComputedStyle(document.documentElement)
    const toolbar = toolbarRef.current
    const toolbarBottom =
      toolbar && getComputedStyle(toolbar).position === 'sticky' ? toolbar.getBoundingClientRect().bottom : 0
    const air = 12 // the 4 px focus ring plus 8 px
    const top = Math.max(parseFloat(page.scrollPaddingTop) || 0, toolbarBottom) + air
    const bottom = window.innerHeight - (parseFloat(page.scrollPaddingBottom) || 0) - air
    const delta = box.top < top ? box.top - top : box.bottom > bottom ? Math.min(box.bottom - bottom, box.top - top) : 0
    if (delta) window.scrollBy({ top: delta, behavior: 'instant' })
  }

  return (
    <Tabs value={source} onValueChange={changeSource} className="@container/voice gap-0">
      <div
        ref={toolbarRef}
        className={cn(
          'space-y-3 border-b border-rule pb-4',
          // Onboarding: the toolbar stays reachable while the grid scrolls under it.
          onboarding && 'md:sticky md:top-14 md:z-10 md:-mx-1 md:bg-white md:px-1 md:pt-4',
        )}
      >
        <div className="flex flex-col gap-2 @lg/voice:flex-row @lg/voice:items-center @lg/voice:justify-between">
          <TabsList className="w-full @lg/voice:w-fit" aria-label="Voice source">
            {SOURCES.map((s) => (
              <TabsTrigger key={s.value} value={s.value}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {design && (
            <div className="flex flex-col items-start gap-1 @lg/voice:items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDesignOpen(true)}
                disabled={!!design.unavailableReason}
                aria-describedby={design.unavailableReason ? 'voice-design-unavailable' : undefined}
              >
                <Wand2 aria-hidden="true" /> Design a voice
              </Button>
              {design.unavailableReason && (
                <p id="voice-design-unavailable" className="max-w-xs text-xs text-muted-foreground @lg/voice:text-right">
                  {design.unavailableReason}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[min(100%,320px)] flex-1 basis-full @xl/voice:basis-0">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, accent or style…"
              aria-label="Search voices"
              maxLength={100}
              className={cn('h-9 rounded-full pl-9 text-ellipsis', searching && search ? 'pr-16' : search ? 'pr-10' : 'pr-4')}
            />
            <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5">
              {searching && <OrbInline state="searching" />}
              {search && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="tap-44"
                >
                  <X aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>

          <Select value={language} onValueChange={(v) => v && setLanguage(v)}>
            <SelectTrigger size="sm" aria-label="Filter by language" className="relative tap-44">
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

          <div role="radiogroup" aria-label="Filter by gender" className="flex flex-wrap items-center gap-1">
            {GENDERS.map((g) => (
              <Chip
                key={g.value}
                role="radio"
                size="sm"
                pressed={gender === g.value}
                onClick={() => setGender(g.value)}
                className="relative tap-44 @xl/voice:h-8 @xl/voice:px-3 @xl/voice:text-[13px]"
              >
                {g.label}
              </Chip>
            ))}
          </div>
        </div>

        {source === 'library' && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Voice library filters">
            <Chip pressed={phoneVoicesOnly} onClick={() => setPhoneVoicesOnly((v) => !v)} className="relative tap-44">
              Phone conversation voices
            </Chip>
            <Chip pressed={studioQuality} onClick={() => setStudioQuality((v) => !v)} className="relative tap-44">
              Studio quality
            </Chip>
            {language !== ALL_LANGUAGES && !accentOptions.unavailable && accentOptions.accents.length > 0 && (
              <FilterSelect items={accentItems} value={accent} onChange={setAccent} label="Filter by accent" />
            )}
            <FilterSelect items={AGES} value={age} onChange={setAge} label="Filter by age" />
            <div className="@xl/voice:ml-auto">
              <FilterSelect items={SORTS} value={sort} onChange={setSort} label="Sort voices" />
            </div>
          </div>
        )}

        <div className="flex min-h-7 items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {refreshing && <OrbInline state="breathing" className="-my-1" />}
            {/* On a first load the results orb carries "Loading voices…". */}
            {firstLoad ? null : statusText}
          </p>
          {activeFilters > 0 && (
            <Button type="button" variant="ghost" size="xs" onClick={clearFilters} className="tap-44 -mr-1">
              <X aria-hidden="true" /> Clear filters
            </Button>
          )}
        </div>
      </div>

      {SOURCES.map((s) => (
        <TabsContent
          key={s.value}
          value={s.value}
          // The panel is a Tab stop (it opens with a hint, not a control), so it gets the focus
          // ring; mt-2 keeps the ring's top edge clear of the toolbar above it. In onboarding,
          // keyboard focus inside it is kept clear of the sticky toolbar (md+) and the step bar.
          className="mt-2 space-y-3 rounded-2xl pt-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
          onFocus={onboarding ? revealFocused : undefined}
        >
          <p className="text-xs leading-4 text-muted-foreground">{s.hint}</p>
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
  // Columns follow the picker's own width (container query), not the viewport:
  // the same picker sits in a 640 px onboarding column and in a dashboard panel.
  // Onboarding cards go two-up only when each is ~294 px wide, enough for the
  // chip, preview and "Use this voice" row (it wraps below that, never overflows).
  const gridClass = onboarding
    ? 'grid grid-cols-1 gap-3 @[37.5rem]/voice:grid-cols-2'
    : 'grid grid-cols-1 gap-2 @xl/voice:grid-cols-2'

  if (catalog.error) {
    return (
      <div role="alert">
        <EmptyState
          icon={AlertCircle}
          iconClassName="bg-destructive-soft text-destructive shadow-none"
          title="We couldn't load these voices"
          description={catalog.error}
          action={
            <Button variant="outline" size="sm" onClick={catalog.retry}>
              <RotateCw aria-hidden="true" /> Try again
            </Button>
          }
        />
      </div>
    )
  }

  if (catalog.isLoading && catalog.voices.length === 0) {
    // Reserve about the loaded list's height (dashboard: ~8 rows one-up, 4 rows two-up).
    return (
      <OrbLoader
        size={64}
        label="Loading voices…"
        className={onboarding ? 'min-h-[320px]' : 'min-h-[600px] @xl/voice:min-h-[340px]'}
      />
    )
  }

  if (catalog.voices.length === 0 && source === 'workspace' && emptyLanguage) {
    return (
      <div role="status">
        <EmptyState
          icon={Globe}
          title={`No recommended ${emptyLanguage} voices yet`}
          description={`We are still adding recommended voices for ${emptyLanguage}. Choose one from the voice library instead: it is added to your workspace when you pick it.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={onBrowseLibrary}>
                <Search aria-hidden="true" /> Browse {emptyLanguage} voices in the library
              </Button>
              <Button variant="outline" size="sm" onClick={onClearFilters}>
                Show all languages
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  if (catalog.voices.length === 0) {
    return (
      <EmptyState
        icon={MicOff}
        title={
          hasFilters
            ? 'No voices match your filters.'
            : source === 'workspace'
              ? 'No voices in your workspace yet.'
              : 'No voices found in the library.'
        }
        action={
          hasFilters || source === 'workspace' ? (
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
          ) : undefined
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          gridClass,
          // Dashboard from md: a bounded list (scroll chains on to the page at its ends); the
          // 4 px inset keeps the rings and focus outlines unclipped. Phones get one page scroll.
          !onboarding && 'md:-m-1 md:max-h-[28rem] md:overflow-y-auto md:p-1',
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
        <div className="flex justify-center">
          <Button
            variant="outline"
            size={onboarding ? 'default' : 'sm'}
            onClick={catalog.loadMore}
            disabled={catalog.isLoading}
            loading={catalog.isLoadingMore}
            loadingState="breathing"
            loadingText="Loading more voices…"
          >
            {catalog.loadMoreError ? <RotateCw aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            {catalog.loadMoreError ? 'Try again' : 'Load more voices'}
          </Button>
        </div>
      )}
    </div>
  )
}
