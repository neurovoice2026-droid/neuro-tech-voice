'use client'

// A connected store as the server sees it: status, the capabilities the
// adapter actually found (never assumed), webhooks, what was mirrored and
// the sync in progress. Polls while the first sync runs (3 s, 5 min cap).

import { useState } from 'react'
import { AlertTriangle, Check, Clock, Info, Minus, Plug, Unplug } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OrbInline } from '@/components/shared/OrbLoader'
import { StatTile } from '@/components/shared/StatTile'
import { StatusChip } from '@/components/shared/StatusChip'
import { platformName } from '@/lib/commerce/platforms'
import type { CommerceCapabilities, ConnectionDto } from '@/lib/commerce/types'
import { useCommerceOnboardingStore } from '@/store/useCommerceOnboardingStore'
import { cn } from '@/lib/utils'
import { commerceErrorMessage, requestJson } from './api'
import { CAPABILITY_LABELS, CONNECTION_STATUS, SYNC_STATUS, formatDate } from './copy'
import { useConnectionPoll } from './hooks'

interface ConnectionPanelProps {
  connection: ConnectionDto
}

function syncLine(c: ConnectionDto): string {
  const sync = c.sync
  if (!sync || sync.status === 'idle') {
    const last = formatDate(c.last_successful_sync_at)
    return last ? `Ultima sincronizare reușită: ${last}` : SYNC_STATUS.idle
  }
  const kind = sync.kind === 'initial' ? ' inițială' : sync.kind === 'manual' ? ' manuală' : ''
  const counts = Object.entries(sync.counts ?? {})
    .filter(([, n]) => typeof n === 'number' && n > 0)
    .map(([k, n]) => `${n} ${k}`)
    .join(', ')
  return `${SYNC_STATUS[sync.status]}${kind}${counts ? ` · ${counts}` : ''}`
}

function webhookLine(c: ConnectionDto): string {
  if (c.capabilities.webhooks) {
    return c.webhook_topics.length
      ? `Evenimente în timp real active: ${c.webhook_topics.join(', ')}.`
      : 'Platforma acceptă evenimente în timp real; webhook-urile se înregistrează la finalul sincronizării.'
  }
  const minutes = c.capabilities.polling_minutes
  return minutes
    ? `Fără evenimente în timp real: datele se reîmprospătează la fiecare ${minutes} minute.`
    : 'Fără evenimente în timp real: datele se reîmprospătează periodic.'
}

