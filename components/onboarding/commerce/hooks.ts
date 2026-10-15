'use client'

// Data hooks of the store onboarding, modelled on hooks/useDashboardMetrics:
// AbortController per request, loaded/error state, an explicit refetch, and
// no wait that can last forever (the connection poll has a hard limit).

import { useCallback, useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { unavailablePlatforms } from '@/hooks/useCommerceConnections'
import { useCommerceOnboardingStore, type CommerceOnboardingStateDto } from '@/store/useCommerceOnboardingStore'
import type { CommerceConfigSummary, CommercePlatform, ConnectionDto } from '@/lib/commerce/types'
import { commerceErrorMessage, isAbort, requestJson } from './api'

const STATE_LOAD_FAILED = 'Your store setup could not be loaded.'
const CONNECTION_READ_FAILED = 'The connection status could not be read.'

// ─── GET /api/commerce/onboarding/state → store ───────────────────────────────

interface StateLoad {
  loaded: boolean
  error: string | null
}

/**
 * The platforms this deployment cannot connect yet (the state's `config`,
 * booleans only), kept beside the store mirror: steps 2 and 3 show them as
 * unavailable instead of sending the merchant off to fail after a redirect.
 */
export const usePlatformAvailability = create<{ unavailable: ReadonlySet<CommercePlatform> }>(() => ({ unavailable: new Set() }))

/** Reads the server state into the store on mount (and on refetch). The store is the single mirror. */
export function useCommerceOnboardingState() {
  const hydrate = useCommerceOnboardingStore((s) => s.hydrate)
  const [load, setLoad] = useState<StateLoad>({ loaded: false, error: null })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    requestJson<CommerceOnboardingStateDto & { config?: CommerceConfigSummary }>('/api/commerce/onboarding/state', {
      signal: ctrl.signal,
      fallback: STATE_LOAD_FAILED,
    })
      .then((dto) => {
        if (ctrl.signal.aborted) return
        hydrate(dto)
        usePlatformAvailability.setState({ unavailable: unavailablePlatforms(dto.config) })
        setLoad({ loaded: true, error: null })
      })
      .catch((err: unknown) => {
        // Aborted: unmounted or replaced by a newer refetch.
        if (ctrl.signal.aborted || isAbort(err)) return
        setLoad((prev) => ({ loaded: prev.loaded, error: commerceErrorMessage(err, STATE_LOAD_FAILED) }))
      })
    return () => ctrl.abort()
  }, [hydrate, reloadKey])

  const refetch = useCallback(() => setReloadKey((k) => k + 1), [])
  return { loaded: load.loaded, error: load.error, refetch }
}

// ─── Connection polling (initial sync) ───────────────────────────────────────

export const CONNECTION_POLL_MS = 3_000
/** After this the poll stops and the panel offers "Retry" (never a spinner that stays forever). */
export const CONNECTION_POLL_MAX_MS = 5 * 60_000

/**
 * A connection the steps treat as "there is a store": anything but a draft (the row a start
 * route may create before any credentials or install exist) or a disconnected one. Both of
 * those get the connect form again, never the status panel.
 */
export function isLiveConnection(c: ConnectionDto | null | undefined): c is ConnectionDto {
  return !!c && c.status !== 'draft' && c.status !== 'disconnected'
}

/** True while the server is still establishing the connection or running its first sync. */
export function connectionBusy(c: ConnectionDto | null): boolean {
  if (!c) return false
  if (c.status === 'connecting') return true
  const sync = c.sync?.status
  return sync === 'pending' || sync === 'running'
}

interface PollState {
  /** Polling gave up after CONNECTION_POLL_MAX_MS while the connection was still busy. */
  timedOut: boolean
  error: string | null
}

/**
 * Polls GET /api/commerce/connections/[id] every 3 s while the connection is busy,
 * for at most 5 minutes per attempt, writing each answer to the store.
 */
export function useConnectionPoll(connection: ConnectionDto | null) {
  const setConnection = useCommerceOnboardingStore((s) => s.setConnection)
  const [poll, setPoll] = useState<PollState>({ timedOut: false, error: null })
  // Bumped after every answer (good or bad) so the effect schedules the next tick.
  const [tick, setTick] = useState(0)
  const startedAtRef = useRef<number>(0)

  const id = connection?.id ?? null
  const busy = connectionBusy(connection)

  useEffect(() => {
    if (!id || !busy || poll.timedOut) return
    // The clock starts with the first tick of a busy phase (and restarts on "Retry").
    if (!startedAtRef.current) startedAtRef.current = Date.now()
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      if (Date.now() - startedAtRef.current > CONNECTION_POLL_MAX_MS) {
        setPoll({ timedOut: true, error: null })
        return
      }
      requestJson<{ connection: ConnectionDto }>(`/api/commerce/connections/${encodeURIComponent(id)}`, {
        signal: ctrl.signal,
        fallback: CONNECTION_READ_FAILED,
      })
        .then((data) => {
          if (ctrl.signal.aborted) return
          setConnection(data.connection)
          setPoll({ timedOut: false, error: null })
        })
        .catch((err: unknown) => {
          if (ctrl.signal.aborted || isAbort(err)) return
          // Keep polling on a transient read error; the message stays visible meanwhile.
          setPoll({ timedOut: false, error: commerceErrorMessage(err, CONNECTION_READ_FAILED) })
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setTick((t) => t + 1)
        })
    }, CONNECTION_POLL_MS)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [id, busy, poll.timedOut, tick, setConnection])

  useEffect(() => {
    // Done (not busy any more): the next busy phase starts a fresh clock.
    if (!busy) startedAtRef.current = 0
  }, [busy])

  const restart = useCallback(() => {
    startedAtRef.current = Date.now()
    setPoll({ timedOut: false, error: null })
    setTick((t) => t + 1)
  }, [])

  return { polling: busy && !poll.timedOut, timedOut: poll.timedOut, error: poll.error, restart }
}
