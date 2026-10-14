'use client'

// Step 3 — Acces și sincronizare: connect the chosen platform (keys or the
// Shopify install), then watch the first sync. Continue needs an active
// connection (a degraded one passes with a warning).

import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Info } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PLATFORM_CATALOG, platformName } from '@/lib/commerce/platforms'
import { useCommerceOnboardingStore } from '@/store/useCommerceOnboardingStore'
import { StepActions, StepBody } from '../../StepIndicator'
import { ConnectionPanel } from '../ConnectionPanel'
import { CredentialsForm } from '../CredentialsForm'
import { ShopifyConnect } from '../ShopifyConnect'
import { oauthErrorMessage } from '../copy'
import { isLiveConnection } from '../hooks'
import { useCommerceNavigation } from '../navigation'
import { CommerceStepHeader } from '../shared'

export function AccessStep() {
  const connection = useCommerceOnboardingStore((s) => s.connection)
  const pickedPlatform = useCommerceOnboardingStore((s) => s.platform)
  const displayName = useCommerceOnboardingStore((s) => s.profile.display_name)
  const setConnection = useCommerceOnboardingStore((s) => s.setConnection)
  const { goTo, oauth, dismissOauth } = useCommerceNavigation()

  // A draft row (no credentials or install yet) gets the connect form, like no connection at all.
  const live = isLiveConnection(connection)
  const platform = live ? connection.platform : pickedPlatform
  const descriptor = platform ? PLATFORM_CATALOG[platform] : null

  const canContinue = live && (connection.status === 'active' || connection.status === 'degraded')

  return (
    <div>
      <CommerceStepHeader
        step={3}
        title={descriptor ? `Conectează ${descriptor.name}` : 'Conectează magazinul'}
        description={live ? 'Urmărește prima sincronizare și verifică ce poate face conexiunea.' : descriptor?.howItWorks}
      />

      <StepBody className="space-y-6">
        {oauth?.kind === 'connected' && (
          <Alert variant="success">
            <CheckCircle2 aria-hidden="true" />
            <AlertTitle>Magazinul Shopify a fost conectat</AlertTitle>
            <AlertDescription>Prima sincronizare pornește acum; starea ei apare mai jos.</AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={dismissOauth}>
                Am înțeles
              </Button>
            </AlertAction>
          </Alert>
        )}
        {oauth?.kind === 'error' && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>Conectarea cu Shopify nu a reușit</AlertTitle>
            <AlertDescription>{oauthErrorMessage(oauth.code)}</AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={dismissOauth}>
                Încearcă din nou
              </Button>
            </AlertAction>
          </Alert>
        )}

        {!descriptor && (
          <Alert>
            <Info aria-hidden="true" />
            <AlertDescription>Alege mai întâi platforma magazinului.</AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={() => goTo(2)}>
                Alege platforma
              </Button>
            </AlertAction>
          </Alert>
        )}

        {connection?.status === 'disconnected' && (
          <Alert>
            <Info aria-hidden="true" />
            <AlertDescription>
              Magazinul <strong>{connection.store_domain}</strong> ({platformName(connection.platform)}) a fost deconectat. Poți conecta din nou mai jos.
            </AlertDescription>
          </Alert>
        )}

        {live && <ConnectionPanel connection={connection} />}

        {!live && descriptor && descriptor.connectMode === 'oauth' && <ShopifyConnect descriptor={descriptor} />}
        {!live && descriptor && descriptor.connectMode === 'credentials' && (
          <CredentialsForm descriptor={descriptor} displayName={displayName} onConnected={setConnection} />
        )}

        {live && connection.status === 'degraded' && (
          <Alert variant="warning">
            <AlertTriangle aria-hidden="true" />
            <AlertDescription>
              Conexiunea funcționează parțial. Poți continua; automatizările care depind de ce lipsește vor apărea ca indisponibile.
            </AlertDescription>
          </Alert>
        )}
        {live && (connection.status === 'connecting' || connection.status === 'error') && (
          <p className="text-[13px] leading-[19px] text-muted-foreground">
            {connection.status === 'error'
              ? 'Rezolvă problema conexiunii (sau deconectează și conectează din nou) ca să continui.'
              : 'Poți continua de îndată ce conexiunea este activă.'}
          </p>
        )}
      </StepBody>

      <StepActions>
        <Button type="button" variant="ghost" size="lg" onClick={() => goTo(2)}>
          <ArrowLeft aria-hidden="true" />
          Înapoi
        </Button>
        <Button type="button" size="lg" onClick={() => goTo(4)} disabled={!canContinue} className="ml-auto max-md:flex-1">
          Continuă
          <ArrowRight aria-hidden="true" />
        </Button>
      </StepActions>
    </div>
  )
}
