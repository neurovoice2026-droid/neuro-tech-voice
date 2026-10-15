'use client'

// The billing page's Minutes section: GET /api/billing/minutes (the period's
// included minutes, the prepaid extra minutes, the packs the plan can buy,
// auto top-up and the last purchases), buying a pack (POST
// /api/billing/minutes/checkout → Stripe Checkout) and saving auto top-up
// (PUT /api/billing/minutes/auto-topup). Server state is the source of truth:
// nothing is kept in browser storage, the last good summary stays on screen
// when a refresh fails.

import { useCallback, useEffect, useState } from 'react'
import type { MinutePack } from '@/lib/billing/minute-packs'
import type { AutoTopUpDto, MinutesSummaryDto } from '@/lib/billing/minutes-summary'

const NETWORK_ERROR = 'The connection failed. Check your internet connection and try again.'
const LOAD_ERROR = 'Your minutes could not be loaded.'
const CHECKOUT_ERROR = 'Could not start checkout.'
const SAVE_ERROR = 'Auto top-up could not be saved.'

/** A failed request to one of the minutes routes: the route's own message, its code and details.reason. */
export class MinutesRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
    readonly reason: string | null = null,
  ) {
    super(message)
    this.name = 'MinutesRequestError'
  }
}

async function readError(res: Response, fallback: string): Promise<MinutesRequestError> {
  let body: unknown = null
  try {
    body = await res.json()
  } catch (err) {
    // Not JSON (a proxy error page, an empty body): the fallback message is all there is.
    if (!(err instanceof SyntaxError || err instanceof TypeError)) throw err
  }
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const message = typeof record.error === 'string' && record.error.trim() ? record.error.trim() : fallback
  const code = typeof record.code === 'string' ? record.code : null
  const details = record.details && typeof record.details === 'object' ? (record.details as Record<string, unknown>) : {}
  const reason = typeof details.reason === 'string' ? details.reason : null
  return new MinutesRequestError(message, res.status, code, reason)
}

/** What a failed minutes request reads as on screen. */
export function minutesErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof MinutesRequestError) return err.message
  if (err instanceof TypeError) return NETWORK_ERROR
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export interface AutoTopUpInput {
  enabled: boolean
  pack: MinutePack
  threshold: number
}

interface State {
  summary: MinutesSummaryDto | null
  loaded: boolean
  error: string | null
}

export function useMinutes() {
  const [state, setState] = useState<State>({ summary: null, loaded: false, error: null })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/billing/minutes', { signal: ctrl.signal, cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) throw await readError(res, LOAD_ERROR)
        return (await res.json()) as MinutesSummaryDto
      })
      .then((summary) => {
        if (!ctrl.signal.aborted) setState({ summary, loaded: true, error: null })
      })
      .catch((e: unknown) => {
        // Aborted: unmounted or replaced by a newer refresh.
        if (ctrl.signal.aborted) return
        setState((prev) => ({ ...prev, loaded: true, error: minutesErrorMessage(e, LOAD_ERROR) }))
      })
    return () => ctrl.abort()
  }, [reloadKey])

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  /**
   * Starts Stripe Checkout for one pack and leaves the page. Throws a
   * MinutesRequestError the caller shows (409 minutes_not_available on the
   * trial, 429, 503 not_configured …).
   */
  const buy = useCallback(async (minutes: MinutePack): Promise<void> => {
    const res = await fetch('/api/billing/minutes/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ minutes }),
    })
    if (!res.ok) throw await readError(res, CHECKOUT_ERROR)
    const body = (await res.json()) as { url?: unknown }
    if (typeof body.url !== 'string' || !/^https?:\/\//i.test(body.url)) throw new MinutesRequestError(CHECKOUT_ERROR, res.status)
    window.location.assign(body.url)
  }, [])

  /** Saves auto top-up; the server's settings replace the summary's. Throws a MinutesRequestError (409 no_payment_method …). */
  const saveAutoTopUp = useCallback(async (input: AutoTopUpInput): Promise<AutoTopUpDto> => {
    const res = await fetch('/api/billing/minutes/auto-topup', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw await readError(res, SAVE_ERROR)
    const autoTopUp = (await res.json()) as AutoTopUpDto
    setState((prev) => (prev.summary ? { ...prev, summary: { ...prev.summary, auto_topup: autoTopUp } } : prev))
    return autoTopUp
  }, [])

  return { summary: state.summary, isLoading: !state.loaded, error: state.error, refresh, buy, saveAutoTopUp }
}

export type UseMinutes = ReturnType<typeof useMinutes>
