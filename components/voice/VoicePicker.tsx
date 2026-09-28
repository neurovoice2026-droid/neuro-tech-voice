'use client'

import { useCallback, useId, useMemo, useRef, useState } from 'react'
import { AlertCircle, Loader2, MicOff, Plus, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { UpgradeNotice } from '@/components/shared/UpgradeNotice'
import { cn } from '@/lib/utils'
import {
  EMPTY_VOICE_QUERY,
  notifyVoicesChanged,
  peekCachedVoices,
  useAccents,
  useVoiceClones,
  useVoices,
  type VoiceQuery,
} from '@/hooks/useVoices'
import type { Voice } from '@/types'
import { errorMessage, fetchJson } from './api'
import { CloneVoiceDialog } from './CloneVoiceDialog'
import { defaultVoiceById } from './default-voices'
import { forgetPreview } from './preview-player'
import { accentLabel, languageOption } from './voice-options'
import { VoiceCard, VoiceCardSkeleton } from './VoiceCard'
import { hasActiveFilters, VoiceFilters, type AccentChip } from './VoiceFilters'

interface VoicePickerProps {
  /** Selected voice id. */
  value: string | null
  onChange: (voice: Voice) => void
  /** Initial language filter (the agent's language). */
  defaultLanguage?: string | null
  /** Show "Your voices" with cloning and deletion. */
  allowClone?: boolean
  /** Ids to label as recommended and list first when the filters allow (the language defaults). */
  recommendedIds?: readonly string[]
  /** Denser grid for tool panels. */
  compact?: boolean
  /** Called after a clone is deleted, with the voice the agent switched to (if any). */
  onCloneDeleted?: (voice: Voice, replacement: { id: string; name: string } | null) => void
  className?: string
}

const ROVING_KEYS = new Set(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'])

/**
 * Browse, filter, preview and pick a voice. Every card is a radio in one
 * radiogroup (arrow keys move and select), and only one preview plays at a time.
 */
export function VoicePicker({
  value,
  onChange,
  defaultLanguage = null,
  allowClone = false,
  recommendedIds = [],
  compact = false,
  onCloneDeleted,
  className,
}: VoicePickerProps) {
  const idPrefix = useId()
  const initialLanguage = languageOption(defaultLanguage)?.value ?? null
  const [query, setQuery] = useState<VoiceQuery>({ ...EMPTY_VOICE_QUERY, language: initialLanguage })
  const [cloneOpen, setCloneOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Voice | null>(null)
  const [deleting, setDeleting] = useState(false)
  const groupRef = useRef<HTMLDivElement | null>(null)

  const limit = compact ? 18 : 24
  const catalog = useVoices(query, { limit })
  const clones = useVoiceClones({ enabled: allowClone })
  const { names: accentNames } = useAccents(query.language)

  const updateQuery = useCallback((patch: Partial<VoiceQuery>) => setQuery((current) => ({ ...current, ...patch })), [])

  // Recommended voices lead the library while no search or accent narrows it,
  // so the preselected voice is on screen instead of pages down the catalogue.
  const pinned = useMemo<Voice[]>(() => {
    if (query.q.trim() || query.accent) return []
    return recommendedIds.flatMap((id) => {
      const voice = catalog.voices.find((v) => v.id === id) ?? defaultVoiceById(id)
      if (!voice) return []
      if (query.gender && voice.gender !== query.gender) return []
      if (query.language && voice.language !== query.language) return []
      return [voice]
    })
  }, [catalog.voices, query.accent, query.gender, query.language, query.q, recommendedIds])

  // With "Your voices" shown separately, the library list skips the org's clones.
  const libraryVoices = useMemo(() => {
    const base = allowClone ? catalog.voices.filter((voice) => !voice.is_owner) : catalog.voices
    if (pinned.length === 0) return base
    const pinnedIds = new Set(pinned.map((voice) => voice.id))
    return [...pinned, ...base.filter((voice) => !pinnedIds.has(voice.id))]
  }, [allowClone, catalog.voices, pinned])

  // Accent chips come from the results for the current language. While an
  // accent is selected they are derived from the same query without it (still
  // cached), so the other accents stay one click away.
  const accentChips = useMemo<AccentChip[]>(() => {
    const source = query.accent
      ? peekCachedVoices({ ...query, accent: null }, limit) ?? catalog.voices
      : catalog.voices
    const counts = new Map<string, number>()
    for (const voice of source) {
      for (const accent of voice.accents) {
        if (query.native && !accent.is_native) continue
        if (query.language && accent.locale.split(/[-_]/)[0].toLowerCase() !== query.language) continue
        counts.set(accent.accent, (counts.get(accent.accent) ?? 0) + 1)
      }
    }
    const chips = [...counts.entries()]
      .map(([id, count]) => ({ id, count, label: accentNames[id] ?? accentLabel(id) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
    if (query.accent && !chips.some((chip) => chip.id === query.accent)) {
      chips.unshift({ id: query.accent, count: 0, label: accentNames[query.accent] ?? accentLabel(query.accent) })
    }
    return chips
  }, [catalog.voices, query, limit, accentNames])

  const visible = useMemo(() => [...(allowClone ? clones.clones : []), ...libraryVoices], [allowClone, clones.clones, libraryVoices])
  const tabbableId = visible.some((voice) => voice.id === value) ? value : visible[0]?.id ?? null
  const recommended = useMemo(() => new Set(recommendedIds), [recommendedIds])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!ROVING_KEYS.has(event.key) || !groupRef.current) return
      const radios = [...groupRef.current.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
      const index = radios.indexOf(event.currentTarget)
      if (index < 0 || radios.length === 0) return
      event.preventDefault()
      const nextIndex =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? radios.length - 1
            : event.key === 'ArrowRight' || event.key === 'ArrowDown'
              ? (index + 1) % radios.length
              : (index - 1 + radios.length) % radios.length
      const next = radios[nextIndex]
      next.focus()
      const voice = visible.find((v) => v.id === next.dataset.voiceId)
      if (voice) onChange(voice)
    },
    [visible, onChange]
  )

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const result = await fetchJson<{ ok: true; replacement: { id: string; name: string } | null }>(
        `/api/voices/${encodeURIComponent(pendingDelete.id)}`,
        { method: 'DELETE' }
      )
      forgetPreview(`voice:${pendingDelete.id}`)
      toast.success(
        result.replacement
          ? `“${pendingDelete.name}” was deleted. Your agent now uses ${result.replacement.name}.`
          : `“${pendingDelete.name}” was deleted.`
      )
      onCloneDeleted?.(pendingDelete, result.replacement)
      notifyVoicesChanged()
      setPendingDelete(null)
    } catch (error) {
      toast.error(errorMessage(error, 'We couldn’t delete this voice. Please try again.'))
    } finally {
      setDeleting(false)
    }
  }

  const filtersActive = hasActiveFilters(query, initialLanguage)
  // Container queries: the picker sits in a 640 px onboarding column, a wide
  // agent tab and a Voice Lab side panel, so columns follow its own width.
  const gridClass = compact
    ? 'grid grid-cols-1 gap-2 @md/voice-picker:grid-cols-2'
    : 'grid grid-cols-1 gap-3 @lg/voice-picker:grid-cols-2 @3xl/voice-picker:grid-cols-3'
  const showClones = allowClone && (clones.isLoading || clones.clones.length > 0 || clones.cloning !== null || clones.error !== null)

  return (
    <div className={cn('@container/voice-picker min-w-0 space-y-4', className)}>
      <VoiceFilters query={query} onChange={updateQuery} accentChips={accentChips} idPrefix={idPrefix} compact={compact} />

      <div ref={groupRef} role="radiogroup" aria-label="Voices" className="space-y-5">
        {showClones && (
          <section aria-labelledby={`${idPrefix}-yours`} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id={`${idPrefix}-yours`} className="text-sm font-semibold text-foreground">
                Your voices
                {clones.cloning && clones.cloning.entitled && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {clones.cloning.count} of {clones.cloning.max}
                  </span>
                )}
              </h3>
              {clones.cloning?.entitled && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCloneOpen(true)}
                  disabled={clones.cloning.count >= clones.cloning.max}
                >
                  <Plus aria-hidden="true" /> Clone a voice
                </Button>
              )}
            </div>

            {clones.isLoading ? (
              <div className={gridClass}>
                <VoiceCardSkeleton compact={compact} />
              </div>
            ) : clones.error ? (
              <p className="flex items-center gap-2 text-xs text-destructive" role="alert">
                <AlertCircle className="size-3.5" aria-hidden="true" /> {clones.error.message}
                <Button type="button" variant="link" size="xs" onClick={clones.retry}>
                  Try again
                </Button>
              </p>
            ) : clones.cloning && !clones.cloning.entitled ? (
              <UpgradeNotice
                feature="Voice cloning"
                requiredPlan={clones.cloning.required_plan}
                description="Record a minute of your own voice, or a team member’s, and your agent answers calls sounding like you."
                compact={compact}
              />
            ) : clones.clones.length === 0 ? (
              <button
                type="button"
                onClick={() => setCloneOpen(true)}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed p-3 text-left transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">Clone your own voice</span>
                  <span className="block text-xs text-muted-foreground">
                    Record or upload a short clip and your agent can speak with it.
                  </span>
                </span>
              </button>
            ) : (
              <div className={gridClass}>
                {clones.clones.map((voice) => (
                  <VoiceCard
                    key={voice.id}
                    voice={voice}
                    selected={voice.id === value}
                    onSelect={onChange}
                    tabIndex={voice.id === tabbableId ? 0 : -1}
                    onKeyDown={handleKeyDown}
                    accentNames={accentNames}
                    onDelete={setPendingDelete}
                    compact={compact}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <section aria-labelledby={`${idPrefix}-library`} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 id={`${idPrefix}-library`} className={cn('text-sm font-semibold text-foreground', !allowClone && 'sr-only')}>
              Voice library
            </h3>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {catalog.isLoading || catalog.isSearchPending
                ? 'Loading voices…'
                : catalog.error
                  ? ''
                  : `${libraryVoices.length}${catalog.hasMore ? '+' : ''} voice${libraryVoices.length === 1 ? '' : 's'}`}
            </p>
          </div>

          {catalog.isLoading ? (
            <div className={gridClass}>
              {Array.from({ length: compact ? 4 : 6 }).map((_, i) => (
                <VoiceCardSkeleton key={i} compact={compact} />
              ))}
            </div>
          ) : catalog.error ? (
            <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-10 text-center">
              <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
              <p className="max-w-sm text-sm text-muted-foreground">{catalog.error.message}</p>
              {catalog.error.code !== 'not_configured' && (
                <Button type="button" variant="outline" size="sm" onClick={catalog.retry}>
                  <RefreshCw aria-hidden="true" /> Try again
                </Button>
              )}
            </div>
          ) : libraryVoices.length === 0 ? (
            <EmptyState
              icon={MicOff}
              title="No voices match these filters"
              description={query.native && query.language ? 'Try turning off “Native speakers only” or choosing another accent.' : 'Try a different search or language.'}
              className="rounded-xl border border-dashed py-10"
              action={
                filtersActive ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setQuery({ ...EMPTY_VOICE_QUERY, language: initialLanguage })}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className={gridClass}>
                {libraryVoices.map((voice) => (
                  <VoiceCard
                    key={voice.id}
                    voice={voice}
                    selected={voice.id === value}
                    onSelect={onChange}
                    tabIndex={voice.id === tabbableId ? 0 : -1}
                    onKeyDown={handleKeyDown}
                    accentNames={accentNames}
                    badge={recommended.has(voice.id) ? 'Recommended' : null}
                    compact={compact}
                  />
                ))}
              </div>
              {catalog.hasMore && (
                <div className="flex flex-col items-center gap-2 pt-1">
                  {catalog.loadMoreError && (
                    <p role="alert" className="flex items-center gap-1.5 text-center text-xs text-destructive">
                      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" /> {catalog.loadMoreError.message}
                    </p>
                  )}
                  <Button type="button" variant="outline" onClick={catalog.loadMore} disabled={catalog.isLoadingMore}>
                    {catalog.isLoadingMore ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : catalog.loadMoreError ? (
                      <RefreshCw aria-hidden="true" />
                    ) : (
                      <Plus aria-hidden="true" />
                    )}
                    {catalog.loadMoreError ? 'Try loading more again' : 'Load more voices'}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {allowClone && (
        <CloneVoiceDialog open={cloneOpen} onOpenChange={setCloneOpen} onCreated={onChange} defaultLanguage={query.language ?? defaultLanguage} />
      )}

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{pendingDelete?.name}”?</DialogTitle>
            <DialogDescription>
              The voice and its recording are removed for good. If your agent uses it, it switches to the default voice for its
              language so calls keep working.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Keep voice
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="animate-spin" aria-hidden="true" />}
              Delete voice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
