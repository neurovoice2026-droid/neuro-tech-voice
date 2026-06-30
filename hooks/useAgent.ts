'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import type { Agent } from '@/types'

type PatchPayload = Partial<Pick<
  Agent,
  'name' | 'language' | 'system_prompt' | 'first_message' | 'fallback_message' |
  'is_active' | 'working_hours' | 'voice_id' | 'voice_name' | 'metadata'
>>

export function useAgent(initialAgent: Agent | null) {
  const [agent, setAgent] = useState<Agent | null>(initialAgent)
  const [isSaving, setIsSaving] = useState(false)
  const [isTogglingActive, setIsTogglingActive] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setAgent(initialAgent)
  }, [initialAgent])

  const update = useCallback(async (payload: PatchPayload): Promise<boolean> => {
    if (!agent) return false

    const prev = agent
    setAgent(a => a ? { ...a, ...payload } : a)
    setIsSaving(true)

    try {
      const res = await fetch('/api/agent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        setAgent(prev)
        const data = await res.json() as { error?: string }
        toast.error(data.error ?? 'Failed to save changes')
        return false
      }

      const data = await res.json() as { agent: Agent }
      setAgent(data.agent)
      return true
    } catch {
      setAgent(prev)
      toast.error('Network error — changes not saved')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [agent])

  const updateWithToast = useCallback(async (
    payload: PatchPayload,
    successMsg = 'Changes saved'
  ): Promise<boolean> => {
    const ok = await update(payload)
    if (ok) toast.success(successMsg)
    return ok
  }, [update])

  const toggleActive = useCallback(async () => {
    if (!agent) return
    const newState = !agent.is_active
    const prev = agent

    setAgent(a => a ? { ...a, is_active: newState } : a)
    setIsTogglingActive(true)

    try {
      const res = await fetch('/api/agent/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newState }),
      })

      if (!res.ok) {
        setAgent(prev)
        toast.error('Failed to update agent status')
      } else {
        toast.success(newState ? 'Agent is now active' : 'Agent paused')
      }
    } catch {
      setAgent(prev)
      toast.error('Network error')
    } finally {
      setIsTogglingActive(false)
    }
  }, [agent])

  const updateVoice = useCallback(async (voice_id: string, voice_name: string) => {
    const prev = agent
    setAgent(a => a ? { ...a, voice_id, voice_name } : a)
    setIsSaving(true)

    try {
      const res = await fetch('/api/agent/voice', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_id, voice_name }),
      })

      if (!res.ok) {
        setAgent(prev)
        toast.error('Failed to update voice')
        return false
      }

      toast.success('Voice updated')
      return true
    } catch {
      setAgent(prev)
      toast.error('Network error')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [agent])

  // Auto-save helper with debounce
  const scheduleAutoSave = useCallback((payload: PatchPayload, delay = 1500) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setAgent(a => a ? { ...a, ...payload } : a)
    saveTimeoutRef.current = setTimeout(() => {
      update(payload)
    }, delay)
  }, [update])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  return {
    agent,
    isSaving,
    isTogglingActive,
    update,
    updateWithToast,
    toggleActive,
    updateVoice,
    scheduleAutoSave,
  }
}
