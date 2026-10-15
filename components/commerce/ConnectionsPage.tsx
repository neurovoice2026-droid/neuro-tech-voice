'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plug, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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
import { PLATFORM_CATALOG, PLATFORM_ORDER, PLATFORM_UNAVAILABLE_NOTE } from '@/lib/commerce/platforms'
import type { CommercePlatform, ConnectionDto } from '@/lib/commerce/types'
import { ConnectForm } from './ConnectForm'
import { ConnectionCard } from './ConnectionCard'
import { oauthErrorMessage } from './labels'

/** The Shopify start / callback return (`?connected=1`, `?error=`), read once and cleared from the URL. */
function useOauthReturn(onConnected: () => void) {
  const searchParams = useSearchParams()
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    if (!connected && !error) return
    if (connected) {
      toast.success('Shopify store connected', { description: 'The initial sync has started.' })
      onConnected()
    }
    if (error) toast.error('Connecting to Shopify failed', { description: oauthErrorMessage(error), duration: 10_000 })
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
  const { connections, unavailablePlatforms, isLoading, error, refetch, replaceConnection } = useCommerceConnections()
  const unavailableNote = (id: CommercePlatform) => (unavailablePlatforms.has(id) ? (PLATFORM_UNAVAILABLE_NOTE[id] ?? 'Not available on this platform yet.') : undefined)
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
      toast.success('Store connected', { description: 'The initial sync has started; you can follow it below.' })
    },
    [replaceConnection],
  )

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Store"
        title="Connections"
        description="The store platform, what it can read and how it syncs."
        meta={
          !isLoading && live.length > 0 ? (
            <StatusChip tone="success" dot className="tabular-nums">
              {live.length === 1 ? '1 store connected' : `${live.length} stores connected`}
            </StatusChip>
          ) : undefined
        }
      />

      <div className="space-y-10">
        {isLoading ? (
          <Card className="py-0">
            <OrbLoader label="Loading connections…" className="min-h-[320px]" />
          </Card>
        ) : error && connections.length === 0 ? (
          <Card className="gap-0 py-0">
            <CommerceCardError message="Connections could not be loaded." detail={error} onRetry={refetch} className="py-8" />
          </Card>
        ) : (
          connections.length > 0 && (
            <section aria-labelledby="connections-list" className="space-y-4">
              <SectionHeading title={<span id="connections-list">Your store</span>} />
              {error && (
                <Card className="gap-0 py-0">
                  <CommerceCardError role="status" message="The list could not be refreshed." detail={error} onRetry={refetch} />
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
              title={<span id="connect-store">Connect a store</span>}
              description="Pick the platform; each card says what the connector reads and what it cannot do."
            />
            <div role="radiogroup" aria-labelledby="connect-store" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {PLATFORM_ORDER.map((id) => {
                const descriptor = PLATFORM_CATALOG[id]
                const note = unavailableNote(id)
                return (
                  <OptionCard
                    key={id}
                    selected={platform === id}
                    onSelect={() => setPlatform(id)}
                    icon={Plug}
                    title={descriptor.name}
                    // Said up front, so nobody types a domain and leaves for Shopify only to be sent back.
                    description={note ?? descriptor.tagline}
                    badge={note ? <Badge variant="secondary">Not available yet</Badge> : undefined}
                    disabled={!!note}
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
                      <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">What it reads</p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-[19px] text-foreground/80">
                        {PLATFORM_CATALOG[platform].reads.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">Limits</p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-[19px] text-muted-foreground">
                        {PLATFORM_CATALOG[platform].limits.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <ConnectForm platform={platform} mode="connect" onConnected={handleConnected} onCancel={() => setPlatform(null)} returnTo="store" unavailableNote={unavailableNote(platform)} />
                </div>
              </Card>
            )}

            <p className="mt-4 flex max-w-[760px] items-start gap-2 text-xs leading-[18px] text-muted-foreground">
              <ShieldCheck aria-hidden className="mt-px size-3.5 shrink-0" />
              Access keys are encrypted when saved and can no longer be read from the dashboard. The connector only reads orders, customers and products; it changes nothing in the store.
            </p>
          </section>
        )}
      </div>

      <Dialog open={reconnect !== null} onOpenChange={(open) => !open && setReconnect(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Reconnect the store</DialogTitle>
            <DialogDescription>
              {reconnect ? PLATFORM_CATALOG[reconnect.platform].name : ''} · The new keys replace the old ones; the synced data stays.
            </DialogDescription>
          </DialogHeader>
          {reconnect && (
            <ConnectForm
              platform={reconnect.platform}
              mode="reconnect"
              prefill={reconnect.prefill}
              onConnected={handleConnected}
              onCancel={() => setReconnect(null)}
              returnTo="store"
              unavailableNote={unavailableNote(reconnect.platform)}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
