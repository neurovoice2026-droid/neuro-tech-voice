'use client'

// Controlled fields for the Conversation tab: additional languages (language
// presets) and speech-recognition keywords. The tab owns the draft and saves
// conversation_settings as a whole.

import { useId, useState } from 'react'
import { AlertCircle, Check, Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { Chip } from '@/components/shared/OptionCard'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import {
  ASR_KEYWORDS_MAX,
  ASR_KEYWORD_MAX_CHARS,
  ConversationSettingsSchema,
  MAX_ADDITIONAL_LANGUAGES,
  cleanKeyword,
} from '@/lib/voice-providers/settings'

function languageLabel(code: string): string {
  return AGENT_LANGUAGES.find((l) => l.value === code)?.label ?? code
}

// ─── Additional languages ────────────────────────────────────────────────────

interface AdditionalLanguagesFieldProps {
  primary: string
  value: string[]
  onChange: (next: string[]) => void
  error?: string
}

export function AdditionalLanguagesField({ primary, value, onChange, error }: AdditionalLanguagesFieldProps) {
  const groupId = useId()
  const errorId = `${groupId}-error`
  const options = AGENT_LANGUAGES.filter((l) => l.value !== primary)
  const full = value.length >= MAX_ADDITIONAL_LANGUAGES

  const toggle = (code: string, checked: boolean) => {
    if (checked) {
      if (!value.includes(code) && !full) onChange([...value, code])
    } else {
      onChange(value.filter((c) => c !== code))
    }
  }

  return (
    <div className="space-y-3">
      <fieldset aria-describedby={`${groupId}-hint${error ? ` ${errorId}` : ''}`} aria-invalid={error ? true : undefined}>
        <legend className="sr-only">Additional languages</legend>
        {/* The site's language chips: ink when on, tinted grey when off. */}
        <div className="flex flex-wrap gap-2">
          {options.map((l) => {
            const checked = value.includes(l.value)
            const disabled = !checked && full
            return (
              <Chip
                key={l.value}
                role="checkbox"
                pressed={checked}
                disabled={disabled}
                onClick={() => toggle(l.value, !checked)}
                className="h-9 gap-2 pr-3.5 pl-3 text-[13px]"
              >
                {/* Important sizes: the chip sizes un-sized svgs to 14 px squares. */}
                <FlagIcon country={l.country} className="h-3.5! w-5!" />
                {l.label}
                {checked && <Check className="size-3.5" aria-hidden="true" />}
              </Chip>
            )
          })}
        </div>
      </fieldset>
      <p id={`${groupId}-hint`} className="text-xs leading-[18px] text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">
          {value.length} / {MAX_ADDITIONAL_LANGUAGES} selected.
        </span>{' '}
        Calls start in {languageLabel(primary)}; if the caller speaks one of these
        languages in their first two replies, the agent switches to it for the rest of the call. The backup voice agent only speaks{' '}
        {languageLabel(primary)}.
      </p>
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-xs leading-4 text-destructive">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

// ─── ASR keywords (chips) ────────────────────────────────────────────────────

const keywordSchema = ConversationSettingsSchema.shape.asr_keywords.element

interface KeywordsFieldProps {
  value: string[]
  onChange: (next: string[]) => void
  error?: string
}

export function AsrKeywordsField({ value, onChange, error }: KeywordsFieldProps) {
  const inputId = useId()
  const [text, setText] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const full = value.length >= ASR_KEYWORDS_MAX
  const shownError = inputError ?? error ?? null

  const add = () => {
    const parsed = keywordSchema.safeParse(text)
    if (!parsed.success) {
      setInputError(parsed.error.issues[0]?.message ?? 'Invalid keyword')
      return
    }
    const keyword = parsed.data
    if (value.some((k) => k.toLocaleLowerCase() === keyword.toLocaleLowerCase())) {
      setInputError('Already in the list')
      return
    }
    if (full) {
      setInputError(`At most ${ASR_KEYWORDS_MAX} keywords`)
      return
    }
    onChange([...value, keyword])
    setText('')
    setInputError(null)
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>Words to recognize</Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={text}
          maxLength={ASR_KEYWORD_MAX_CHARS * 2}
          placeholder="e.g. Dr. Ionescu, teeth whitening, Str. Eminescu"
          onChange={(e) => {
            setText(e.target.value)
            setInputError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (cleanKeyword(text)) add()
            }
          }}
          disabled={full}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={`${inputId}-hint${shownError ? ` ${inputId}-error` : ''}`}
        />
        <Button type="button" variant="outline" onClick={add} disabled={full || !cleanKeyword(text)} className="h-10">
          <Plus aria-hidden="true" /> Add
        </Button>
      </div>
      {shownError && (
        <p id={`${inputId}-error`} role="alert" className="flex items-start gap-1.5 text-xs leading-4 text-destructive">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{shownError}</span>
        </p>
      )}
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Words to recognize">
          {value.map((k) => (
            <li key={k}>
              <Badge variant="secondary" className="h-7 gap-1 overflow-visible pr-1 pl-3 text-[13px] font-normal">
                <span className="max-w-48 truncate">{k}</span>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v !== k))}
                  className="tap-44 relative grid size-5 place-items-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-white hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-ring"
                  aria-label={`Remove ${k}`}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <p id={`${inputId}-hint`} className="text-xs leading-[18px] text-muted-foreground">
        {value.length} / {ASR_KEYWORDS_MAX}. Names callers say that are easy to mishear: staff, services, products, street names (up to{' '}
        {ASR_KEYWORD_MAX_CHARS} characters each). Your business name is always included. Keep the list short and specific.
      </p>
    </div>
  )
}
