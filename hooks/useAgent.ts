'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import type { Agent, ProviderSyncState, WorkingHours } from '@/types'
import type { AgentPatchInput } from '@/lib/voice/sync/schemas'
import { mergeAgentPatchBodies } from '@/lib/voice/sync/agent-update'

/**
 * PATCH /api/agent body. Metadata and working hours also accept the stored
 * shapes, since settings screens send back what they loaded; the server
 * validates and merges them.
 */
export type AgentUpdate = Omit<AgentPatchInput, 'metadata' | 'working_hours'> & {
  metadata?: AgentPatchInput['metadata'] | Record<string, unknown>
  working_hours?: AgentPatchInput['working_hours'] | WorkingHours
}

const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = 30_000

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: unknown } | string }
    if (typeof body.error === 'string' && body.error) return body.error
    if (body.error && typeof body.error === 'object' && typeof body.error.message === 'string' && body.error.message) {
      return body.error.message
    }
  } catch {
    // Not JSON (proxy error page, network cut mid-body): use the fallback.
  }
  return fallback
}

export function isSyncPending(state: ProviderSyncState | null | undefined): boolean {
  return state?.cartesia?.status === 'pending' || state?.elevenlabs?.status === 'pending'
}

/** Readable problems from the last sync, voice agent first. */
export function syncProblems(state: ProviderSyncState | null | undefined): string[] {
  return [state?.cartesia, state?.elevenlabs]
    .filter((entry) => entry?.status === 'error' && !!entry.error)
    .map((entry) => entry!.error as string)
}

/** What the agent looks like once the server applies the update (metadata and working hours merge). */
export function applyAgentUpdate(agent: Agent, payload: AgentUpdate): Agent {
  const { metadata, working_hours, ...fields } = payload
  const next = { ...agent, ...fields } as Agent
  if (metadata) next.metadata = { ...agent.metadata, ...metadata }
  if (working_hours) next.working_hours = { ...agent.working_hours, ...working_hours } as WorkingHours
  return next
}

