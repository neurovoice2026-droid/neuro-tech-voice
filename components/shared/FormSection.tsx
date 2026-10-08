import { cloneElement, isValidElement } from 'react'
import { AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface FormSectionProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Extra content in the left column under the description (a chip, a help link). */
  aside?: React.ReactNode
  children: React.ReactNode
  /** Heading level of the title; the look stays the same. */
  as?: 'h2' | 'h3'
  className?: string
}

/** Two-column settings section (label column 220 px, fields right), hairline between sections. */
export function FormSection({ title, description, aside, children, as: Tag = 'h2', className }: FormSectionProps) {
  return (
    <section
      data-slot="form-section"
      className={cn(
        'grid gap-4 border-t border-rule py-8 first:border-t-0 first:pt-0 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10',
        className
      )}
    >
      <div className="min-w-0">
        <Tag className="text-[15px] leading-[22px] font-medium text-foreground">{title}</Tag>
        {description && (
          <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">{description}</p>
        )}
        {aside && <div className="mt-3">{aside}</div>}
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
  )
}

interface FieldProps {
  label: React.ReactNode
  /** id of the control; also used to derive the hint/error ids (`${htmlFor}-hint`, `${htmlFor}-error`). */
  htmlFor?: string
  hint?: React.ReactNode
  error?: React.ReactNode
  /** Shows a muted "Optional" at the right of the label row. */
  optional?: boolean
  /** Right side of the label row (e.g. a "Forgot password?" link). Replaces "Optional". */
  labelAction?: React.ReactNode
  children: React.ReactNode
  className?: string
}

type DescribableProps = {
  'aria-describedby'?: string
  'aria-invalid'?: React.AriaAttributes['aria-invalid']
}

/** Label + control + hint + error (role="alert"). A single Input/Textarea/native child gets aria-describedby/aria-invalid wired. */
export function Field({ label, htmlFor, hint, error, optional, labelAction, children, className }: FieldProps) {
  const hintId = htmlFor && hint ? `${htmlFor}-hint` : undefined
  const errorId = htmlFor && error ? `${htmlFor}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  let control = children
  if (
    isValidElement<DescribableProps>(children) &&
    (typeof children.type === 'string' || children.type === Input || children.type === Textarea)
  ) {
    const own = children.props
    control = cloneElement(children, {
      'aria-describedby': [own['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
      'aria-invalid': error ? true : own['aria-invalid'],
    })
  }

  return (
    <div data-slot="field" className={cn('grid gap-2', className)}>
      <div className="flex min-h-4 items-center justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}</Label>
        {labelAction ?? (optional ? <span className="text-xs leading-4 text-muted-foreground">Optional</span> : null)}
      </div>
      {control}
      {hint && (
        <p id={hintId} className="text-xs leading-4 text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-xs leading-4 text-destructive">
          <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
