'use client'

import { CheckCircle2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { cn } from '@/lib/utils'
import type { Voice } from '@/types'
import { AudioPreviewButton } from './AudioPreviewButton'
import { voicePreviewLoader } from './preview-player'
import { accentLabel, genderLabel, languageLabel, languageOption } from './voice-options'

interface VoiceCardProps {
  voice: Voice
  selected: boolean
  onSelect: (voice: Voice) => void
  /** Roving tab index from the picker (0 for the one tabbable card). */
  tabIndex?: number
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void
  /** Accent id → display name from Cartesia. */
  accentNames?: Record<string, string>
  badge?: string | null
  onDelete?: (voice: Voice) => void
  compact?: boolean
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** The voice's native accent, else its first one. */
export function primaryAccent(voice: Voice): Voice['accents'][number] | null {
  return voice.accents.find((a) => a.is_native) ?? voice.accents[0] ?? null
}

export function voiceSubtitle(voice: Voice, accentNames?: Record<string, string>): string {
  const accent = primaryAccent(voice)
  const accentName = accent ? accentNames?.[accent.accent] ?? accentLabel(accent.accent) : null
  const language = languageOption(voice.language)?.label ?? (voice.language ? languageLabel(voice.language) : null)
  return [language, accentName && accentName !== language ? accentName : null].filter(Boolean).join(' · ')
}

/**
 * One selectable voice. The whole card is the radio (a stretched button);
 * preview and delete sit above it so they never change the selection.
 */
export function VoiceCard({
  voice,
  selected,
  onSelect,
  tabIndex = -1,
  onKeyDown,
  accentNames,
  badge,
  onDelete,
  compact = false,
}: VoiceCardProps) {
  const country = languageOption(voice.language)?.country ?? null
  const gender = genderLabel(voice.gender)
  const subtitle = voiceSubtitle(voice, accentNames)
  const description = voice.tagline ?? voice.description

  return (
    <div
      className={cn(
        'group relative flex min-w-0 flex-col rounded-xl border bg-card transition-colors',
        compact ? 'p-2.5' : 'p-3',
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40'
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        tabIndex={tabIndex}
        data-voice-id={voice.id}
        onClick={() => onSelect(voice)}
        onKeyDown={onKeyDown}
        aria-label={[voice.name, gender, subtitle, voice.is_owner ? 'your voice' : null].filter(Boolean).join(', ')}
        className="absolute inset-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      <div className="pointer-events-none relative flex min-w-0 items-center gap-3">
        <div
          aria-hidden="true"
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full text-xs font-semibold',
            compact ? 'size-8' : 'size-10',
            selected ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
          )}
        >
          {initials(voice.name) || '?'}
        </div>
        <div className="min-w-0 flex-1">
          {/* The badge drops below the name in narrow cards instead of squeezing the name to a letter. */}
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <p className="max-w-full truncate text-sm font-semibold text-foreground">{voice.name}</p>
            {badge && (
              <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {country && <FlagIcon country={country} className="h-3 w-4" />}
            <span className="truncate">{subtitle || 'Any language'}</span>
          </p>
        </div>
        {selected && <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />}
      </div>

      {!compact && (
        <p className="pointer-events-none relative mt-2 line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">
          {description ?? ' '}
        </p>
      )}

      {/* Clicks anywhere but the buttons fall through to the card's radio. */}
      <div className="pointer-events-none relative mt-2 flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {gender && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{gender}</span>
          )}
          {voice.is_owner && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              Yours
            </span>
          )}
        </div>
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${voice.name}`}
            onClick={(event) => {
              event.stopPropagation()
              onDelete(voice)
            }}
            className="pointer-events-auto relative text-muted-foreground hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
        {voice.preview_url && (
          <AudioPreviewButton
            previewKey={`voice:${voice.id}`}
            load={voicePreviewLoader(voice.preview_url)}
            label={voice.name}
            className="pointer-events-auto relative"
          />
        )}
      </div>
    </div>
  )
}

export function VoiceCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('flex flex-col rounded-xl border bg-card', compact ? 'p-2.5' : 'p-3')} aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className={cn('shrink-0 animate-pulse rounded-full bg-muted', compact ? 'size-8' : 'size-10')} />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
      {!compact && <div className="mt-2 h-8 animate-pulse rounded bg-muted" />}
      <div className="mt-2 flex items-center justify-between">
        <div className="h-4 w-14 animate-pulse rounded-full bg-muted" />
        <div className="size-7 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  )
}
