'use client'

import { useState } from 'react'
import {
  Check, ExternalLink, KeyRound, PlugZap, RefreshCw, Stethoscope, TriangleAlert, Unplug, Webhook, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { OrbInline } from '@/components/shared/OrbLoader'
import { CommerceApiError, commerceErrorMessage } from '@/hooks/useCommerceApi'
import { disconnectConnection, fetchConnection, syncConnection, testConnection } from '@/hooks/useCommerceConnections'
import { PLATFORM_CATALOG } from '@/lib/commerce/platforms'
import type { CommerceCapabilities, ConnectionDto } from '@/lib/commerce/types'
import { cn } from '@/lib/utils'
import { formatCount, formatDateTime, relativeTime } from './format'
import { SYNC_KIND_LABEL, SYNC_RESOURCE_LABEL, SYNC_STATUS_LABEL, WEBHOOK_ADDRESS_HINT, awaitsStoreSentEvents, resourceCount } from './labels'
import { ConnectionStatusChip } from './StatusChips'
import { WebhookAddress } from './WebhookAddress'

const OVERLINE = 'text-[11px] leading-4 font-medium tracking-[0.12em] uppercase text-muted-foreground'

interface ConnectionCardProps {
  connection: ConnectionDto
  onChanged: (connection: ConnectionDto) => void
  onReconnect: (connection: ConnectionDto) => void
  /** Polling has given up on a long sync (the card says so instead of spinning). */
  syncTimedOut?: boolean
}

type Busy = 'sync' | 'test' | 'disconnect' | null

/** What the connection can actually do, from its stored capabilities (never from the catalog alone). */
function capabilityRows(c: CommerceCapabilities): Array<{ ok: boolean; label: string }> {
  return [
    { ok: c.orders, label: 'Orders' },
    { ok: c.customers, label: 'Customers' },
    { ok: c.products, label: 'Products' },
    {
      ok: c.webhooks,
      label: c.webhooks
        ? 'Real-time events (webhooks)'
        : c.polling_minutes
          ? `No webhooks: periodic sync every ${c.polling_minutes} minutes`
          : 'No webhooks: periodic sync',
    },
    { ok: c.customer_phone, label: c.customer_phone ? 'Customer phone numbers are available' : 'Customer phone numbers are not available' },
    { ok: c.abandoned_carts, label: c.abandoned_carts ? 'Abandoned carts' : 'Abandoned carts unavailable' },
  ]
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={OVERLINE}>{label}</dt>
      <dd className="mt-1 text-sm break-words text-foreground">{children}</dd>
    </div>
  )
}

function When({ iso, never = 'never' }: { iso: string | null; never?: string }) {
  if (!iso) return <span className="text-muted-foreground">{never}</span>
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className="tabular-nums">
      {relativeTime(iso)}
    </time>
  )
}

