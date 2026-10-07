'use client'

// Client hooks for the Voice tab: the notice of the agent's current voice
// (retired default voices, library voices being removed) and what the plan
// allows for custom voices (cloning, Voice Design).

import { useEffect, useState } from 'react'
import { isAbortError } from '@/hooks/useVoiceCatalog'
import type { AgentVoiceStatus } from '@/lib/voice-providers/voice-status'

export type CurrentVoiceStatus = Pick<AgentVoiceStatus, 'voice_id' | 'kind' | 'notice'>

/** GET /api/agent/voice for the current voice (re-read when it changes). null while unknown. */
export function useCurrentVoiceNotice(voiceId: string | null): CurrentVoiceStatus | null {
  const key = voiceId ?? 'none'
  const [state, setState] = useState<{ key: string | null; status: CurrentVoiceStatus | null }>({ key: null, status: null })
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/agent/voice', { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`voice status ${res.status}`)
        const data = (await res.json()) as Partial<AgentVoiceStatus>
        setState({ key, status: { voice_id: data.voice_id ?? null, kind: data.kind ?? 'unknown', notice: data.notice ?? null } })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) return
        // The banner is informative only: without a status, show none.
        setState({ key, status: null })
      })
    return () => controller.abort()
  }, [key])
  return state.key === key ? state.status : null
}

export interface CustomVoiceLimits {
  /** Why creating a custom voice is not possible now (plan, limit), or null. */
  unavailableReason: string | null
}

function planName(plan: string): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1)
}

/** GET /api/voices/limits once; `count` is the live number of custom voices shown. */
export function useCustomVoiceLimits(count: number): CustomVoiceLimits {
  const [limits, setLimits] = useState<{ allowed: boolean; required_plan: string; limit: number } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/voices/limits', { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`limits ${res.status}`)
        const data = (await res.json()) as { custom_voices?: { allowed?: boolean; required_plan?: string; limit?: number } }
        const c = data.custom_voices
        if (c && typeof c.allowed === 'boolean' && typeof c.limit === 'number') {
          setLimits({ allowed: c.allowed, required_plan: c.required_plan ?? 'pro', limit: c.limit })
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) return
        // Unknown limits: the server still enforces them and explains a refusal.
        setLimits(null)
      })
    return () => controller.abort()
  }, [])
  if (!limits) return { unavailableReason: null }
  if (!limits.allowed) return { unavailableReason: `Custom voices are available on the ${planName(limits.required_plan)} plan and above.` }
  if (count >= limits.limit) {
    return { unavailableReason: `You have ${limits.limit} custom voice${limits.limit === 1 ? '' : 's'}, the maximum. Delete one to create another.` }
  }
  return { unavailableReason: null }
}