export function useAgent(initialAgent: Agent | null) {
  const [agent, setAgent] = useState<Agent | null>(initialAgent)
  const [isSaving, setIsSaving] = useState(false)
  const [isTogglingActive, setIsTogglingActive] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isWaitingForSync, setIsWaitingForSync] = useState(false)

  const agentRef = useRef<Agent | null>(initialAgent)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingAutoSaveRef = useRef<AgentUpdate | null>(null)
  const updateRef = useRef<((payload: AgentUpdate) => Promise<boolean>) | null>(null)
  const unmountedRef = useRef(false)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollGenerationRef = useRef(0)

  const commit = useCallback((next: Agent | null | ((current: Agent | null) => Agent | null)) => {
    const value = typeof next === 'function' ? next(agentRef.current) : next
    agentRef.current = value
    setAgent(value)
  }, [])

  useEffect(() => {
    agentRef.current = initialAgent
    setAgent(initialAgent)
  }, [initialAgent])

  const stopPolling = useCallback(() => {
    pollGenerationRef.current += 1
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    pollTimerRef.current = null
    setIsWaitingForSync(false)
  }, [])

  const reportSync = useCallback((state: ProviderSyncState) => {
    const problems = syncProblems(state)
    if (problems.length > 0) {
      toast.warning('Your changes are saved, but the voice agent couldn’t be fully updated', {
        description: problems[0],
      })
    }
  }, [])

  // After a save the providers update in the background; poll until they finish.
  const watchSync = useCallback(() => {
    stopPolling()
    // A save flushed while leaving the page must not keep polling afterwards.
    if (unmountedRef.current) return
    const generation = pollGenerationRef.current
    const deadline = Date.now() + POLL_TIMEOUT_MS
    setIsWaitingForSync(true)

    const tick = async () => {
      if (generation !== pollGenerationRef.current) return
      try {
        const res = await fetch('/api/agent/sync', { cache: 'no-store' })
        if (generation !== pollGenerationRef.current) return
        if (res.ok) {
          const { provider_sync } = (await res.json()) as { provider_sync: ProviderSyncState }
          commit((current) => (current ? { ...current, provider_sync } : current))
          if (!isSyncPending(provider_sync)) {
            setIsWaitingForSync(false)
            reportSync(provider_sync)
            return
          }
        }
      } catch {
        // A dropped poll is retried on the next tick.
      }
      if (Date.now() >= deadline) {
        setIsWaitingForSync(false)
        toast.info('Your changes are saved. The voice agent is still updating and will be ready shortly.')
        return
      }
      pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS)
    }
    pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS)
  }, [commit, reportSync, stopPolling])

  const update = useCallback(async (payload: AgentUpdate): Promise<boolean> => {
    const previous = agentRef.current
    if (!previous) return false

    commit(applyAgentUpdate(previous, payload))
    setIsSaving(true)
    try {
      const res = await fetch('/api/agent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        commit(previous)
        toast.error(await errorMessage(res, 'We couldn’t save your changes. Please try again.'))
        return false
      }
      const data = (await res.json()) as { agent: Agent; provider_sync: ProviderSyncState }
      commit(data.agent)
      if (isSyncPending(data.provider_sync)) watchSync()
      return true
    } catch {
      commit(previous)
      toast.error('We couldn’t reach the server, so your changes weren’t saved. Check your connection and try again.')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [commit, watchSync])

  const updateWithToast = useCallback(async (
    payload: AgentUpdate,
    successMsg = 'Changes saved'
  ): Promise<boolean> => {
    const ok = await update(payload)
    if (ok) toast.success(successMsg)
    return ok
  }, [update])

  const toggleActive = useCallback(async () => {
    const previous = agentRef.current
    if (!previous) return
    const isActive = !previous.is_active

    commit({ ...previous, is_active: isActive })
    setIsTogglingActive(true)
    try {
      const res = await fetch('/api/agent/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      })
      if (!res.ok) {
        commit(previous)
        toast.error(await errorMessage(res, 'We couldn’t change your agent’s status. Please try again.'))
        return
      }
      toast.success(isActive ? 'Your agent is answering calls again' : 'Your agent is paused and won’t answer calls')
    } catch {
      commit(previous)
      toast.error('We couldn’t reach the server. Check your connection and try again.')
    } finally {
      setIsTogglingActive(false)
    }
  }, [commit])

  /** Sets the agent's Cartesia voice. */
  const updateVoice = useCallback(async (voiceId: string, voiceName: string): Promise<boolean> => {
    const previous = agentRef.current
    if (!previous) return false

    commit({ ...previous, cartesia_voice_id: voiceId, cartesia_voice_name: voiceName })
    setIsSaving(true)
    try {
      const res = await fetch('/api/agent/voice', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartesia_voice_id: voiceId, cartesia_voice_name: voiceName }),
      })
      if (!res.ok) {
        commit(previous)
        toast.error(await errorMessage(res, 'We couldn’t change the voice. Please try again.'))
        return false
      }
      const data = (await res.json()) as { agent: Agent; provider_sync: ProviderSyncState }
      commit((current) => (current ? { ...current, ...data.agent } : data.agent))
      toast.success('Voice updated')
      if (isSyncPending(data.provider_sync)) watchSync()
      return true
    } catch {
      commit(previous)
      toast.error('We couldn’t reach the server, so the voice wasn’t changed. Check your connection and try again.')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [commit, watchSync])

  /** Pushes the whole configuration to the voice providers now and waits for the result. */
  const resync = useCallback(async (): Promise<boolean> => {
    if (!agentRef.current) return false
    stopPolling()
    setIsSyncing(true)
    try {
      const res = await fetch('/api/agent/sync', { method: 'POST' })
      if (!res.ok) {
        toast.error(await errorMessage(res, 'We couldn’t update the voice agent. Please try again.'))
        return false
      }
      const { provider_sync } = (await res.json()) as { provider_sync: ProviderSyncState }
      commit((current) => (current ? { ...current, provider_sync } : current))
      const problems = syncProblems(provider_sync)
      if (problems.length > 0) {
        toast.warning('The voice agent couldn’t be fully updated', { description: problems[0] })
        return false
      }
      if (isSyncPending(provider_sync)) {
        // Another update was already running; follow it to the end.
        watchSync()
        return true
      }
      toast.success('Voice agent is up to date')
      return true
    } catch {
      toast.error('We couldn’t reach the server. Check your connection and try again.')
      return false
    } finally {
      setIsSyncing(false)
    }
  }, [commit, stopPolling, watchSync])

  useEffect(() => {
    updateRef.current = update
  }, [update])

  // Debounced auto-save. Edits made while the timer runs are merged into one
  // request, so a quick second change never drops the first.
  const scheduleAutoSave = useCallback((payload: AgentUpdate, delay = 1500) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    pendingAutoSaveRef.current = pendingAutoSaveRef.current
      ? mergeAgentPatchBodies(pendingAutoSaveRef.current, payload)
      : payload
    commit((current) => (current ? applyAgentUpdate(current, payload) : current))
    saveTimeoutRef.current = setTimeout(() => {
      const pending = pendingAutoSaveRef.current
      pendingAutoSaveRef.current = null
      saveTimeoutRef.current = null
      if (pending) void update(pending)
    }, delay)
  }, [commit, update])

  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      // Leaving the page within the debounce window still saves the last edits.
      const pending = pendingAutoSaveRef.current
      pendingAutoSaveRef.current = null
      if (pending) void updateRef.current?.(pending)
      pollGenerationRef.current += 1
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  return {
    agent,
    providerSync: agent?.provider_sync ?? {},
    isSaving,
    isTogglingActive,
    /** A manual "update now" is running. */
    isSyncing,
    /** Waiting for the background provider update after a save. */
    isWaitingForSync,
    update,
    updateWithToast,
    toggleActive,
    updateVoice,
    resync,
    scheduleAutoSave,
  }
}