export function ConnectionCard({ connection, onChanged, onReconnect, syncTimedOut = false }: ConnectionCardProps) {
  const [busy, setBusy] = useState<Busy>(null)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const descriptor = PLATFORM_CATALOG[connection.platform]
  const sync = connection.sync
  const syncing = sync?.status === 'running' || sync?.status === 'pending' || connection.status === 'connecting'
  const disconnected = connection.status === 'disconnected'
  const name = connection.display_name?.trim() || connection.store_domain

  async function refresh() {
    try {
      onChanged(await fetchConnection(connection.id))
    } catch (err) {
      // The action itself succeeded; the next poll or reload shows the new state.
      console.warn('Connection re-read failed', err)
    }
  }

  async function handleSync() {
    setBusy('sync')
    try {
      await syncConnection(connection.id, 'all')
      toast.success('Sync started', { description: 'Orders, customers and products are refreshing in the background.' })
      await refresh()
    } catch (err) {
      if (err instanceof CommerceApiError && err.status === 409) {
        toast.info('A sync is already running', { description: 'Wait for the current sync to finish.' })
        await refresh()
      } else {
        toast.error('The sync could not be started', { description: commerceErrorMessage(err, 'Try again.') })
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleTest() {
    setBusy('test')
    try {
      const result = await testConnection(connection.id)
      if (result.ok) toast.success('The connection works', { description: result.message })
      else toast.warning('The connection has issues', { description: result.message, duration: 10_000 })
      await refresh()
    } catch (err) {
      toast.error('The test could not be run', { description: commerceErrorMessage(err, 'Try again.') })
    } finally {
      setBusy(null)
    }
  }

  async function handleDisconnect() {
    setBusy('disconnect')
    try {
      const next = await disconnectConnection(connection.id)
      onChanged(next)
      setDisconnectOpen(false)
      toast.success('Store disconnected', { description: 'The access keys were erased; the synced data stays until you delete it from Store settings.' })
    } catch (err) {
      toast.error('The store could not be disconnected', { description: commerceErrorMessage(err, 'Try again.') })
    } finally {
      setBusy(null)
    }
  }

  const syncCounts = sync ? Object.entries(sync.counts ?? {}).filter(([, n]) => typeof n === 'number') : []

  return (
    <Card className="gap-0 py-0">
      {/* Header */}
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] leading-[22px] font-medium text-foreground">{name}</h3>
            <ConnectionStatusChip status={connection.status} />
          </div>
          <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">
            {descriptor.name} ·{' '}
            <a
              href={connection.store_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-sm break-all underline decoration-foreground/30 underline-offset-4 outline-none hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
            >
              {connection.store_domain}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {!disconnected && (
            <>
              <Button variant="outline" size="sm" onClick={() => void handleSync()} loading={busy === 'sync'} loadingState="connecting" loadingText="Starting…" disabled={busy !== null && busy !== 'sync'}>
                <RefreshCw aria-hidden="true" />
                Sync now
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleTest()} loading={busy === 'test'} loadingState="solving" loadingText="Testing…" disabled={busy !== null && busy !== 'test'}>
                <Stethoscope aria-hidden="true" />
                Test
              </Button>
            </>
          )}
          <Button variant={disconnected ? 'default' : 'outline'} size="sm" onClick={() => onReconnect(connection)} disabled={busy !== null}>
            <PlugZap aria-hidden="true" />
            Reconnect
          </Button>
          {!disconnected && (
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setDisconnectOpen(true)} disabled={busy !== null}>
              <Unplug aria-hidden="true" />
              Disconnect
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      {connection.error_message && (connection.status === 'error' || connection.status === 'degraded') && (
        <div className="px-5 pb-5">
          <Alert variant={connection.status === 'error' ? 'destructive' : 'warning'}>
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{connection.status === 'error' ? 'The connection has an error' : 'The connection works with issues'}</AlertTitle>
            <AlertDescription>
              {connection.error_message}
              {connection.error_code && <span className="ml-1 font-mono text-xs">({connection.error_code})</span>}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Meta */}
      <div className="border-t border-rule px-5 py-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
          <MetaItem label="Connected">
            <When iso={connection.connected_at} never="—" />
          </MetaItem>
          <MetaItem label="Last successful sync">
            <When iso={connection.last_successful_sync_at} />
          </MetaItem>
          <MetaItem label="Last sync">
            <When iso={connection.last_sync_at} />
          </MetaItem>
          <MetaItem label="Synced data">
            <span className="tabular-nums">
              {(['orders', 'customers', 'products'] as const).map((key) => resourceCount(key, connection.counts[key], formatCount)).join(' · ')}
            </span>
          </MetaItem>
        </dl>

        {/* Sync state */}
        {sync && sync.status !== 'idle' && (
          <div
            role="status"
            className={cn(
              'mt-5 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-2xl p-4 text-[13px] leading-[19px]',
              sync.status === 'failed' ? 'bg-destructive-soft text-destructive' : 'bg-secondary text-foreground',
            )}
          >
            {syncing && !syncTimedOut ? <OrbInline state="connecting" /> : null}
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {SYNC_STATUS_LABEL[sync.status]}
                {sync.kind && <span className="font-normal text-muted-foreground"> · {SYNC_KIND_LABEL[sync.kind]}</span>}
                {sync.resource && <span className="font-normal text-muted-foreground"> · {SYNC_RESOURCE_LABEL[sync.resource]}</span>}
              </p>
              {syncCounts.length > 0 && (
                <p className="mt-0.5 text-muted-foreground tabular-nums">
                  {syncCounts.map(([key, n]) => resourceCount(key, n, formatCount)).join(' · ')}
                </p>
              )}
              {sync.error_message && <p className="mt-0.5">{sync.error_message}</p>}
              {syncTimedOut && (
                <p className="mt-0.5 text-muted-foreground">
                  The sync is taking longer than usual. The page has stopped refreshing on its own; reload it in a few minutes.
                </p>
              )}
              {sync.updated_at && (
                <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                  Updated <When iso={sync.updated_at} />
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Capabilities + webhooks */}
      <div className="grid gap-6 border-t border-rule px-5 py-5 lg:grid-cols-2">
        <div>
          <h4 className={OVERLINE}>What the connection can do</h4>
          <ul className="mt-2.5 space-y-1.5" aria-label="Capabilities">
            {capabilityRows(connection.capabilities).map((row) => (
              <li key={row.label} className="flex items-start gap-2 text-[13px] leading-[19px] text-foreground/80">
                {row.ok ? (
                  <Check aria-hidden className="mt-[3px] size-3.5 shrink-0 text-success-dot" />
                ) : (
                  <X aria-hidden className="mt-[3px] size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className={cn(!row.ok && 'text-muted-foreground')}>{row.label}</span>
              </li>
            ))}
          </ul>
          {connection.capabilities.notes.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs leading-[18px] text-muted-foreground" aria-label="Capability notes">
              {connection.capabilities.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className={cn('flex items-center gap-1.5', OVERLINE)}>
            <Webhook className="size-3.5" aria-hidden="true" />
            Active webhooks
          </h4>
          {connection.webhook_topics.length > 0 ? (
            <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Webhook topics">
              {connection.webhook_topics.map((topic) => (
                <li key={topic}>
                  <Badge variant="outline" className="font-mono text-[11px]">{topic}</Badge>
                </li>
              ))}
            </ul>
          ) : awaitsStoreSentEvents(connection) ? (
            // Merchant-sent deliveries (custom connector): nothing is registered on our side, so the state is
            // whether a verified event has arrived yet.
            <p className="mt-2.5 text-[13px] leading-[19px] text-muted-foreground">
              {connection.webhook_last_delivery_at ? (
                <>
                  Last event received <When iso={connection.webhook_last_delivery_at} />.
                </>
              ) : (
                'Waiting for the first event from your store. Until one arrives, the data refreshes periodically.'
              )}
            </p>
          ) : (
            <p className="mt-2.5 text-[13px] leading-[19px] text-muted-foreground">
              {connection.capabilities.webhooks
                ? 'No webhook registered yet; run a sync or reconnect the store.'
                : 'The platform does not send events; the data refreshes periodically.'}
            </p>
          )}
          {connection.webhook_url && (
            <div className="mt-3">
              <h5 className={OVERLINE}>Webhook address</h5>
              <WebhookAddress url={connection.webhook_url} hint={WEBHOOK_ADDRESS_HINT[connection.platform]} className="mt-1.5" />
            </div>
          )}
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-[18px] text-muted-foreground">
            <KeyRound className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            Access keys are encrypted and never shown again. To change them, reconnect the store.
          </p>
        </div>
      </div>

      <Dialog open={disconnectOpen} onOpenChange={(open) => !busy && setDisconnectOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect the store?</DialogTitle>
            <DialogDescription>
              The access keys are erased and the webhooks unregistered; automations can no longer call. Orders, customers and
              products already synced stay. You can reconnect at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDisconnectOpen(false)} disabled={busy === 'disconnect'}>
              Cancel
            </Button>
            <Button variant="destructive-solid" onClick={() => void handleDisconnect()} loading={busy === 'disconnect'} loadingText="Disconnecting…">
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
