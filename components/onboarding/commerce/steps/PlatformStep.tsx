'use client'

// Step 2 — Connect your store: which platform. Only the catalog's
// description is shown here (what the connector reads, its truthful limits);
// the real capabilities come from the connection once it exists (step 3).

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Boxes, Code2, ExternalLink, Info, ShoppingBag, ShoppingCart, Store } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { OptionCard } from '@/components/shared/OptionCard'
import { PLATFORM_CATALOG, PLATFORM_ORDER, PLATFORM_UNAVAILABLE_NOTE, platformName } from '@/lib/commerce/platforms'
import type { CommercePlatform } from '@/lib/commerce/types'
import { useCommerceOnboardingStore } from '@/store/useCommerceOnboardingStore'
import { StepActions, StepBody } from '../../StepIndicator'
import { isLiveConnection, usePlatformAvailability } from '../hooks'
import { useCommerceNavigation } from '../navigation'
import { CommerceStepHeader } from '../shared'

const ICONS: Record<CommercePlatform, typeof Store> = {
  woocommerce: Store,
  shopify: ShoppingBag,
  magento: Boxes,
  prestashop: ShoppingCart,
  custom: Code2,
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <h3 className="text-[13px] leading-[19px] font-medium text-foreground">{title}</h3>
      <ul className="mt-1.5 space-y-1 text-[13px] leading-[19px] text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true" className="mt-[7px] size-1 shrink-0 rounded-full bg-current" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PlatformStep() {
  const connection = useCommerceOnboardingStore((s) => s.connection)
  const platform = useCommerceOnboardingStore((s) => s.platform)
  const setPlatform = useCommerceOnboardingStore((s) => s.setPlatform)
  const { goTo } = useCommerceNavigation()
  const unavailable = usePlatformAvailability((s) => s.unavailable)
  const [picked, setSelected] = useState<CommercePlatform | null>(platform)

  // A live connection pins its platform: another store is connected from Store → Connections
  // after disconnecting this one (step 3 offers that). A draft or disconnected row pins nothing.
  const live = isLiveConnection(connection)
  // A pick of a platform this deployment cannot connect is not kept (a live store of it still is).
  const selected = picked && (!unavailable.has(picked) || (live && connection?.platform === picked)) ? picked : null
  const descriptor = selected ? PLATFORM_CATALOG[selected] : null

  function handleContinue() {
    if (!selected) return
    setPlatform(selected)
    goTo(3)
  }

  return (
    <div>
      <CommerceStepHeader
        step={2}
        title="Which platform is your store on?"
        description="Choose a platform to see what the connector reads and what you need to connect it."
      />

      <StepBody className="space-y-6">
        {live && connection && (
          <Alert>
            <Info aria-hidden="true" />
            <AlertDescription>
              Your store <strong>{connection.store_domain}</strong> is already connected through {platformName(connection.platform)}. Continue to see its status.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-2">
          <Label id="platform-label">Store platform</Label>
          <div role="radiogroup" aria-labelledby="platform-label" className="grid gap-2 sm:grid-cols-2">
            {PLATFORM_ORDER.map((id) => {
              const p = PLATFORM_CATALOG[id]
              // Said up front (Shopify without the platform's app), instead of failing after the redirect to Shopify.
              const note = unavailable.has(id) ? (PLATFORM_UNAVAILABLE_NOTE[id] ?? 'Not available on this platform yet.') : null
              return (
                <OptionCard
                  key={id}
                  selected={selected === id}
                  onSelect={() => setSelected(id)}
                  icon={ICONS[id]}
                  title={p.name}
                  description={note ?? p.tagline}
                  badge={<Badge variant="secondary">{note ? 'Not available yet' : p.connectMode === 'oauth' ? 'OAuth install' : 'API keys'}</Badge>}
                  disabled={(live && connection?.platform !== id) || (!!note && !(live && connection?.platform === id))}
                  className={id === 'custom' ? 'sm:col-span-2' : undefined}
                />
              )
            })}
          </div>
        </div>

        {descriptor && (
          <Card size="sm" className="gap-0 py-0">
            <CardContent className="space-y-5 py-5">
              <div>
                <h3 className="text-[15px] leading-[22px] font-medium text-foreground">How it works</h3>
                <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">{descriptor.howItWorks}</p>
              </div>
              <DetailList title="What it reads from your store" items={descriptor.reads} />
              <DetailList title="Limits" items={descriptor.limits} />
              <a
                href={descriptor.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] leading-[19px] font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
              >
                {descriptor.name} documentation
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </CardContent>
          </Card>
        )}
      </StepBody>

      <StepActions>
        <Button type="button" variant="ghost" size="lg" onClick={() => goTo(1)}>
          <ArrowLeft aria-hidden="true" />
          Back
        </Button>
        <Button type="button" size="lg" onClick={handleContinue} disabled={!selected} className="ml-auto max-md:flex-1">
          Continue
          <ArrowRight aria-hidden="true" />
        </Button>
      </StepActions>
    </div>
  )
}
