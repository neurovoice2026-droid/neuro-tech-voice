'use client'

// "Call a customer": the agent phones someone from the business's own number
// (POST /api/calls/outbound, paid plans). The dialog explains what's missing
// when a call can't be placed (plan, phone service, number, paused agent)
// instead of letting the request fail.

import Link from 'next/link'
import { useId, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, Loader2, PhoneCall, PhoneOutgoing } from 'lucide-react'
import { toast } from 'sonner'
import { UpgradeNotice } from '@/components/shared/UpgradeNotice'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { parseApiError } from '@/lib/audio/call-protocol'
import { cn, formatPhoneNumber } from '@/lib/utils'
import {
  OUTBOUND_PURPOSE_MAX,
  callingMessage,
  outboundAvailability,
  outboundErrorOutcome,
  validateOutboundInput,
  type OutboundAvailability,
  type OutboundCallSetup,
} from './outbound-call'

interface OutboundCallDialogProps {
  setup: OutboundCallSetup
  /** A call was placed: the list refreshes so its row shows up. */
  onPlaced?: () => void
}

type Status = { name: 'idle' } | { name: 'submitting' } | { name: 'calling'; message: string }

export function OutboundCallDialog({ setup, onPlaced }: OutboundCallDialogProps) {
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState('+')
  const [purpose, setPurpose] = useState('')
  const [fieldError, setFieldError] = useState<{ field: 'to_number' | 'purpose'; message: string } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>({ name: 'idle' })
  // A refusal from the server (plan changed, number released) overrides what the page loaded with.
  const [blocked, setBlocked] = useState<OutboundAvailability['kind'] | null>(null)
  const numberRef = useRef<HTMLInputElement | null>(null)
  const numberId = useId()
  const numberHintId = useId()
  const numberErrorId = useId()
  const purposeId = useId()
  const purposeErrorId = useId()

  const loaded = outboundAvailability(setup)
  const availability: OutboundAvailability =
    blocked && blocked !== 'ready' ? blockedAvailability(blocked, setup) : loaded
  const submitting = status.name === 'submitting'

  function reset() {
    setNumber('+')
    setPurpose('')
    setFieldError(null)
    setFormError(null)
    setStatus({ name: 'idle' })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || availability.kind !== 'ready') return
    const input = validateOutboundInput(number, purpose, availability.from)
    if (!input.ok) {
      setFieldError({ field: input.field, message: input.message })
      if (input.field === 'to_number') numberRef.current?.focus()
      return
    }
    setFieldError(null)
    setFormError(null)
    setStatus({ name: 'submitting' })
    try {
      const response = await fetch('/api/calls/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_number: input.to, ...(input.purpose ? { purpose: input.purpose } : {}) }),
        cache: 'no-store',
      })
      if (response.ok) {
        const message = callingMessage(input.to)
        setStatus({ name: 'calling', message })
        toast.success('Call started', { description: message })
        onPlaced?.()
        return
      }
      const body: unknown = await response.json().catch(() => null)
      const outcome = outboundErrorOutcome(parseApiError(response.status, body))
      setStatus({ name: 'idle' })
      if (outcome.blocking) {
        setBlocked(outcome.blocking)
        return
      }
      if (outcome.field) {
        setFieldError({ field: outcome.field, message: outcome.message })
        numberRef.current?.focus()
      } else {
        setFormError(outcome.message)
      }
    } catch (error) {
      console.warn('[calls] outbound call request failed', error)
      setStatus({ name: 'idle' })
      setFormError('We couldn’t reach Neuro Tech Voice. Check your internet connection and try again.')
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="purple-glow h-10 w-full shrink-0 gap-2 sm:w-auto">
        <PhoneOutgoing aria-hidden="true" />
        Call a customer
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (submitting) return
          setOpen(next)
          if (!next) reset()
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="rounded-full bg-purple-100 p-1.5">
                <PhoneOutgoing aria-hidden="true" className="size-4 text-purple-600" />
              </span>
              Call a customer
            </DialogTitle>
            <DialogDescription>
              Your agent calls them from your business number, says who it is calling for, and handles the conversation like an inbound call.
            </DialogDescription>
          </DialogHeader>

          {availability.kind !== 'ready' ? (
            <BlockedState availability={availability} />
          ) : status.name === 'calling' ? (
            <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <PhoneCall className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{status.message}</span>
            </div>
          ) : (
            <form id={`${numberId}-form`} onSubmit={submit} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor={numberId}>Customer’s phone number</Label>
                <Input
                  ref={numberRef}
                  id={numberId}
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={number}
                  disabled={submitting}
                  onChange={(e) => {
                    setNumber(e.target.value)
                    if (fieldError?.field === 'to_number') setFieldError(null)
                  }}
                  placeholder="+40 712 345 678"
                  aria-invalid={fieldError?.field === 'to_number' ? true : undefined}
                  aria-describedby={fieldError?.field === 'to_number' ? `${numberHintId} ${numberErrorId}` : numberHintId}
                  className="h-10"
                />
                <p id={numberHintId} className="text-xs text-muted-foreground">
                  With the country code. Calls go out from {formatPhoneNumber(availability.from)}.
                </p>
                {fieldError?.field === 'to_number' && (
                  <p id={numberErrorId} className="text-xs text-destructive">
                    {fieldError.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={purposeId}>
                  Reason for the call <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id={purposeId}
                  value={purpose}
                  maxLength={OUTBOUND_PURPOSE_MAX + 50}
                  disabled={submitting}
                  onChange={(e) => {
                    setPurpose(e.target.value)
                    if (fieldError?.field === 'purpose') setFieldError(null)
                  }}
                  placeholder="Confirm tomorrow’s 10:00 appointment and offer another time if it no longer works."
                  aria-invalid={fieldError?.field === 'purpose' ? true : undefined}
                  aria-describedby={fieldError?.field === 'purpose' ? purposeErrorId : undefined}
                  className="min-h-20"
                />
                <p className={cn('text-xs', purpose.trim().length > OUTBOUND_PURPOSE_MAX ? 'text-destructive' : 'text-muted-foreground')}>
                  {fieldError?.field === 'purpose' ? (
                    <span id={purposeErrorId}>{fieldError.message}</span>
                  ) : (
                    `Your agent uses this to open the conversation. ${purpose.trim().length}/${OUTBOUND_PURPOSE_MAX}`
                  )}
                </p>
              </div>

              <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                Only call people who expect to hear from your business. Numbers that asked not to be contacted are skipped, and calls use your plan minutes.
              </p>

              {formError && (
                <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {formError}
                </p>
              )}
            </form>
          )}

          <DialogFooter>
            {availability.kind === 'ready' && status.name === 'calling' ? (
              <>
                <Button variant="outline" onClick={() => setStatus({ name: 'idle' })}>
                  Call someone else
                </Button>
                <Button
                  onClick={() => {
                    setOpen(false)
                    reset()
                  }}
                >
                  Done
                </Button>
              </>
            ) : availability.kind === 'ready' ? (
              <>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" form={`${numberId}-form`} disabled={submitting} className="gap-2">
                  {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <PhoneCall aria-hidden="true" />}
                  {submitting ? 'Placing the call…' : 'Call now'}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function blockedAvailability(kind: OutboundAvailability['kind'], setup: OutboundCallSetup): OutboundAvailability {
  switch (kind) {
    case 'locked':
      return { kind: 'locked', requiredPlan: setup.requiredPlan }
    case 'not_configured':
    case 'no_number':
    case 'no_agent':
    case 'agent_paused':
      return { kind }
    case 'ready':
      return outboundAvailability(setup)
  }
}

function BlockedState({ availability }: { availability: Exclude<OutboundAvailability, { kind: 'ready' }> }) {
  if (availability.kind === 'locked') {
    return (
      <UpgradeNotice
        feature="Calling customers"
        requiredPlan={availability.requiredPlan}
        description="Your agent can call customers back, confirm appointments and follow up on messages from your business number."
      />
    )
  }
  const content = {
    not_configured: {
      title: 'Phone calls aren’t available yet',
      body: 'The phone service isn’t set up on this workspace. Calls your agent answers aren’t affected.',
      link: null,
    },
    no_number: {
      title: 'Your agent needs a phone number',
      body: 'Customers see your business number when your agent calls. Get one first; it only takes a minute.',
      link: { href: '/phone', label: 'Get a number' },
    },
    no_agent: {
      title: 'Set up your agent first',
      body: 'Finish setting up your agent, then it can call customers for you.',
      link: { href: '/agent', label: 'Open agent settings' },
    },
    agent_paused: {
      title: 'Your agent is paused',
      body: 'Turn your agent on before it calls anyone. While it’s paused it doesn’t answer or place calls.',
      link: { href: '/agent', label: 'Turn on your agent' },
    },
  }[availability.kind]
  return (
    <div role="status" className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="flex items-center gap-2 font-medium">
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        {content.title}
      </p>
      <p className="text-amber-800">{content.body}</p>
      {content.link && (
        <Link href={content.link.href} className={cn(buttonVariants({ variant: 'outline' }), 'h-10 bg-white')}>
          {content.link.label}
        </Link>
      )}
    </div>
  )
}
