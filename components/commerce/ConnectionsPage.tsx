'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plug, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CommerceCardError } from './ListScaffold'
import { OptionCard } from '@/components/shared/OptionCard'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { StatusChip } from '@/components/shared/StatusChip'
import { pickCurrentConnection, useCommerceConnections, useConnectionPolling } from '@/hooks/useCommerceConnections'
import { PLATFORM_CATALOG, PLATFORM_ORDER } from '@/lib/commerce/platforms'
import type { CommercePlatform, ConnectionDto } from '@/lib/commerce/types'
import { ConnectForm } from './ConnectForm'
import { ConnectionCard } from './ConnectionCard'

/** The Shopify callback's `?error=` codes, in the merchant's words; anything else shows the code. */
const OAUTH_ERROR: Record<string, string> = {
  access_denied: 'Instalarea aplicației a fost refuzată în Shopify.',
  invalid_shop: 'Domeniul magazinului nu este valid.',
  state_mismatch: 'Sesiunea de conectare a expirat. Pornește din nou conectarea.',
  not_configured: 'Aplicația Shopify nu este configurată pe platformă. Contactează echipa de suport.',
  hmac_invalid: 'Răspunsul Shopify nu a putut fi verificat. Pornește din nou conectarea.',
  token_exchange_failed: 'Shopify nu a emis tokenul de acces. Încearcă din nou.',
}

/** The Shopify start / callback return (`?connected=1`, `?error=`), read once and cleared from the URL. */
function useOauthReturn(onConnected: () => void) {
  const searchParams = useSearchParams()
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    if (!connected && !error) return
    if (connected) {
      toast.success('Magazinul Shopify a fost conectat', { description: 'Sincronizarea inițială a pornit.' })
      onConnected()
    }
    if (error) toast.error('Conectarea cu Shopify a eșuat', { description: OAUTH_ERROR[error] ?? `Cod: ${error}`, duration: 10_000 })
    const url = new URL(window.location.href)
    url.searchParams.delete('connected')
    url.searchParams.delete('error')
    window.history.replaceState({}, '', url.toString())
  }, [searchParams, onConnected])
}

interface ReconnectTarget {
  platform: CommercePlatform
  prefill: { store_url: string; display_name: string | null }
}

export function ConnectionsPage() {
  const { connections, isLoading, error, refetch, replaceConnection } = useCommerceConnections()
  const [platform, setPlatform] = useState<CommercePlatform | null>(null)
  const [reconnect, setReconnect] = useState<ReconnectTarget | null>(null)

  useOauthReturn(refetch)

  const current = useMemo(() => pickCurrentConnection(connections), [connections])
  const { timedOut } = useConnectionPolling(current, replaceConnection)
  const live = connections.filter((c) => c.status !== 'disconnected' && c.status !== 'draft')
  const showConnect = !isLoading && live.length === 0

  const handleConnected = useCallback(
    (connection: ConnectionDto) => {
      replaceConnection(connection)
      setPlatform(null)
      setReconnect(null)
      toast.success('Magazinul a fost conectat', { description: 'Sincronizarea inițială a pornit; o poți urmări mai jos.' })
    },
    [replaceConnection],
  )

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Magazin"
        title="Conexiuni"
        description="Platforma magazinului, ce poate citi și cum se sincronizează."
        meta={
          !isLoading && live.length > 0 ? (
            <StatusChip tone="success" dot className="tabular-nums">
              {live.length === 1 ? '1 magazin conectat' : `${live.length} magazine conectate`}
            </StatusChip>
          ) : undefined
        }
      />

      <div className="space-y-10">
        {isLoading ? (
          <Card className="py-0">
            <OrbLoader label="Se încarcă conexiunile…" className="min-h-[320px]" />
          </Card>
        ) : error && connections.length === 0 ? (
          <Card className="gap-0 py-0">
            <CommerceCardError message="Conexiunile nu au putut fi încărcate." detail={error} onRetry={refetch} className="py-8" />
          </Card>
        ) : (
          connections.length > 0 && (
            <section aria-labelledby="connections-list" className="space-y-4">
              <SectionHeading title={<span id="connections-list">Magazinul tău</span>} />
              {error && (
                <Card className="gap-0 py-0">
                  <CommerceCardError role="status" message="Lista nu a putut fi reîmprospătată." detail={error} onRetry={refetch} />
                </Card>
              )}
              {connections.map((connection) => (
                <ConnectionCard
                  key={connection.id}
                  connection={connection}
                  onChanged={replaceConnection}
                  syncTimedOut={current?.id === connection.id && timedOut}
                  onReconnect={(c) =>
                    setReconnect({ platform: c.platform, prefill: { store_url: c.store_url, display_name: c.display_name } })
                  }
                />
              ))}
            </section>
          )
        )}

        {showConnect && (
          <section aria-labelledby="connect-store">
            <SectionHeading
              title={<span id="connect-store">Conectează un magazin</span>}
              description="Alege platforma; fiecare card spune ce citește conectorul și ce nu poate face."
            />
            <div role="radiogroup" aria-labelledby="connect-store" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {PLATFORM_ORDER.map((id) => {
                const descriptor = PLATFORM_CATALOG[id]
                return (
                  <OptionCard
                    key={id}
                    selected={platform === id}
                    onSelect={() => setPlatform(id)}
                    icon={Plug}
                    title={descriptor.name}
                    description={descriptor.tagline}
                    className="min-h-[120px]"
                  />
                )
              })}
            </div>

            {platform && (
              <Card className="mt-6 gap-0 py-0">
                <div className="border-b border-rule px-5 py-4">
                  <h3 className="text-[15px] leading-[22px] font-medium text-foreground">{PLATFORM_CATALOG[platform].name}</h3>
                  <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">{PLATFORM_CATALOG[platform].howItWorks}</p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">Ce citește</p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-[19px] text-foreground/80">
                        {PLATFORM_CATALOG[platform].reads.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">Limite</p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-[19px] text-muted-foreground">
                        {PLATFORM_CATALOG[platform].limits.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <ConnectForm platform={platform} mode="connect" onConnected={handleConnected} onCancel={() => setPlatform(null)} returnTo="magazin" />
                </div>
              </Card>
            )}

            <p className="mt-4 flex max-w-[760px] items-start gap-2 text-xs leading-[18px] text-muted-foreground">
              <ShieldCheck aria-hidden className="mt-px size-3.5 shrink-0" />
              Cheile de acces sunt criptate la salvare și nu mai pot fi citite din panou. Conectorul citește doar comenzi, clienți și produse; nu modifică nimic în magazin.
            </p>
          </section>
        )}
      </div>

      <Dialog open={reconnect !== null} onOpenChange={(open) => !open && setReconnect(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Reconectează magazinul</DialogTitle>
            <DialogDescription>
              {reconnect ? PLATFORM_CATALOG[reconnect.platform].name : ''} · Noile chei le înlocuiesc pe cele vechi; datele sincronizate rămân.
            </DialogDescription>
          </DialogHeader>
          {reconnect && (
            <ConnectForm
              platform={reconnect.platform}
              mode="reconnect"
              prefill={reconnect.prefill}
              onConnected={handleConnected}
              onCancel={() => setReconnect(null)}
              returnTo="magazin"
            />
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
