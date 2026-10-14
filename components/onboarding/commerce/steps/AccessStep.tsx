'use client'

// Step 3 — Access & sync: connect the chosen platform (keys or the Shopify
// install), then watch the first sync. Continue needs an active connection
// (a degraded one passes with a warning).

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
        title={descriptor ? `Connect ${descriptor.name}` : 'Connect your store'}
        description={live ? 'Follow the first sync and check what the connection can do.' : descriptor?.howItWorks}
      />

      <StepBody className="space-y-6">
        {oauth?.kind === 'connected' && (
          <Alert variant="success">
            <CheckCircle2 aria-hidden="true" />
            <AlertTitle>Your Shopify store is connected</AlertTitle>
            <AlertDescription>The first sync is starting now; its status appears below.</AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={dismissOauth}>
                Got it
              </Button>
            </AlertAction>
          </Alert>
        )}
        {oauth?.kind === 'error' && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>The Shopify connection failed</AlertTitle>
            <AlertDescription>{oauthErrorMessage(oauth.code)}</AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={dismissOauth}>
                Try again
              </Button>
            </AlertAction>
          </Alert>
        )}

        {!descriptor && (
          <Alert>
            <Info aria-hidden="true" />
            <AlertDescription>Choose your store platform first.</AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={() => goTo(2)}>
                Choose a platform
              </Button>
            </AlertAction>
          </Alert>
        )}

        {connection?.status === 'disconnected' && (
          <Alert>
            <Info aria-hidden="true" />
            <AlertDescription>
              Your store <strong>{connection.store_domain}</strong> ({platformName(connection.platform)}) was disconnected. You can connect it again below.
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
              The connection is partially working. You can continue; the automations that depend on what is missing will show as unavailable.
            </AlertDescription>
          </Alert>
        )}
        {live && (connection.status === 'connecting' || connection.status === 'error') && (
          <p className="text-[13px] leading-[19px] text-muted-foreground">
            {connection.status === 'error'
              ? 'Fix the connection problem (or disconnect and connect again) to continue.'
              : 'You can continue as soon as the connection is active.'}
          </p>
        )}
      </StepBody>

      <StepActions>
        <Button type="button" variant="ghost" size="lg" onClick={() => goTo(2)}>
          <ArrowLeft aria-hidden="true" />
          Back
        </Button>
        <Button type="button" size="lg" onClick={() => goTo(4)} disabled={!canContinue} className="ml-auto max-md:flex-1">
          Continue
          <ArrowRight aria-hidden="true" />
        </Button>
      </StepActions>
    </div>
  )
}
