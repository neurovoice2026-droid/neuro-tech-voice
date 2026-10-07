'use client'

// The agent being edited on /agent. Every save goes through PATCH /api/agent,
// which stores the change and pushes it to the voice provider. A provider
// failure does not fail the save: it comes back in `sync`, and the user is told
// plainly that the provider was not updated (with a Retry).

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage, parseApiError } from '@/hooks/useVoiceCatalog'
import {
  readAfterHours,
  readAnalysisSettings,
  readConversationSettings,
  readDynamicVariables,
  readPrivacySettings,
  readTransferSettings,
  readWorkingHours,
} from '@/lib/voice-providers/settings'
import type {
  AnalysisSettings,
  ConversationSettings,
  PrivacySettings,
  TransferSettings,
  VoiceTuning,
} from '@/lib/voice-providers/types'
import type { AfterHoursConfig, WorkingHours } from '@/lib/voice-providers/working-hours'
import type { Agent, VoiceProviderId } from '@/types'

// ─── API contract (PATCH /api/agent) ─────────────────────────────────────────

export interface AgentPatch {
  name?: string
  language?: string
  system_prompt?: string | null
  first_message?: string | null
  fallback_message?: string | null
  is_active?: boolean
  working_hours?: WorkingHours
  metadata?: { personality: string }
  conversation_settings?: ConversationSettings
  after_hours?: AfterHoursConfig
  transfer_settings?: TransferSettings
  analysis_settings?: AnalysisSettings
  /** retention_days omitted: the stored value is kept (absent when never saved, see PATCH /api/agent). */
  privacy_settings?: Pick<PrivacySettings, 'record_audio'> & Partial<Pick<PrivacySettings, 'retention_days'>>
  voice_settings?: VoiceTuning
  dynamic_variables?: Record<string, string>
  fallback_voice_id?: string | null
  organization?: { timezone?: string; voice_fallback_enabled?: boolean }
}

export interface ProviderSyncReport {
  provider: VoiceProviderId
  status: 'pending' | 'ready' | 'failed' | 'degraded' | 'in_progress' | 'skipped'
  error: string | null
}

export interface AgentPatchResponse {
  agent: Agent
  sync: ProviderSyncReport[]
}

// ─── Reading stored settings (lenient, legacy-aware) ─────────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function legacyBehavior(agent: Agent): Record<string, unknown> | null {
  return asRecord(asRecord(agent.metadata)?.behavior_settings)
}

/**
 * The agent's settings as the dashboard edits them. Behaviour switches used to
 * live in metadata.behavior_settings; they are read from there until the
 * agent has its own conversation_settings.
 */
export function readAgentSettings(agent: Agent) {
  const stored = asRecord(agent.conversation_settings)
  const legacy = legacyBehavior(agent)
  const conversationRaw = stored && Object.keys(stored).length > 0 ? stored : legacy
  const legacyRecordCalls = stored?.record_calls ?? legacy?.record_calls
  return {
    conversation: readConversationSettings(conversationRaw),
    transfer: readTransferSettings(agent.transfer_settings),
    analysis: readAnalysisSettings(agent.analysis_settings),
    privacy: readPrivacySettings(agent.privacy_settings, legacyRecordCalls),
    afterHours: readAfterHours(agent.after_hours),
    workingHours: readWorkingHours(agent.working_hours),
    dynamicVariables: readDynamicVariables(agent.dynamic_variables),
  }
}

export type AgentSettings = ReturnType<typeof readAgentSettings>

// ─── Errors ──────────────────────────────────────────────────────────────────

/** First field error of a 400 `{ details: [{ path, message }] }` response, if any. */
async function fieldErrorOf(res: Response): Promise<string | null> {
  // A non-JSON error body simply has no field details.
  const body: unknown = await res.json().catch(() => null)
  const details = asRecord(body)?.details
  if (!Array.isArray(details)) return null
  const first = asRecord(details[0])
  if (!first || typeof first.message !== 'string') return null
  return typeof first.path === 'string' && first.path ? `${first.path}: ${first.message}` : first.message
}

function syncProblem(sync: ProviderSyncReport[] | undefined): ProviderSyncReport | null {
  return sync?.find((s) => s.status === 'failed' || s.status === 'degraded') ?? null
}

