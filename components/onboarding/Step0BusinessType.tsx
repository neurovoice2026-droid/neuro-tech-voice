'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, Briefcase, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { OptionCard } from '@/components/shared/OptionCard'
import { expiredBusinessIntentCookie, readBusinessIntent } from '@/lib/auth/business-intent'
import type { BusinessType } from '@/types'
import { StepActions, StepBody, StepHeader } from './StepIndicator'

// Step 0 of the onboarding: which flow the organization gets. The choice is
// written through POST /api/onboarding/business-type and the page is then
// re-rendered by the server (router.refresh), which picks the flow from the
// row: the browser never decides which onboarding it shows.
//
// A visitor who signed up from the store plans (/register?intent=store)
// arrives with the intent cookie (lib/auth/business-intent.ts): the "Online
// store" card is pre-selected for them, and nothing more. The owner still
// confirms with a click, and the cookie is dropped once the choice is saved.

export const STEP0_COPY = {
  eyebrow: 'Step 0 · Business type',
  title: 'What kind of business do you run?',
  description: 'Your choice sets the setup steps and what you will see in your dashboard.',
  label: 'Business type',
  options: {
    services: {
      title: 'Service business or anything else',
      description: 'Set up an AI agent for calls, appointments and general questions.',
    },
    ecommerce: {
      title: 'Online store',
      description: 'Connect your store and automate order confirmations, abandoned-cart recovery and delivery follow-ups.',
    },
  },
  suggested: 'Pre-selected from the link you signed up with. Pick the other one if that is not right.',
  continue: 'Continue',
  saving: 'Saving…',
  errors: {
    save: 'Your choice could not be saved. Please try again.',
    network: 'Network error. Check your connection and try again.',
  },
} as const

const OPTIONS: ReadonlyArray<{ value: BusinessType; title: string; description: string; icon: typeof Briefcase }> = [
  { value: 'services', ...STEP0_COPY.options.services, icon: Briefcase },
  { value: 'ecommerce', ...STEP0_COPY.options.ecommerce, icon: ShoppingBag },
]

interface ErrorBody {
  error?: unknown
  code?: unknown
}

type SubmitError = { kind: 'message'; message: string }

// The intent cookie never changes while the step is open, so there is nothing
// to subscribe to; the server snapshot is "none", which keeps hydration exact.
const noSubscription = () => () => {}
const readCookieIntent = () => readBusinessIntent(document.cookie)
const noIntent = () => null

/** The business type the intent cookie suggests, read in the browser only (null on the server and without the cookie). */
function useBusinessIntentCookie(): BusinessType | null {
  return useSyncExternalStore(noSubscription, readCookieIntent, noIntent)
}

export function Step0BusinessType({
  suggested,
}: {
  /** A pre-selection decided elsewhere (the server reading the intent cookie); the browser's own cookie read otherwise. */
  suggested?: BusinessType | null
}) {
  const router = useRouter()
  const cookieIntent = useBusinessIntentCookie()
  const suggestion = suggested ?? cookieIntent
  const [chosen, setChosen] = useState<BusinessType | null>(null)
  // The owner's own click wins; until there is one, the sign-up intent stands pre-selected.
  const selected = chosen ?? suggestion
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<SubmitError | null>(null)
  // The refresh re-renders the page with the chosen flow; the button stays busy until it lands.
  const [isRefreshing, startTransition] = useTransition()
  const busy = submitting || isRefreshing

  async function handleContinue() {
    if (!selected || busy) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding/business-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ business_type: selected }),
      })
      if (!res.ok) {
        // A non-JSON body (proxy page) means "no server message": the generic copy is used.
        const body = (await res.json().catch(() => null)) as ErrorBody | null
        const message = typeof body?.error === 'string' && body.error ? body.error : STEP0_COPY.errors.save
        if (body?.code === 'precondition_failed') {
          // The type was already chosen (another tab, or onboarding finished): the choice is
          // one-time, so there is nothing to retry here. The refresh lands on the flow the
          // server already decided for this organization.
          toast.info(message)
          document.cookie = expiredBusinessIntentCookie()
          startTransition(() => {
            router.refresh()
          })
          return
        }
        setError({ kind: 'message', message })
        toast.error(message)
        return
      }
      // The choice is saved: the sign-up intent has done its job.
      document.cookie = expiredBusinessIntentCookie()
      startTransition(() => {
        router.refresh()
      })
    } catch {
      const message = STEP0_COPY.errors.network
      setError({ kind: 'message', message })
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <StepHeader step={0} eyebrow={STEP0_COPY.eyebrow} title={STEP0_COPY.title} description={STEP0_COPY.description} />

      <StepBody className="space-y-6">
        <div className="grid gap-2">
          <Label id="business-type-label">{STEP0_COPY.label}</Label>
          <div role="radiogroup" aria-labelledby="business-type-label" className="grid gap-3">
            {OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                selected={selected === option.value}
                onSelect={() => setChosen(option.value)}
                icon={option.icon}
                title={option.title}
                description={option.description}
                disabled={busy}
                className="min-h-[96px] p-5"
              />
            ))}
          </div>
          {chosen === null && suggestion && (
            <p className="text-xs leading-4 text-muted-foreground">{STEP0_COPY.suggested}</p>
          )}
        </div>

        {error?.kind === 'message' && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
      </StepBody>

      <StepActions>
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={!selected}
          loading={busy}
          loadingText={STEP0_COPY.saving}
          className="ml-auto max-md:flex-1"
        >
          {STEP0_COPY.continue}
          <ArrowRight aria-hidden="true" />
        </Button>
      </StepActions>
    </div>
  )
}
