'use client'

import { Phone, Copy, CheckCheck, Loader2, PhoneIncoming } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { errorMessage, parseApiError } from '@/hooks/useVoiceCatalog'
import { normalizeE164 } from '@/lib/phone/e164'
import { formatPhoneNumber } from '@/lib/utils'

/** 202 body of POST /api/agent/test-call. */
interface TestCallResponse {
  status?: string
  message?: string
}

/** After an unconfirmed request the call may still ring: block "Call me" this long (no double calls). */
const UNCONFIRMED_COOLDOWN_SECONDS = 60

interface TestCallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  phoneNumber: string | null
  agentName: string
}

export function TestCallDialog({ open, onOpenChange, phoneNumber, agentName }: TestCallDialogProps) {
  const [copied, setCopied] = useState(false)
  const [toNumber, setToNumber] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [calling, setCalling] = useState(false)
  const [calledNumber, setCalledNumber] = useState<string | null>(null)
  const [unconfirmedNote, setUnconfirmedNote] = useState<string | null>(null)
  const [cooldownLeft, setCooldownLeft] = useState(0)

  // Counts down the wait after an unconfirmed call request (kept while the dialog is closed).
  useEffect(() => {
    if (cooldownLeft <= 0) return
    const id = setTimeout(() => setCooldownLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(id)
  }, [cooldownLeft])

  function copy() {
    if (!phoneNumber) return
    navigator.clipboard.writeText(phoneNumber).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => toast.error('Could not copy the number'),
    )
  }

  async function callMe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (calling || cooldownLeft > 0) return
    const normalized = normalizeE164(toNumber)
    if (!normalized) {
      setInputError('Enter your number in international format, e.g. +40712345678.')
      return
    }
    setInputError(null)
    setUnconfirmedNote(null)
    setCalledNumber(null)
    setCalling(true)
    try {
      const res = await fetch('/api/agent/test-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ to_number: normalized }),
      })
      if (!res.ok) {
        const err = await parseApiError(res, 'The test call could not be started.')
        if (err.status === 429) {
          toast.warning(err.message, {
            description: err.retryAfter
              ? `You can try again in about ${err.retryAfter < 90 ? `${err.retryAfter} seconds` : `${Math.ceil(err.retryAfter / 60)} minutes`}.`
              : undefined,
          })
        } else if (err.status === 400) {
          setInputError(err.message)
        } else {
          // 409: a precondition the server explains (no active number, agent paused, not ready…).
          toast.error('Could not start the test call', { description: err.message })
        }
        return
      }
      const data = (await res.json().catch(() => null)) as TestCallResponse | null
      if (data?.status === 'unconfirmed') {
        // The provider did not confirm the call: it may still ring. Retrying now could call twice.
        const message =
          data.message ||
          'The call request was sent but not confirmed yet. If your phone does not ring within a minute, check the Calls page before trying again.'
        setUnconfirmedNote(message)
        setCooldownLeft(UNCONFIRMED_COOLDOWN_SECONDS)
        toast.warning('Call not confirmed yet', { description: message })
        return
      }
      setCalledNumber(normalized)
      toast.success(`Calling ${formatPhoneNumber(normalized)} now`, { description: `Answer to talk to ${agentName}.` })
    } catch (err) {
      toast.error('Could not start the test call', { description: errorMessage(err, 'Please try again.') })
    } finally {
      setCalling(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setCalledNumber(null)
          setUnconfirmedNote(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-full bg-purple-100 p-1.5">
              <Phone className="h-4 w-4 text-purple-600" aria-hidden="true" />
            </div>
            Test Your Agent
          </DialogTitle>
          <DialogDescription>
            Call your number, or have <strong>{agentName}</strong> call you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {phoneNumber ? (
            <>
              <div className="flex items-center justify-between gap-2 rounded-xl border-2 border-primary/20 bg-purple-50 px-4 py-3 sm:px-5 sm:py-4">
                <span className="font-mono text-lg font-bold text-foreground sm:text-xl">
                  {formatPhoneNumber(phoneNumber)}
                </span>
                <Button size="sm" variant="ghost" onClick={copy} className="gap-1.5" aria-label="Copy your agent's number">
                  {copied ? (
                    <><CheckCheck className="h-4 w-4 text-green-500" aria-hidden="true" /> Copied</>
                  ) : (
                    <><Copy className="h-4 w-4" aria-hidden="true" /> Copy</>
                  )}
                </Button>
              </div>
              <ol className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-purple-500" aria-hidden="true">1.</span>
                  Call the number from any phone
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-purple-500" aria-hidden="true">2.</span>
                  Speak naturally — the agent will respond
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-purple-500" aria-hidden="true">3.</span>
                  The call will appear in your Recent Calls list
                </li>
              </ol>
            </>
          ) : (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              No phone number assigned yet. Add one from the{' '}
              <Link href="/phone" className="underline font-medium">Phone Numbers</Link> page.
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" />
            or
            <Separator className="flex-1" />
          </div>

          <form onSubmit={(e) => void callMe(e)} className="space-y-2" noValidate>
            <Label htmlFor="test-call-number" className="flex items-center gap-1.5">
              <PhoneIncoming className="h-4 w-4 text-purple-600" aria-hidden="true" />
              Call me now
            </Label>
            <p id="test-call-hint" className="text-xs text-muted-foreground">
              Your agent calls this number from your agent line, exactly like a real call.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="test-call-number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+40712345678"
                value={toNumber}
                onChange={(e) => {
                  setToNumber(e.target.value)
                  if (inputError) setInputError(null)
                }}
                disabled={!phoneNumber || calling}
                className="font-mono"
                aria-invalid={inputError ? true : undefined}
                aria-describedby={inputError ? 'test-call-error' : 'test-call-hint'}
              />
              <Button
                type="submit"
                disabled={!phoneNumber || calling || cooldownLeft > 0 || !toNumber.trim()}
                aria-describedby={cooldownLeft > 0 ? 'test-call-cooldown' : undefined}
                className="shrink-0 gap-1.5"
              >
                {calling ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PhoneIncoming className="h-4 w-4" aria-hidden="true" />}
                {calling ? 'Calling…' : 'Call me'}
              </Button>
            </div>
            {inputError && (
              <p id="test-call-error" role="alert" className="text-xs text-destructive">{inputError}</p>
            )}
            {calledNumber && !inputError && (
              <p role="status" className="text-xs text-green-700">
                Calling {formatPhoneNumber(calledNumber)}. Answer to talk to {agentName}.
              </p>
            )}
            {unconfirmedNote && !inputError && (
              <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                {unconfirmedNote}
              </p>
            )}
            {cooldownLeft > 0 && (
              <p id="test-call-cooldown" className="text-xs text-muted-foreground">
                To avoid calling you twice, you can request another call in {cooldownLeft} s.
              </p>
            )}
            {!phoneNumber && (
              <p className="text-xs text-muted-foreground">You need an active phone number before the agent can call you.</p>
            )}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