export function ConnectionPanel({ connection }: ConnectionPanelProps) {
  const setConnection = useCommerceOnboardingStore((s) => s.setConnection)
  const { polling, timedOut, error: pollError, restart } = useConnectionPoll(connection)
  const [testing, setTesting] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const status = CONNECTION_STATUS[connection.status]
  const caps: CommerceCapabilities = connection.capabilities

  async function handleTest() {
    if (testing) return
    setTesting(true)
    try {
      const result = await requestJson<{ ok: boolean; message: string }>(`/api/commerce/connections/${encodeURIComponent(connection.id)}/test`, {
        method: 'POST',
        fallback: 'Testul conexiunii nu a putut fi rulat.',
      })
      if (result.ok) toast.success(result.message || 'Conexiunea funcționează.')
      else toast.error(result.message || 'Conexiunea nu a răspuns corect.')
      // The test may have refreshed the stored capabilities / status.
      const fresh = await requestJson<{ connection: ConnectionDto }>(`/api/commerce/connections/${encodeURIComponent(connection.id)}`, {
        fallback: 'Starea conexiunii nu a putut fi citită.',
      })
      setConnection(fresh.connection)
    } catch (err) {
      toast.error(commerceErrorMessage(err, 'Testul conexiunii nu a putut fi rulat.'))
    } finally {
      setTesting(false)
    }
  }

  async function handleDisconnect() {
    if (disconnecting) return
    setDisconnecting(true)
    try {
      const data = await requestJson<{ connection: ConnectionDto }>(`/api/commerce/connections/${encodeURIComponent(connection.id)}/disconnect`, {
        method: 'POST',
        fallback: 'Magazinul nu a putut fi deconectat.',
      })
      setConnection(data.connection)
      setDisconnectOpen(false)
      toast.success('Magazinul a fost deconectat. Datele de acces au fost șterse.')
    } catch (err) {
      toast.error(commerceErrorMessage(err, 'Magazinul nu a putut fi deconectat.'))
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="space-y-5">
      <Card className="gap-0 py-0">
        <CardContent className="space-y-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] leading-[22px] font-medium text-foreground">{connection.display_name || connection.store_domain}</p>
              <p className="text-[13px] leading-[19px] text-muted-foreground">
                {platformName(connection.platform)} · {connection.store_domain}
              </p>
            </div>
            <StatusChip tone={status.tone} dot={!polling} icon={polling ? <OrbInline state="connecting" /> : undefined}>
              {status.label}
            </StatusChip>
          </div>

          {/* Sync state, live while the poll runs. */}
          <p className="flex items-start gap-2 text-[13px] leading-[19px] text-muted-foreground" aria-live="polite">
            <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{syncLine(connection)}</span>
          </p>

          {connection.error_message && (connection.status === 'error' || connection.status === 'degraded') && (
            <Alert variant={connection.status === 'error' ? 'destructive' : 'warning'}>
              <AlertTriangle aria-hidden="true" />
              <AlertDescription>{connection.error_message}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-3 gap-2">
            <StatTile size="sm" label="Produse" value={connection.counts.products.toLocaleString('ro-RO')} loading={polling && connection.counts.products === 0} />
            <StatTile size="sm" label="Clienți" value={connection.counts.customers.toLocaleString('ro-RO')} loading={polling && connection.counts.customers === 0} />
            <StatTile size="sm" label="Comenzi" value={connection.counts.orders.toLocaleString('ro-RO')} loading={polling && connection.counts.orders === 0} />
          </div>

          <div>
            <h3 className="text-[13px] leading-[19px] font-medium text-foreground">Ce poate face conexiunea</h3>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {CAPABILITY_LABELS.map(({ key, label }) => {
                const ok = caps[key] === true
                return (
                  <li key={key} className={cn('flex items-center gap-2 text-[13px] leading-[19px]', ok ? 'text-foreground' : 'text-muted-foreground')}>
                    {ok ? (
                      <Check className="size-3.5 shrink-0 text-success" aria-hidden="true" />
                    ) : (
                      <Minus className="size-3.5 shrink-0" aria-hidden="true" />
                    )}
                    {label}
                    <span className="sr-only">{ok ? ': disponibil' : ': indisponibil'}</span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 flex items-start gap-2 text-[13px] leading-[19px] text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{webhookLine(connection)}</span>
            </p>
            {caps.notes.length > 0 && (
              <ul className="mt-2 space-y-1 text-[13px] leading-[19px] text-muted-foreground">
                {caps.notes.map((note) => (
                  <li key={note} className="flex gap-2">
                    <span aria-hidden="true" className="mt-[7px] size-1 shrink-0 rounded-full bg-current" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
            <Button variant="outline" size="sm" onClick={handleTest} loading={testing} loadingText="Se testează…" disabled={polling}>
              <Plug aria-hidden="true" />
              Testează conexiunea
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDisconnectOpen(true)} className="text-muted-foreground hover:text-destructive">
              <Unplug aria-hidden="true" />
              Deconectează
            </Button>
          </div>
        </CardContent>
      </Card>

      {timedOut && (
        <Alert variant="warning">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Sincronizarea inițială durează mai mult decât de obicei</AlertTitle>
          <AlertDescription>
            Am așteptat 5 minute. Sincronizarea continuă pe server; poți verifica din nou starea sau reveni mai târziu din Magazin → Conexiuni.
          </AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={restart}>
              Reîncearcă
            </Button>
          </AlertAction>
        </Alert>
      )}
      {pollError && !timedOut && (
        <p className="text-[13px] leading-[19px] text-warning" role="status">
          {pollError} Se reîncearcă automat.
        </p>
      )}

      <Dialog open={disconnectOpen} onOpenChange={(open) => !disconnecting && setDisconnectOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deconectezi magazinul?</DialogTitle>
            <DialogDescription>
              Datele de acces vor fi șterse și webhook-urile eliminate; comenzile, clienții și produsele deja sincronizate rămân. Automatizările se opresc până
              reconectezi un magazin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />} disabled={disconnecting}>
              Renunță
            </DialogClose>
            <Button variant="destructive-solid" onClick={handleDisconnect} loading={disconnecting} loadingText="Se deconectează…">
              Deconectează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
