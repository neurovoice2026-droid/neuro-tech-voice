'use client'

import { AlertCircle, AlertTriangle, CheckCheck, CircleCheck, Copy, Phone, PhoneIncoming } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OrbLoader } from '@/components/shared/OrbLoader'
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

/**
 * How long the "connecting" orb shows after the call was placed. The request is
 * fire-and-forget (no ringing/answered events), so after this the dialog shows a
 * static confirmation instead of an orb that would keep "dialling" forever.
 */
const DIALING_SECONDS = 30

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
  const [dialing, setDialing] = useState(false)

  // The orb gives way to the static confirmation after DIALING_SECONDS.
  useEffect(() => {
    if (!dialing) return
    const id = setTimeout(() => setDialing(false), DIALING_SECONDS * 1000)
    return () => clearTimeout(id)
  }, [dialing])

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
    setDialing(false)
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
      setDialing(true)
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
          setDialing(false)
          setUnconfirmedNote(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test your agent</DialogTitle>
          <DialogDescription>
            Call your number, or have <strong className="font-medium text-foreground">{agentName}</strong> call you.
          </DialogDescription>
        </DialogHeader>

        {/* min-w-0: a grid item of the dialog, so long content shrinks instead of overflowing. */}
        <div className="min-w-0 space-y-5">
          {phoneNumber ? (
            <div className="rounded-2xl bg-secondary p-4">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
                <div className="min-w-0">
                  <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">Your agent&apos;s number</p>
                  <p className="mt-1 text-[20px] leading-7 font-semibold tracking-[-0.01em] whitespace-nowrap text-foreground tabular-nums sm:text-[22px]">
                    {formatPhoneNumber(phoneNumber)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={copy} className="tap-44 shrink-0 max-sm:w-8 max-sm:px-0" aria-label="Copy your agent's number">
                  {copied ? (
                    <><CheckCheck className="text-success-dot" aria-hidden="true" /><span className="max-sm:sr-only">Copied</span></>
                  ) : (
                    <><Copy aria-hidden="true" /><span className="max-sm:sr-only">Copy</span></>
                  )}
                </Button>
              </div>
              <ol className="mt-4 space-y-2 border-t border-border pt-4 text-[13px] leading-[19px] text-foreground">
                {[
                  'Call the number from any phone',
                  'Speak naturally — the agent will respond',
                  'The call will appear in your Recent calls list',
                ].map((step, i) => (
                  <li key={step} className="flex items-start gap-2.5">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-medium text-foreground tabular-nums shadow-hair" aria-hidden="true">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <Alert variant="warning">
              <Phone aria-hidden="true" />
              <AlertDescription>
                No phone number assigned yet. Add one from the{' '}
                <Link href="/phone" className="font-medium">Phone numbers</Link> page.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-rule" />
            <span className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">or</span>
            <span className="h-px flex-1 bg-rule" />
          </div>

          <form onSubmit={(e) => void callMe(e)} className="space-y-2" noValidate>
            <Label htmlFor="test-call-number" className="gap-1.5">
              <PhoneIncoming className="size-3.5 text-muted-foreground" aria-hidden="true" />
              Call me now
            </Label>
            <p id="test-call-hint" className="text-xs leading-4 text-muted-foreground">
              Your agent calls this number from your agent line, exactly like a real call.
            </p>
            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
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
                className="tabular-nums"
                aria-invalid={inputError ? true : undefined}
                aria-describedby={inputError ? 'test-call-error' : 'test-call-hint'}
              />
              <Button
                type="submit"
                disabled={!phoneNumber || cooldownLeft > 0 || !toNumber.trim()}
                loading={calling}
                loadingState="connecting"
                loadingText="Calling…"
                aria-describedby={cooldownLeft > 0 ? 'test-call-cooldown' : undefined}
                className="h-10 shrink-0"
              >
                <PhoneIncoming aria-hidden="true" />
                Call me
              </Button>
            </div>
            {inputError && (
              <p id="test-call-error" role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                {inputError}
              </p>
            )}
            {calledNumber && !inputError && (dialing ? (
              // The phone is being dialled: the connecting orb on a tinted stage.
              <OrbLoader
                state="connecting"
                delayMs={0}
                label={`Calling ${formatPhoneNumber(calledNumber)}.`}
                description={`Answer to talk to ${agentName}.`}
                className="mt-3 rounded-2xl bg-secondary px-4 py-6"
              />
            ) : (
              // Then a static confirmation: no ringing/answered events come back.
              <div role="status" className="mt-3 flex items-start gap-3 rounded-2xl bg-secondary px-4 py-3.5">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success-dot" aria-hidden="true" />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[13px] leading-[19px] text-foreground">
                    Call placed to <span className="tabular-nums">{formatPhoneNumber(calledNumber)}</span>.
                  </p>
                  <p className="text-xs leading-4 text-muted-foreground">Answer to talk to {agentName}.</p>
                </div>
              </div>
            ))}
            {unconfirmedNote && !inputError && (
              <Alert variant="warning" role="status" className="mt-3">
                <AlertTriangle aria-hidden="true" />
                <AlertDescription>{unconfirmedNote}</AlertDescription>
              </Alert>
            )}
            {cooldownLeft > 0 && (
              <p id="test-call-cooldown" className="text-xs text-muted-foreground tabular-nums">
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
