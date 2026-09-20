'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
// The plain validator, not the zod schema: same rules as the API without shipping zod.
import { contactIssueMessages, validateContactInput, type ContactInput } from '@/app/api/contacts/validate'
import { errorMessage, requestJson } from '@/components/skills/request'
import type { EscalationContact } from '@/types'

interface FormState {
  name: string
  role: string
  phone: string
  email: string
  transfer_enabled: boolean
  notify_sms: boolean
  notify_email: boolean
  is_on_call: boolean
  conditions: string
}

function toForm(contact: EscalationContact | null): FormState {
  return {
    name: contact?.name ?? '',
    role: contact?.role ?? '',
    phone: contact?.phone ?? '',
    email: contact?.email ?? '',
    transfer_enabled: contact?.transfer_enabled ?? false,
    notify_sms: contact?.notify_sms ?? false,
    notify_email: contact?.notify_email ?? Boolean(contact?.email),
    is_on_call: contact?.is_on_call ?? false,
    conditions: contact?.conditions ?? '',
  }
}

interface ContactDialogProps {
  open: boolean
  /** null = add a new person. */
  contact: EscalationContact | null
  onOpenChange: (open: boolean) => void
  onSaved: (contact: EscalationContact) => void
}

export function ContactDialog({ open, contact, onOpenChange, onSaved }: ContactDialogProps) {
  const [form, setForm] = useState<FormState>(() => toForm(contact))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  // Reset the form whenever the dialog opens for a different person.
  const [openedFor, setOpenedFor] = useState<{ open: boolean; id: string | null }>({ open, id: contact?.id ?? null })
  if (openedFor.open !== open || openedFor.id !== (contact?.id ?? null)) {
    setOpenedFor({ open, id: contact?.id ?? null })
    if (open) {
      setForm(toForm(contact))
      setSubmitted(false)
    }
  }

  const parsed = validateContactInput(form)
  const errors: Partial<Record<keyof ContactInput, string>> = submitted && !parsed.success ? contactIssueMessages(parsed.issues) : {}
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!parsed.success) return
    setSaving(true)
    try {
      const res = contact
        ? await requestJson<{ contact: EscalationContact }>(`/api/contacts/${contact.id}`, { method: 'PATCH', body: parsed.data })
        : await requestJson<{ contact: EscalationContact }>('/api/contacts', { method: 'POST', body: parsed.data })
      onSaved(res.contact)
      toast.success(contact ? 'Changes saved' : `${res.contact.name} added to your team`)
      onOpenChange(false)
    } catch (error) {
      toast.error(contact ? 'Changes weren’t saved' : 'This person wasn’t added', { description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof ContactInput) => ({
    'aria-invalid': Boolean(errors[key]),
    'aria-describedby': errors[key] ? `contact-${key}-error` : undefined,
  })
  const errorText = (key: keyof ContactInput) =>
    errors[key] ? (
      <p id={`contact-${key}-error`} className="text-xs text-destructive">
        {errors[key]}
      </p>
    ) : null

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{contact ? `Edit ${contact.name}` : 'Add a team member'}</DialogTitle>
            <DialogDescription>
              Your agent can put callers through to this person or alert them, following the instructions you give.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Name</Label>
              <Input id="contact-name" value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" {...field('name')} />
              {errorText('name')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-role">Role (optional)</Label>
              <Input
                id="contact-role"
                value={form.role}
                onChange={(e) => set('role', e.target.value)}
                placeholder="e.g. Manager, On-call technician"
                {...field('role')}
              />
              {errorText('role')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input
                id="contact-phone"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+40 712 345 678"
                autoComplete="off"
                {...field('phone')}
              />
              {errorText('phone') ?? <p className="text-xs text-muted-foreground">With the country code.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="name@business.com"
                autoComplete="off"
                {...field('email')}
              />
              {errorText('email')}
            </div>
          </div>

          <fieldset className="space-y-2.5">
            <legend className="mb-1 text-sm font-medium">What your agent can do</legend>
            <CheckRow
              id="contact-transfer"
              checked={form.transfer_enabled}
              onChange={(v) => set('transfer_enabled', v)}
              label="Put live calls through to this person"
              error={errors.transfer_enabled}
            />
            <CheckRow
              id="contact-sms"
              checked={form.notify_sms}
              onChange={(v) => set('notify_sms', v)}
              label="Text them when a message or urgent call comes in"
              error={errors.notify_sms}
            />
            <CheckRow
              id="contact-email-alerts"
              checked={form.notify_email}
              onChange={(v) => set('notify_email', v)}
              label="Email them when a message or urgent call comes in"
              error={errors.notify_email}
            />
            <CheckRow
              id="contact-on-call"
              checked={form.is_on_call}
              onChange={(v) => set('is_on_call', v)}
              label="On call: the first person to reach when something is urgent"
            />
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="contact-conditions">When should your agent involve them? (optional)</Label>
            <Textarea
              id="contact-conditions"
              value={form.conditions}
              onChange={(e) => set('conditions', e.target.value)}
              rows={2}
              placeholder="e.g. Billing questions, or when a caller asks for the manager"
              className="resize-none"
              {...field('conditions')}
            />
            {errorText('conditions')}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              {saving ? 'Saving…' : contact ? 'Save changes' : 'Add person'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CheckRow({
  id,
  checked,
  onChange,
  label,
  error,
}: {
  id: string
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  error?: string
}) {
  return (
    <div>
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onChange(value === true)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5"
        />
        <Label htmlFor={id} className="text-sm font-normal leading-snug">
          {label}
        </Label>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 pl-6.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
