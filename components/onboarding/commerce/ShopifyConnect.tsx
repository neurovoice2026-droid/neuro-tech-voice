'use client'

// Shopify connects through an OAuth install: the browser leaves for
// /api/commerce/oauth/shopify/start (a full navigation, the route redirects
// to Shopify) and comes back to /onboarding?commerce=connected or
// ?commerce_error=<code>, which the access step shows.

import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/shared/FormSection'
import type { PlatformDescriptor } from '@/lib/commerce/platforms'
import { normalizeShopDomain, shopifyStartUrl } from './shopify'

interface ShopifyConnectProps {
  descriptor: PlatformDescriptor
}

export function ShopifyConnect({ descriptor }: ShopifyConnectProps) {
  const [shop, setShop] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)

  function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    const domain = normalizeShopDomain(shop)
    if (!domain) {
      setError('Introdu domeniul myshopify.com al magazinului (ex. magazinul-tau.myshopify.com).')
      return
    }
    setError(null)
    setLeaving(true)
    // Full navigation on purpose: the route answers with a redirect to Shopify.
    window.location.assign(shopifyStartUrl(domain))
  }

  return (
    <form onSubmit={handleContinue} noValidate className="space-y-8">
      <section aria-labelledby="shopify-instructions-title" className="rounded-2xl bg-secondary p-5">
        <h3 id="shopify-instructions-title" className="text-[13px] leading-[19px] font-medium text-foreground">
          Cum funcționează instalarea
        </h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-[19px] text-muted-foreground">
          {descriptor.instructions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>

      <Field label="Domeniul magazinului" htmlFor="shop_domain" error={error} hint="Se acceptă și doar numele magazinului; adăugăm noi .myshopify.com.">
        <Input
          id="shop_domain"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="magazinul-tau.myshopify.com"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          disabled={leaving}
          className="h-11"
        />
      </Field>

      <Button type="submit" size="lg" loading={leaving} loadingState="connecting" loadingText="Te trimitem în Shopify…" className="w-full sm:w-auto">
        Continuă în Shopify
        <ArrowUpRight aria-hidden="true" />
      </Button>
    </form>
  )
}
