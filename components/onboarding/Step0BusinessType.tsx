'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, Briefcase, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { OptionCard } from '@/components/shared/OptionCard'
import type { BusinessType } from '@/types'
import { StepActions, StepBody, StepHeader } from './StepIndicator'

// Step 0 of the onboarding: which flow the organization gets. The choice is
// written through POST /api/onboarding/business-type and the page is then
// re-rendered by the server (router.refresh), which picks the flow from the
// row: the browser never decides which onboarding it shows.

const OPTIONS: ReadonlyArray<{ value: BusinessType; title: string; description: string; icon: typeof Briefcase }> = [
  {
    value: 'services',
    title: 'Firmă de prestări servicii sau alt tip de business',
    description: 'Configurează un agent AI pentru apeluri, programări și întrebări generale.',
    icon: Briefcase,
  },
  {
    value: 'ecommerce',
    title: 'Magazin online',
    description: 'Conectează-ți magazinul și automatizează confirmările de comandă, recuperarea coșurilor și follow-up-urile.',
    icon: ShoppingBag,
  },
]

interface ErrorBody {
  error?: unknown
  code?: unknown
}

type SubmitError = { kind: 'message'; message: string }

export function Step0BusinessType() {
  const router = useRouter()
  const [selected, setSelected] = useState<BusinessType | null>(null)
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
        const message = typeof body?.error === 'string' && body.error ? body.error : 'Alegerea nu a putut fi salvată. Încearcă din nou.'
        if (body?.code === 'precondition_failed') {
          // The type was already chosen (another tab, or onboarding finished): the choice is
          // one-time, so there is nothing to retry here. The refresh lands on the flow the
          // server already decided for this organization.
          toast.info(message)
          startTransition(() => {
            router.refresh()
          })
          return
        }
        setError({ kind: 'message', message })
        toast.error(message)
        return
      }
      startTransition(() => {
        router.refresh()
      })
    } catch {
      const message = 'Eroare de rețea. Verifică conexiunea și încearcă din nou.'
      setError({ kind: 'message', message })
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <StepHeader
        step={0}
        eyebrow="Pasul 0 · Tipul afacerii"
        title="Ce fel de afacere ai?"
        description="Alegerea stabilește pașii de configurare și ce vei vedea în panoul de control."
      />

      <StepBody className="space-y-6">
        <div className="grid gap-2">
          <Label id="business-type-label">Tipul afacerii</Label>
          <div role="radiogroup" aria-labelledby="business-type-label" className="grid gap-3">
            {OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                selected={selected === option.value}
                onSelect={() => setSelected(option.value)}
                icon={option.icon}
                title={option.title}
                description={option.description}
                disabled={busy}
                className="min-h-[96px] p-5"
              />
            ))}
          </div>
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
          loadingText="Se salvează…"
          className="ml-auto max-md:flex-1"
        >
          Continuă
          <ArrowRight aria-hidden="true" />
        </Button>
      </StepActions>
    </div>
  )
}
