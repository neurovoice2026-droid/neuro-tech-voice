'use client'

// Provider status of the org's agent (GET /api/agent/status): primary and
// backup voice agents, the voice and every number's routing. Polls lightly,
// and only while something is still pending/saving, with a bounded budget so
// a resource that never settles (e.g. a provider not configured in this
// deployment) does not keep the page polling forever.

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage, isAbortError, parseApiError } from '@/hooks/useVoiceCatalog'
import type { AgentStatusView, ProviderResourceView } from '@/types'

const POLL_MS = 5_000
/** About two minutes of polling per "something changed" episode. */
const POLL_BUDGET = 24

export const PROVIDER_LABEL: Record<ProviderResourceView['provider'], string> = {
  elevenlabs: 'ElevenLabs',
  cartesia: 'Cartesia',
}

/** True while a provider, the voice or a number's routing is still settling. */
export function statusIsSettling(view: AgentStatusView | null): boolean {
  if (!view) return false
  if (view.providers.some((p) => p.status === 'pending')) return true
  if (view.voice.status === 'saving' || view.voice.status === 'pending') return true
  return view.numbers.some((n) => n.routing_status === 'pending')
}

/** First provider problem worth showing (failed or degraded), if any. */
export function providerProblem(view: AgentStatusView | null): ProviderResourceView | null {
  return view?.providers.find((p) => p.status === 'failed' || p.status === 'degraded') ?? null
}

export interface AgentStatusHook {
  status: AgentStatusView | null
  isLoading: boolean
  /** Message of the last failed status read (null once a read succeeds). */
  error: string | null
  isRetrying: boolean
  /** Re-reads the status and restarts the polling budget. */
  refetch: () => Promise<AgentStatusView | null>
  /** POST /api/agent/sync (forced re-sync), then shows the outcome. */
  retry: () => Promise<boolean>
}

export function useAgentStatus(): AgentStatusHook {
  const [status, setStatus] = useState<AgentStatusView | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [pollsLeft, setPollsLeft] = useState(POLL_BUDGET)

  const controllerRef = useRef<AbortController | null>(null)
  // Responses that arrive after a newer request started are ignored.
  const sequenceRef = useRef(0)

  const load = useCallback(async (): Promise<AgentStatusView | null> => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const sequence = ++sequenceRef.current
    try {
      const res = await fetch('/api/agent/status', {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw await parseApiError(res, 'Could not load the provider status.')
      const view = (await res.json()) as AgentStatusView
      if (sequence !== sequenceRef.current) return view
      setStatus(view)
      setError(null)
      return view
    } catch (err) {
      if (isAbortError(err) || sequence !== sequenceRef.current) return null
      setError(errorMessage(err, 'Could not load the provider status.'))
      return null
    } finally {
      if (sequence === sequenceRef.current) {
        setIsLoading(false)
        if (controllerRef.current === controller) controllerRef.current = null
      }
    }
  }, [])

  const refetch = useCallback(async () => {
    setPollsLeft(POLL_BUDGET)
    return load()
  }, [load])

  // Initial read; abort whatever is in flight on unmount.
  useEffect(() => {
    void load()
    return () => {
      sequenceRef.current += 1
      controllerRef.current?.abort()
    }
  }, [load])

  // Background tabs do not poll (and do not spend the budget).
  const [pageVisible, setPageVisible] = useState(true)
  useEffect(() => {
    const onVisibilityChange = () => setPageVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // Light polling while something is pending/saving.
  const settling = statusIsSettling(status)
  useEffect(() => {
    if (!settling || pollsLeft <= 0 || isRetrying || !pageVisible) return
    const timer = setTimeout(() => {
      setPollsLeft((n) => n - 1)
      void load()
    }, POLL_MS)
    return () => clearTimeout(timer)
  }, [settling, pollsLeft, isRetrying, pageVisible, load])

  const retry = useCallback(async (): Promise<boolean> => {
    setIsRetrying(true)
    try {
      const res = await fetch('/api/agent/sync', {
        method: 'POST',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        const err = await parseApiError(res, 'The voice provider could not be updated. Please try again.')
        if (err.status === 429) {
          toast.warning(err.message, {
            description: err.retryAfter ? `You can retry in about ${err.retryAfter} seconds.` : undefined,
          })
        } else {
          toast.error('Sync failed', { description: err.message })
        }
        return false
      }
      const view = (await res.json()) as AgentStatusView
      sequenceRef.current += 1
      setStatus(view)
      setError(null)
      setPollsLeft(POLL_BUDGET)
      const problem = providerProblem(view)
      if (problem) {
        toast.error(`${PROVIDER_LABEL[problem.provider]} is still not up to date`, {
          description: problem.last_error ?? 'It will be retried automatically.',
        })
        return false
      }
      toast.success('Voice providers are up to date')
      return true
    } catch (err) {
      toast.error('Sync failed', { description: errorMessage(err, 'Please try again in a moment.') })
      return false
    } finally {
      setIsRetrying(false)
    }
  }, [])

  return { status, isLoading, error, isRetrying, refetch, retry }
}