function withoutTrailingStop(text: string): string {
  return text.trim().replace(/[.\s]+$/, '')
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseAgentOptions {
  /** Called after every successful save/toggle (e.g. refresh the provider status). */
  onSaved?: () => void
  /** Forced re-sync used by the "Retry" toast action; defaults to POST /api/agent/sync. */
  retrySync?: () => Promise<boolean>
}

export function useAgent(initialAgent: Agent | null, options: UseAgentOptions = {}) {
  const { onSaved, retrySync } = options
  const [agent, setAgent] = useState<Agent | null>(initialAgent)
  const [isSaving, setIsSaving] = useState(false)
  const [isTogglingActive, setIsTogglingActive] = useState(false)

  // A new server render (router.refresh) replaces the local copy.
  const [lastInitial, setLastInitial] = useState(initialAgent)
  if (initialAgent !== lastInitial) {
    setLastInitial(initialAgent)
    setAgent(initialAgent)
  }

  const runRetry = useCallback(async () => {
    if (retrySync) {
      await retrySync()
      return
    }
    try {
      const res = await fetch('/api/agent/sync', { method: 'POST', headers: { Accept: 'application/json' } })
      if (!res.ok) throw await parseApiError(res, 'The voice provider could not be updated. Please try again.')
      toast.success('Sync requested')
      onSaved?.()
    } catch (err) {
      toast.error('Sync failed', { description: errorMessage(err, 'Please try again in a moment.') })
    }
  }, [retrySync, onSaved])

  /** Tells the user when the change was saved but the provider was not updated. */
  const reportSync = useCallback(
    (sync: ProviderSyncReport[] | undefined): boolean => {
      const problem = syncProblem(sync)
      if (!problem) return false
      const reason = withoutTrailingStop(problem.error ?? 'the provider did not confirm the change')
      toast.warning(`Saved, but the voice provider was not updated: ${reason}. It will be retried automatically.`, {
        duration: 10_000,
        action: { label: 'Retry', onClick: () => void runRetry() },
      })
      return true
    },
    [runRetry],
  )

  /** PATCH /api/agent. Returns the saved agent, or null when nothing was saved. */
  const save = useCallback(
    async (payload: AgentPatch, successMsg: string | null): Promise<Agent | null> => {
      setIsSaving(true)
      try {
        const res = await fetch('/api/agent', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const field = res.status === 400 ? await fieldErrorOf(res.clone()) : null
          const err = await parseApiError(res, 'Failed to save changes.')
          toast.error(err.message, field ? { description: field } : undefined)
          return null
        }
        const json = (await res.json()) as AgentPatchResponse
        setAgent(json.agent)
        const warned = reportSync(json.sync)
        if (!warned && successMsg) toast.success(successMsg)
        onSaved?.()
        return json.agent
      } catch (err) {
        toast.error('Changes not saved', { description: errorMessage(err, 'Please try again.') })
        return null
      } finally {
        setIsSaving(false)
      }
    },
    [reportSync, onSaved],
  )

  const update = useCallback((payload: AgentPatch) => save(payload, null), [save])

  const updateWithToast = useCallback(
    (payload: AgentPatch, successMsg = 'Changes saved') => save(payload, successMsg),
    [save],
  )

  /** Replaces the local agent with one returned by another endpoint (e.g. PUT /api/agent/voice). */
  const replaceAgent = useCallback(
    (next: Agent) => {
      setAgent(next)
      onSaved?.()
    },
    [onSaved],
  )

  const toggleActive = useCallback(async () => {
    if (!agent || isTogglingActive) return
    const next = !agent.is_active
    setAgent((a) => (a ? { ...a, is_active: next } : a))
    setIsTogglingActive(true)
    try {
      const res = await fetch('/api/agent/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ is_active: next }),
      })
      if (!res.ok) throw await parseApiError(res, 'Failed to update the agent status.')
      const json = (await res.json()) as Partial<AgentPatchResponse>
      if (json.agent) setAgent(json.agent)
      if (!reportSync(json.sync)) toast.success(next ? 'Agent is now active' : 'Agent paused')
      onSaved?.()
    } catch (err) {
      setAgent((a) => (a ? { ...a, is_active: !next } : a))
      toast.error('Could not change the agent status', { description: errorMessage(err, 'Please try again.') })
    } finally {
      setIsTogglingActive(false)
    }
  }, [agent, isTogglingActive, reportSync, onSaved])

  return {
    agent,
    isSaving,
    isTogglingActive,
    update,
    updateWithToast,
    replaceAgent,
    toggleActive,
  }
}

export type AgentHook = ReturnType<typeof useAgent>
