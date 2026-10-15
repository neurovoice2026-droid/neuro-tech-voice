'use client'

// Shopify connects through an OAuth install: the browser leaves for
// /api/commerce/oauth/shopify/start (a full navigation, the route redirects
// to Shopify) and comes back to /onboarding?commerce=connected or
// ?commerce_error=<code>, which the access step shows.

import { useState } from 'react'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/shared/FormSection'
import { PLATFORM_UNAVAILABLE_NOTE, type PlatformDescriptor } from '@/lib/commerce/platforms'
import { usePlatformAvailability } from './hooks'
import { normalizeShopDomain, shopifyStartUrl } from './shopify'

interface ShopifyConnectProps {
  descriptor: PlatformDescriptor
}

export function ShopifyConnect({ descriptor }: ShopifyConnectProps) {
  const [shop, setShop] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  // The Shopify app is not configured on this deployment: the start route would only send the browser back.
  const unavailable = usePlatformAvailability((s) => s.unavailable.has('shopify'))

  function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    if (unavailable) return
    const domain = normalizeShopDomain(shop)
    if (!domain) {
      setError('Enter your store’s myshopify.com domain (e.g. your-store.myshopify.com).')
      return
    }
    setError(null)
    setLeaving(true)
    // Full navigation on purpose: the route answers with a redirect to Shopify.
    window.location.assign(shopifyStartUrl(domain))
  }

  return (
    <form onSubmit={handleContinue} noValidate className="space-y-8">
      {unavailable && (
        <Alert variant="warning">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Shopify cannot be connected yet</AlertTitle>
          <AlertDescription>{PLATFORM_UNAVAILABLE_NOTE.shopify}</AlertDescription>
        </Alert>
      )}
      <section aria-labelledby="shopify-instructions-title" className="rounded-2xl bg-secondary p-5">
        <h3 id="shopify-instructions-title" className="text-[13px] leading-[19px] font-medium text-foreground">
          How the install works
        </h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-[19px] text-muted-foreground">
          {descriptor.instructions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>

      <Field label="Store domain" htmlFor="shop_domain" error={error} hint="The store name alone works too; we add .myshopify.com for you.">
        <Input
          id="shop_domain"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="your-store.myshopify.com"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          disabled={leaving || unavailable}
          className="h-11"
        />
      </Field>

      <Button type="submit" size="lg" loading={leaving} loadingState="connecting" loadingText="Taking you to Shopify…" disabled={unavailable} className="w-full sm:w-auto">
        Continue in Shopify
        <ArrowUpRight aria-hidden="true" />
      </Button>
    </form>
  )
}
