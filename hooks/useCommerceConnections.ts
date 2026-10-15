'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ShopifyReturnKey } from '@/lib/commerce/shopify-state'
import type { CommerceCapabilities, CommerceConfigSummary, CommercePlatform, ConnectionDto, SyncResource } from '@/lib/commerce/types'
import { commerceRequest, useCommerceQuery } from './useCommerceApi'

const LIST_PATH = '/api/commerce/connections'

function connectionPath(id: string, suffix = ''): string {
  return `${LIST_PATH}/${encodeURIComponent(id)}${suffix}`
}

/**
 * Platforms this deployment cannot connect yet, from the server's `config`
 * (booleans only): Shopify needs the platform's Shopify app. Unknown (an
 * older answer without `config`) blocks nothing.
 */
export function unavailablePlatforms(config: Partial<CommerceConfigSummary> | null | undefined): ReadonlySet<CommercePlatform> {
  return new Set<CommercePlatform>(config?.shopify === false ? ['shopify'] : [])
}

/** The organization's store connections (one today; the list stays a list for the day there are more). */
export function useCommerceConnections() {
  const query = useCommerceQuery<{ items: ConnectionDto[]; config?: CommerceConfigSummary }>(LIST_PATH, { fallback: 'Connections could not be loaded.' })
  const { setData } = query

  const replaceConnection = useCallback(
    (connection: ConnectionDto) =>
      setData((prev) => {
        if (!prev) return { items: [connection] }
        const exists = prev.items.some((c) => c.id === connection.id)
        return { ...prev, items: exists ? prev.items.map((c) => (c.id === connection.id ? connection : c)) : [connection, ...prev.items] }
      }),
    [setData],
  )

  const removeConnection = useCallback(
    (id: string) => setData((prev) => (prev ? { ...prev, items: prev.items.filter((c) => c.id !== id) } : prev)),
    [setData],
  )

  const config = query.data?.config
  const unavailable = useMemo(() => unavailablePlatforms(config), [config])

  return {
    connections: query.data?.items ?? [],
    /** Platforms that cannot be connected on this deployment (shown disabled, with the reason). */
    unavailablePlatforms: unavailable,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    replaceConnection,
    removeConnection,
  }
}

/** The connection the record pages and automations work on: the live one, else the most recent. */
export function pickCurrentConnection(connections: ConnectionDto[]): ConnectionDto | null {
  return connections.find((c) => c.status !== 'disconnected' && c.status !== 'draft') ?? connections[0] ?? null
}

export function useCurrentConnection() {
  const list = useCommerceConnections()
  const connection = useMemo(() => pickCurrentConnection(list.connections), [list.connections])
  return { ...list, connection }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export interface CreateConnectionBody {
  platform: CommercePlatform
  store_url: string
  display_name?: string
  secrets: Record<string, string>
}

/** The route checks the store's access and registers webhooks before answering: a longer budget than a read. */
const STORE_CHECK_TIMEOUT_MS = 90_000

export async function createConnection(body: CreateConnectionBody): Promise<ConnectionDto> {
  const res = await commerceRequest<{ connection: ConnectionDto }>(LIST_PATH, {
    method: 'POST',
    json: body,
    fallback: 'The store could not be connected.',
    timeoutMs: STORE_CHECK_TIMEOUT_MS,
  })
  return res.connection
}

export async function fetchConnection(id: string, signal?: AbortSignal): Promise<ConnectionDto> {
  const res = await commerceRequest<{ connection: ConnectionDto }>(connectionPath(id), {
    signal,
    fallback: 'The connection could not be read.',
  })
  return res.connection
}

export async function testConnection(id: string): Promise<{ ok: boolean; message: string; capabilities: CommerceCapabilities }> {
  return commerceRequest(connectionPath(id, '/test'), { method: 'POST', json: {}, fallback: 'The connection test failed.', timeoutMs: STORE_CHECK_TIMEOUT_MS })
}

/** 202 queued; a 409 means a sync is already running (the caller reads `err.status`). */
export async function syncConnection(id: string, resource: SyncResource | 'all' = 'all'): Promise<{ queued: boolean }> {
  return commerceRequest(connectionPath(id, '/sync'), { method: 'POST', json: { resource }, fallback: 'The sync could not be started.' })
}

export async function disconnectConnection(id: string): Promise<ConnectionDto> {
  const res = await commerceRequest<{ connection: ConnectionDto }>(connectionPath(id, '/disconnect'), {
    method: 'POST',
    json: {},
    fallback: 'The store could not be disconnected.',
  })
  return res.connection
}

export async function deleteConnection(id: string, confirm: string): Promise<void> {
  await commerceRequest<{ deleted: boolean }>(connectionPath(id), {
    method: 'DELETE',
    json: { confirm },
    fallback: 'The store data could not be deleted.',
  })
}

/** Where the browser goes to install the Shopify app (full-page navigation, never a fetch). */
export function shopifyStartUrl(shopDomain: string, returnTo: ShopifyReturnKey = 'store'): string {
  return `/api/commerce/oauth/shopify/start?shop=${encodeURIComponent(shopDomain)}&return_to=${returnTo}`
}

// ─── Polling during a sync ────────────────────────────────────────────────────

const POLL_MS = 3_000
/** 5 minutes of polling: past that the page says so instead of spinning forever. */
const POLL_LIMIT = 100

export function isSyncInProgress(connection: ConnectionDto | null | undefined): boolean {
  if (!connection) return false
  if (connection.status === 'connecting') return true
  const status = connection.sync?.status
  return status === 'pending' || status === 'running'
}

/**
 * Re-reads a connection every 3 s while a sync runs (the contract's cadence)
 * and hands each row to `onUpdate`. Stops after POLL_LIMIT reads and reports
 * `timedOut`, so a stuck job never leaves a spinner on screen.
 */
export function useConnectionPolling(connection: ConnectionDto | null, onUpdate: (connection: ConnectionDto) => void): { polling: boolean; timedOut: boolean } {
  const active = isSyncInProgress(connection)
  const id = connection?.id ?? null
  const [timedOut, setTimedOut] = useState(false)
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    if (!active || !id) return
    let count = 0
    const ctrl = new AbortController()
    let stopped = false
    // One read at a time: a slow route must not pile up requests on every tick.
    let inFlight = false
    const timer = setInterval(() => {
      if (stopped || inFlight) return
      count += 1
      if (count > POLL_LIMIT) {
        setTimedOut(true)
        clearInterval(timer)
        return
      }
      inFlight = true
      fetchConnection(id, ctrl.signal)
        .then((next) => {
          if (!stopped) onUpdateRef.current(next)
        })
        .catch(() => {
          // A failed poll is retried on the next tick; the page keeps the last row it had.
        })
        .finally(() => {
          inFlight = false
        })
    }, POLL_MS)
    return () => {
      stopped = true
      clearInterval(timer)
      ctrl.abort()
      // The budget belongs to one sync: the next one starts fresh.
      setTimedOut(false)
    }
  }, [active, id])

  return { polling: active && !timedOut, timedOut: active && timedOut }
}
