'use client'

import { useId, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TEMPLATE_VARIABLES } from '@/lib/workflows/templates'
import { cn } from '@/lib/utils'

interface TemplateFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  rows?: number
  placeholder?: string
  maxLength?: number
  error?: string
  hint?: string
  /** Variables worth offering for this field (defaults to all). */
  variables?: string[]
  showCount?: boolean
}

/**
 * Text with {{variables}}. Chips insert a variable where the cursor is, so
 * owners never have to type the braces themselves.
 */
export function TemplateField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 4,
  placeholder,
  maxLength,
  error,
  hint,
  variables,
  showCount = false,
}: TemplateFieldProps) {
  const id = useId()
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const offered = variables ? TEMPLATE_VARIABLES.filter((v) => variables.includes(v.key)) : TEMPLATE_VARIABLES

  function insert(key: string) {
    const token = `{{${key}}}`
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`
    if (maxLength && next.length > maxLength) return
    onChange(next)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const caret = start + token.length
      el.setSelectionRange(caret, caret)
    })
  }

  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  const shared = {
    id,
    value,
    placeholder,
    maxLength,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    className: 'text-sm',
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
        {showCount && maxLength ? (
          <span className={cn('text-[11px] tabular-nums text-muted-foreground', value.length > maxLength * 0.9 && 'text-amber-600')}>
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>
      {multiline ? (
        <Textarea ref={ref} rows={rows} onChange={(e) => onChange(e.target.value)} {...shared} />
      ) : (
        <Input ref={ref} onChange={(e) => onChange(e.target.value)} {...shared} />
      )}
      <div className="flex flex-wrap gap-1" role="group" aria-label={`Insert a variable into ${label}`}>
        {offered.map((variable) => (
          <button
            key={variable.key}
            type="button"
            onClick={() => insert(variable.key)}
            title={`Example: ${variable.example}`}
            className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {variable.label}
          </button>
        ))}
      </div>
      {hint && !error ? <p id={`${id}-hint`} className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p> : null}
      {error ? <p id={`${id}-error`} className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  )
}
