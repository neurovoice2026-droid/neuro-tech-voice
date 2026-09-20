'use client'

import { useId, useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { KEYTERM_MAX_COUNT, KEYTERM_MAX_TOTAL_CHARS, sanitizeKeyterms } from '@/lib/voice/languages'
import { AGENT_LIMITS } from '@/lib/voice/sync/limits'

const TERM_MAX = AGENT_LIMITS.keytermChars

interface KeytermsInputProps {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  describedBy?: string
}

/** Chip input for words the speech recogniser should expect (brand, product and staff names). */
export function KeytermsInput({ value, onChange, disabled, describedBy }: KeytermsInputProps) {
  const inputId = useId()
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const totalChars = value.reduce((sum, term) => sum + term.length, 0)
  const full = value.length >= KEYTERM_MAX_COUNT

  const add = (raw: string) => {
    const parts = raw
      .split(/[,\n;]/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    const tooLong = parts.filter((p) => p.length > TERM_MAX)
    const candidates = parts.filter((p) => p.length <= TERM_MAX)
    const next = sanitizeKeyterms([...value, ...candidates])
    const added = next.length - value.length
    if (tooLong.length > 0) setNotice(`Keep each entry under ${TERM_MAX} characters.`)
    else if (added < candidates.length) {
      setNotice(
        next.length >= KEYTERM_MAX_COUNT || next.reduce((s, t) => s + t.length, 0) + 10 > KEYTERM_MAX_TOTAL_CHARS
          ? 'The list is full. Remove a word to add another.'
          : 'That word is already on the list.'
      )
    } else setNotice(null)
    onChange(next)
    setDraft('')
  }

  const remove = (term: string) => {
    onChange(value.filter((t) => t !== term))
    setNotice(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        {value.map((term) => (
          <span key={term} className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
            <span className="truncate">{term}</span>
            <button
              type="button"
              onClick={() => remove(term)}
              disabled={disabled}
              className="rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Remove ${term}`}
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <Input
          id={inputId}
          value={draft}
          onChange={(e) => {
            const next = e.target.value
            if (/[,\n;]/.test(next)) add(next)
            else setDraft(next)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(draft)
            } else if (e.key === 'Backspace' && !draft && value.length > 0) {
              remove(value[value.length - 1])
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text')
            if (/[,\n;]/.test(text)) {
              e.preventDefault()
              add(`${draft}${text}`)
            }
          }}
          disabled={disabled || full}
          placeholder={full ? 'List is full' : value.length === 0 ? 'Type a word and press Enter' : 'Add another'}
          aria-label="Add a word to recognise"
          aria-describedby={describedBy}
          className="h-7 min-w-[10rem] flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
        />
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span aria-live="polite" className={notice ? 'text-amber-700 dark:text-amber-400' : undefined}>
          {notice ?? 'Separate words with Enter or commas.'}
        </span>
        <span>
          {value.length}/{KEYTERM_MAX_COUNT} words · {totalChars}/{KEYTERM_MAX_TOTAL_CHARS} characters
        </span>
      </div>
    </div>
  )
}
