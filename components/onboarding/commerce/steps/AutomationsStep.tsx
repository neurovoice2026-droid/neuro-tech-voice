'use client'

// Step 4 — Automatizări: the three templates of the connection, from
// GET /api/commerce/automations. Enabling none is fine; each change is saved
// at once through PUT /api/commerce/automations/[type].

import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Info } from 'lucide-react'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AUTOMATION_TYPES, type AutomationDto } from '@/lib/commerce/types'
import { useCommerceOnboardingStore } from '@/store/useCommerceOnboardingStore'
import { StepActions, StepBody } from '../../StepIndicator'
import { commerceErrorMessage, isAbort, requestJson } from '../api'
import { AutomationCard } from '../AutomationCard'
import { isLiveConnection } from '../hooks'
import { useCommerceNavigation } from '../navigation'
import { CommerceStepHeader, ErrorBlock, LoadingBlock } from '../shared'

export function AutomationsStep() {
  const connection = useCommerceOnboardingStore((s) => s.connection)
  const automations = useCommerceOnboardingStore((s) => s.automations)
  const setAutomations = useCommerceOnboardingStore((s) => s.setAutomations)
  const upsertAutomation = useCommerceOnboardingStore((s) => s.upsertAutomation)
  const storeTimezone = useCommerceOnboardingStore((s) => s.profile.timezone)
  const { goTo } = useCommerceNavigation()

  const connectionId = isLiveConnection(connection) ? connection.id : null
  const [load, setLoad] = useState<{ loaded: boolean; error: string | null }>({ loaded: false, error: null })
  const [reloadKey, setReloadKey] = useState(0)

  // A retry clears the error here (not inside the effect) and re-runs the load.
  function retry() {
    setLoad((prev) => ({ ...prev, error: null }))
    setReloadKey((k) => k + 1)
  }

  useEffect(() => {
    if (!connectionId) return
    const ctrl = new AbortController()
    const params = new URLSearchParams({ connection_id: connectionId })
    requestJson<{ items: AutomationDto[] }>(`/api/commerce/automations?${params}`, { signal: ctrl.signal, fallback: 'Automatizările nu au putut fi încărcate.' })
      .then((data) => {
        if (ctrl.signal.aborted) return
        setAutomations(data.items)
        setLoad({ loaded: true, error: null })
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || isAbort(err)) return
        setLoad((prev) => ({ loaded: prev.loaded, error: commerceErrorMessage(err, 'Automatizările nu au putut fi încărcate.') }))
      })
    return () => ctrl.abort()
  }, [connectionId, reloadKey, setAutomations])

  // Catalog order, so the cards never jump when one is saved.
  const ordered = AUTOMATION_TYPES.map((t) => automations.find((a) => a.type === t)).filter((a): a is AutomationDto => !!a)
  const enabledCount = ordered.filter((a) => a.enabled).length

  return (
    <div>
      <CommerceStepHeader
        step={4}
        title="Ce apeluri să facă agentul?"
        description="Fiecare automatizare sună clienții magazinului într-un interval ales, cu limite zilnice. Le poți porni și mai târziu, din Magazin → Automatizări."
      />

      <StepBody className="space-y-4">
        {!connectionId && (
          <Alert>
            <Info aria-hidden="true" />
            <AlertDescription>Automatizările au nevoie de un magazin conectat.</AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={() => goTo(3)}>
                Conectează magazinul
              </Button>
            </AlertAction>
          </Alert>
        )}

        {connectionId && !load.loaded && !load.error && <LoadingBlock label="Se încarcă automatizările…" className="min-h-[200px]" />}
        {connectionId && load.error && !load.loaded && (
          <ErrorBlock title="Automatizările nu au putut fi încărcate" message={load.error} onRetry={retry} />
        )}

        {connectionId && load.loaded && ordered.length === 0 && (
          <Alert>
            <Info aria-hidden="true" />
            <AlertDescription>Nu există încă șabloane de automatizare pentru această conexiune.</AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={retry}>
                Reîncarcă
              </Button>
            </AlertAction>
          </Alert>
        )}

        {connectionId &&
          ordered.map((automation) => (
            <AutomationCard key={automation.type} automation={automation} connectionId={connectionId} storeTimezone={storeTimezone} onChange={upsertAutomation} />
          ))}

        {connectionId && load.loaded && ordered.length > 0 && (
          <p className="text-[13px] leading-[19px] text-muted-foreground" aria-live="polite">
            {enabledCount === 0
              ? 'Nicio automatizare activă. Poți continua și le poți porni după lansare.'
              : `${enabledCount} ${enabledCount === 1 ? 'automatizare activă' : 'automatizări active'}. Apelurile pornesc după lansare.`}
          </p>
        )}
      </StepBody>

      <StepActions>
        <Button type="button" variant="ghost" size="lg" onClick={() => goTo(3)}>
          <ArrowLeft aria-hidden="true" />
          Înapoi
        </Button>
        <Button type="button" size="lg" onClick={() => goTo(5)} disabled={!connectionId} className="ml-auto max-md:flex-1">
          Continuă
          <ArrowRight aria-hidden="true" />
        </Button>
      </StepActions>
    </div>
  )
}
