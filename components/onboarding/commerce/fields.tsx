'use client'

// Form controls the store onboarding shares: a labelled Select bound to
// react-hook-form (value / onChange / focus on a failed submit). Inputs and
// textareas use the ui kit directly through <Field>.

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  /** Leading element in the item and the trigger (a flag, an icon). */
  icon?: React.ReactNode
}

interface FormSelectProps {
  id: string
  value: string
  onChange: (value: string) => void
  options: ReadonlyArray<SelectOption>
  placeholder?: string
  invalid?: boolean
  /** ids of the hint / error the control is described by (Field's `${id}-hint` / `${id}-error`). */
  describedBy?: string
  disabled?: boolean
  /** Receives the trigger, so a failed submit can focus it (react-hook-form's field.ref). */
  triggerRef?: (el: HTMLButtonElement | null) => void
  className?: string
}

export function FormSelect({ id, value, onChange, options, placeholder, invalid, describedBy, disabled, triggerRef, className }: FormSelectProps) {
  // Base UI reads the trigger's label from `items`; the option icons are rendered in the list.
  const items: Record<string, string> = {}
  for (const o of options) items[o.value] = o.label
  const current = options.find((o) => o.value === value)
  return (
    <Select items={items} value={value || null} onValueChange={(v) => typeof v === 'string' && onChange(v)} disabled={disabled}>
      <SelectTrigger
        id={id}
        ref={triggerRef}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn('h-11 w-full', className)}
      >
        {current?.icon}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.icon}
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
