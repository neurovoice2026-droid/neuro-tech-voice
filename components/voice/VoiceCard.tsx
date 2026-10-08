'use client'

import { Fragment } from 'react'
import { Check, Mic2, Play, Square } from 'lucide-react'
import { CornerDot } from '@/components/site/corner-dot'
import { Button } from '@/components/ui/button'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { OrbInline } from '@/components/shared/OrbLoader'
import { StatusChip, type StatusTone } from '@/components/shared/StatusChip'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { cn } from '@/lib/utils'
import type { PreviewStatus } from '@/hooks/useAudioPreview'
import type { VoiceOption } from '@/types'

// ─── Display helpers (shared by the picker, the dashboard and the clone list) ─

function titleCase(value: string): string {
  const s = value.replace(/[_-]+/g, ' ').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** Library names often carry a marketing tail ("Julie - Warm and calm"). */
export function voiceDisplayName(voice: Pick<VoiceOption, 'name'>): string {
  const head = voice.name.split(' - ')[0]?.trim()
  return head || voice.name
}

const ACCENT_COUNTRY: Record<string, string> = {
  american: 'US',
  british: 'GB',
  english: 'GB',
  scottish: 'GB',
  welsh: 'GB',
  irish: 'IE',
  australian: 'AU',
  canadian: 'CA',
  'new zealand': 'NZ',
  'south african': 'ZA',
  indian: 'IN',
  mexican: 'MX',
  argentinian: 'AR',
  colombian: 'CO',
  brazilian: 'BR',
  moldovan: 'MD',
  swiss: 'CH',
  austrian: 'AT',
  belgian: 'BE',
}

export interface LanguageDisplay {
  label: string
  country: string | null
}

/** "en" / "en-US" / "English" → a label and a flag country (if we know one). */
export function languageDisplay(language: string | null, accent?: string | null): LanguageDisplay | null {
  if (!language) return null
  const code = language.toLowerCase().split(/[-_]/)[0] ?? ''
  const known = AGENT_LANGUAGES.find((l) => l.value === code)
  const accentCountry = accent ? ACCENT_COUNTRY[accent.toLowerCase().replace(/[_-]+/g, ' ').trim()] : undefined
  if (known) return { label: known.label, country: accentCountry ?? known.country }
  const label = code.length <= 3 ? code.toUpperCase() : titleCase(language)
  return { label, country: accentCountry ?? null }
}

/** "Romanian · Moldovan" plus the flag to show next to it. */
export function voiceLocaleLine(voice: Pick<VoiceOption, 'language' | 'accent'>): { text: string; country: string | null } {
  const lang = languageDisplay(voice.language, voice.accent)
  const accent = voice.accent ? titleCase(voice.accent) : null
  return {
    text: [lang?.label ?? 'Multilingual', accent].filter(Boolean).join(' · '),
    country: lang?.country ?? null,
  }
}

export function genderLabel(gender: VoiceOption['gender'] | string | null | undefined): string | null {
  switch (gender) {
    case 'female':
    case 'feminine':
      return 'Female'
    case 'male':
    case 'masculine':
      return 'Male'
    case 'neutral':
    case 'gender_neutral':
      return 'Neutral'
    default:
      return null
  }
}

export function ageLabel(age: string | null): string | null {
  return age ? titleCase(age) : null
}

interface SourceBadge {
  label: string
  title: string
  /** StatusChip tone: neutral by default, a status colour only where it means something. */
  tone: StatusTone
}

export function sourceBadge(voice: VoiceOption): SourceBadge {
  if (voice.recommended && voice.source === 'library') {
    return { label: 'Recommended', title: 'A voice we recommend for this language', tone: 'neutral' }
  }
  switch (voice.source) {
    case 'cloned':
      return { label: 'Your clone', title: 'A custom voice cloned in your workspace', tone: 'success' }
    case 'designed':
      // Generated from a description: the AI-provenance accent (brand chip, accent policy #5).
      return { label: 'Designed', title: 'A custom voice designed in your workspace', tone: 'brand' }
    case 'library':
      return voice.requiresProvisioning
        ? { label: 'Library', title: 'Added to your workspace when you choose it', tone: 'outline' }
        : { label: 'Saved', title: 'Saved to your workspace from the voice library', tone: 'muted' }
    case 'premade':
      // ElevenLabs default voices expire on 31 Dec 2026 (no longer offered for new choices).
      return { label: 'Retiring', title: 'This default voice stops working on 31 Dec 2026', tone: 'warning' }
    case 'provider':
    default:
      return { label: 'Standard', title: 'A standard provider voice', tone: 'muted' }
  }
}

/** First letters of the first two words, ignoring punctuation ("Maya (studio owner)" → "MS"). */
function initialsOf(name: string): string {
  return (name.match(/[\p{L}\p{N}]+/gu) ?? [])
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** "English · American · Female · Young" (the site's Dana card meta line). */
function voiceMetaLine(voice: VoiceOption): { parts: string[]; text: string; country: string | null } {
  const locale = voiceLocaleLine(voice)
  const parts = [...locale.text.split(' · '), genderLabel(voice.gender), ageLabel(voice.age)].filter(
    (p): p is string => !!p,
  )
  return { parts, text: parts.join(' · '), country: locale.country }
}

// ─── Preview button ───────────────────────────────────────────────────────────

interface PreviewButtonProps {
  name: string
  status: PreviewStatus
  onClick: () => void
  /** 'icon' = 32 px round play/stop; 'wide' = pill with a "Preview" label. */
  variant: 'wide' | 'icon'
  disabled?: boolean
  className?: string
}

/**
 * Play / stop pill: white outline at rest, a breathing orb while the sample loads,
 * ink while it plays. It stays clickable while loading so a slow preview can be cancelled.
 */
export function PreviewButton({ name, status, onClick, variant, disabled, className }: PreviewButtonProps) {
  const label =
    status === 'playing' ? `Stop preview of ${name}` : status === 'loading' ? `Loading preview of ${name}` : `Preview ${name}`
  const icon =
    status === 'loading' ? (
      <OrbInline state="breathing" className={variant === 'wide' ? '-ml-1' : undefined} />
    ) : status === 'playing' ? (
      <Square className="size-3 fill-current" aria-hidden="true" />
    ) : (
      <Play className="size-3.5 translate-x-px fill-current" aria-hidden="true" />
    )

  if (variant === 'icon') {
    return (
      <Button
        type="button"
        variant={status === 'playing' ? 'default' : 'outline'}
        size="icon-sm"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-busy={status === 'loading' || undefined}
        title={status === 'playing' ? 'Stop' : 'Preview'}
        className={cn('tap-44 relative z-10', className)}
      >
        {icon}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant={status === 'playing' ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-busy={status === 'loading' || undefined}
      className={cn('relative z-10', className)}
    >
      {icon}
      <span aria-hidden="true">{status === 'playing' ? 'Stop' : status === 'loading' ? 'Loading…' : 'Preview'}</span>
    </Button>
  )
}

// ─── Voice card ───────────────────────────────────────────────────────────────

export interface VoiceCardProps {
  voice: VoiceOption
  selected: boolean
  previewStatus: PreviewStatus
  onSelect: (voice: VoiceOption) => void
  onTogglePreview: (voice: VoiceOption) => void
  /** 'card' for onboarding (roomy), 'compact' for the dashboard list. */
  variant?: 'card' | 'compact'
  disabled?: boolean
}

/** Initial disc, like the site's voice chooser: ink when chosen, tinted grey otherwise. */
function VoiceInitials({ name, selected, size }: { name: string; selected: boolean; size: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-medium transition-colors duration-200',
        size === 'md' ? 'size-10 text-sm' : 'size-9 text-[13px]',
        selected ? 'bg-primary text-white' : 'bg-secondary text-foreground',
      )}
    >
      {initialsOf(name) || <Mic2 className="size-4" />}
    </span>
  )
}

export function VoiceCard({
  voice,
  selected,
  previewStatus,
  onSelect,
  onTogglePreview,
  variant = 'card',
  disabled = false,
}: VoiceCardProps) {
  const name = voiceDisplayName(voice)
  const meta = voiceMetaLine(voice)
  const badge = sourceBadge(voice)

  // Up to two lines (gender and age stay readable in narrow cards); the title
  // carries the whole line if a long accent still clips it.
  const metaLine = (
    <span className="flex min-w-0 items-start gap-1.5 text-xs leading-4 text-muted-foreground">
      {meta.country ? (
        <FlagIcon country={meta.country} className="mt-[3px] h-2.5 w-[15px] rounded-[1.5px]" />
      ) : (
        <Mic2 className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
      )}
      <span className="line-clamp-2 min-w-0" title={meta.text}>
        {/* Lines break between facts, never inside one ("Middle aged"). */}
        {meta.parts.map((part, i) => (
          <Fragment key={i}>
            {i > 0 && ' · '}
            <span className="whitespace-nowrap">{part}</span>
          </Fragment>
        ))}
      </span>
    </span>
  )

  // White panel; the chosen one gets the 2 px ink ring and the brand corner dot.
  const shell = cn(
    // isolate: the preview button's z-10 stays inside the card (sticky toolbars pass over it).
    'group/voice relative isolate rounded-2xl bg-white transition-[box-shadow,background-color] duration-200',
    selected ? 'shadow-[0_0_0_2px_var(--foreground)]' : 'shadow-hair hover:bg-band',
    disabled && 'opacity-60',
  )

  // The select button is stretched over the whole card (after:inset-0) so the
  // card is one click target, while the preview button stays a separate,
  // focusable control above it (z-10). No nested interactive elements.
  const stretched =
    "outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring focus-visible:after:outline-solid disabled:cursor-not-allowed"

  if (variant === 'compact') {
    return (
      <div data-voice-card="" className={cn(shell, 'flex min-h-[60px] items-center gap-2 py-2.5 pr-8 pl-3')}>
        {selected && <CornerDot className="pointer-events-none absolute top-3 right-3 size-2.5 text-brand" />}
        <button
          type="button"
          aria-pressed={selected}
          disabled={disabled}
          onClick={() => onSelect(voice)}
          className={cn('flex min-w-0 flex-1 items-center gap-3 text-left', stretched)}
        >
          <VoiceInitials name={name} selected={selected} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm leading-5 font-medium text-foreground">{name}</span>
              <StatusChip tone={badge.tone} title={badge.title} className="h-5 px-2 text-[11px]">
                {badge.label}
              </StatusChip>
            </span>
            <span className="mt-0.5 flex">{metaLine}</span>
          </span>
        </button>
        <PreviewButton name={name} status={previewStatus} onClick={() => onTogglePreview(voice)} variant="icon" />
      </div>
    )
  }

  return (
    <div data-voice-card="" className={cn(shell, 'flex flex-col p-4')}>
      {selected && <CornerDot className="pointer-events-none absolute top-3.5 right-3.5 size-2.5 text-brand" />}

      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={() => onSelect(voice)}
        className={cn('flex min-w-0 items-center gap-3 pr-5 text-left', stretched)}
      >
        <VoiceInitials name={name} selected={selected} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] leading-6 font-medium tracking-[-0.01em] text-foreground">
            {name}
          </span>
          <span className="mt-0.5 flex">{metaLine}</span>
          {/* The chip is drawn in the footer; screen readers get it with the name. */}
          <span className="sr-only">, {badge.label}</span>
        </span>
      </button>

      {voice.description && (
        <p className="mt-3 line-clamp-2 text-[13px] leading-[19px] text-muted-foreground">{voice.description}</p>
      )}

      {/* Chip left, actions right; in a card too narrow for one row the actions
          wrap under the chip (right-aligned) instead of running past the edge. */}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <StatusChip tone={badge.tone} title={badge.title} aria-hidden="true" className="px-2">
          {badge.label}
        </StatusChip>
        <div className="ml-auto flex items-center gap-1.5">
          <PreviewButton name={name} status={previewStatus} onClick={() => onTogglePreview(voice)} variant="icon" />
          {/* Visual only: a click lands on the stretched select button underneath. */}
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-200',
              selected
                ? 'bg-primary text-white'
                : 'bg-secondary text-foreground group-hover/voice:bg-secondary-hover',
            )}
          >
            {selected ? (
              <>
                <Check className="size-3.5" />
                Selected
              </>
            ) : (
              'Use this voice'
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
