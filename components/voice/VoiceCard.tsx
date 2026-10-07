'use client'

import { Check, CheckCircle2, Loader2, Mic2, Play, Square } from 'lucide-react'
import { FlagIcon } from '@/components/shared/FlagIcon'
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
  className: string
}

export function sourceBadge(voice: VoiceOption): SourceBadge {
  if (voice.recommended && voice.source === 'library') {
    return {
      label: 'Recommended',
      title: 'A voice we recommend for this language',
      className: 'bg-primary/10 text-primary',
    }
  }
  switch (voice.source) {
    case 'cloned':
      return {
        label: 'Your clone',
        title: 'A custom voice cloned in your workspace',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
      }
    case 'designed':
      return {
        label: 'Designed',
        title: 'A custom voice designed in your workspace',
        className: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
      }
    case 'library':
      return voice.requiresProvisioning
        ? {
            label: 'Library',
            title: 'Added to your workspace when you choose it',
            className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
          }
        : {
            label: 'Saved',
            title: 'Saved to your workspace from the voice library',
            className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
          }
    case 'premade':
      // ElevenLabs default voices expire on 31 Dec 2026 (no longer offered for new choices).
      return {
        label: 'Retiring',
        title: 'This default voice stops working on 31 Dec 2026',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
      }
    case 'provider':
    default:
      return {
        label: 'Standard',
        title: 'A standard provider voice',
        className: 'bg-muted text-muted-foreground',
      }
  }
}

const GENDER_CHIP: Record<string, string> = {
  Female: 'bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400',
  Male: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
  Neutral: 'bg-muted text-muted-foreground',
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// ─── Preview button ───────────────────────────────────────────────────────────

interface PreviewButtonProps {
  name: string
  status: PreviewStatus
  onClick: () => void
  variant: 'wide' | 'icon'
  disabled?: boolean
  className?: string
}

export function PreviewButton({ name, status, onClick, variant, disabled, className }: PreviewButtonProps) {
  const label =
    status === 'playing' ? `Stop preview of ${name}` : status === 'loading' ? `Loading preview of ${name}` : `Preview ${name}`
  const icon =
    status === 'loading' ? (
      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
    ) : status === 'playing' ? (
      <Square className="size-3.5 fill-current" aria-hidden="true" />
    ) : (
      <Play className="size-3.5 fill-current" aria-hidden="true" />
    )

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        title={status === 'playing' ? 'Stop' : 'Preview'}
        className={cn(
          'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
          status !== 'idle' && 'bg-primary/10 text-primary',
          className,
        )}
      >
        {icon}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'relative z-10 flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-xs font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
        status !== 'idle'
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary',
        className,
      )}
    >
      {icon}
      <span aria-hidden="true">{status === 'playing' ? 'Stop' : status === 'loading' ? 'Loading…' : 'Preview'}</span>
    </button>
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
  const locale = voiceLocaleLine(voice)
  const gender = genderLabel(voice.gender)
  const age = ageLabel(voice.age)
  const badge = sourceBadge(voice)

  const languageLine = (
    <span className="flex min-w-0 items-center gap-1">
      {locale.country ? (
        <FlagIcon country={locale.country} className="h-3 w-4.5" />
      ) : (
        <Mic2 className="size-3 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate">{locale.text}</span>
    </span>
  )

  const chips = (
    <span className="flex flex-wrap gap-1.5">
      {gender && (
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', GENDER_CHIP[gender])}>{gender}</span>
      )}
      {age && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{age}</span>
      )}
    </span>
  )

  const sourceChip = (
    <span
      title={badge.title}
      className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide', badge.className)}
    >
      {badge.label}
    </span>
  )

  // The select button is stretched over the whole card (after:inset-0) so the
  // card is one click target, while the preview button stays a separate,
  // focusable control above it (z-10). No nested interactive elements.
  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'relative flex items-center gap-2 rounded-xl border-2 p-3 transition-all',
          selected ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40',
          disabled && 'opacity-60',
        )}
      >
        <button
          type="button"
          aria-pressed={selected}
          disabled={disabled}
          onClick={() => onSelect(voice)}
          className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:ring-3 focus-visible:after:ring-ring/50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{name}</span>
            {sourceChip}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {languageLine}
            {chips}
          </span>
        </button>
        <PreviewButton
          name={name}
          status={previewStatus}
          onClick={() => onTogglePreview(voice)}
          variant="icon"
        />
        {selected ? (
          <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <span className="size-4 shrink-0" aria-hidden="true" />
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-card p-4 transition-all duration-200',
        selected
          ? 'border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/40'
          : 'border-border hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md',
        disabled && 'opacity-60',
      )}
    >
      {selected && (
        <CheckCircle2 className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-primary" aria-hidden="true" />
      )}

      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={() => onSelect(voice)}
        className="flex items-center gap-3 pr-6 text-left outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-3 focus-visible:after:ring-ring/50 disabled:cursor-not-allowed"
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
            selected ? 'bg-primary' : 'bg-gradient-to-br from-violet-500 to-indigo-600',
          )}
        >
          {initialsOf(name) || <Mic2 className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">{name}</span>
            {sourceChip}
          </span>
          <span className="mt-0.5 flex text-xs text-muted-foreground">{languageLine}</span>
        </span>
      </button>

      {voice.description && (
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{voice.description}</p>
      )}

      <div className="mt-3">{chips}</div>

      <div className="mt-auto pt-3">
        <PreviewButton
          name={name}
          status={previewStatus}
          onClick={() => onTogglePreview(voice)}
          variant="wide"
        />
      </div>
    </div>
  )
}
