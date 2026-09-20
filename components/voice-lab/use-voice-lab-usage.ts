'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Plan } from '@/types'
import { fetchJson, isAbort, VoiceApiError } from '@/components/voice/api'

export interface ToolAllowance {
  limit: number
  used: number
  remaining: number
}

export interface VoiceLabUsage {
  configured: boolean
  plan: Plan
  period: { start: string; end: string }
  tts: ToolAllowance & { max_chars_per_request: number }
  stt: ToolAllowance & { max_bytes_per_file: number }
}

/** Reads X-Quota-* headers returned by the tool routes. */
export function allowanceFromHeaders(headers: Headers): (ToolAllowance & { resetsAt: string | null }) | null {
  const limit = Number(headers.get('X-Quota-Limit'))
  const used = Number(headers.get('X-Quota-Used'))
  const remaining = Number(headers.get('X-Quota-Remaining'))
  if (![limit, used, remaining].every(Number.isFinite) || headers.get('X-Quota-Limit') === null) return null
  return { limit, used, remaining, resetsAt: headers.get('X-Quota-Resets-At') }
}

export function useVoiceLabUsage() {
  const [usage, setUsage] = useState<VoiceLabUsage | null>(null)
  const [error, setError] = useState<VoiceApiError | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchJson<VoiceLabUsage>('/api/voice-lab/usage', { signal: controller.signal, cache: 'no-store' })
      .then((data) => {
        setUsage(data)
        setError(null)
      })
      .catch((err: unknown) => {
        if (isAbort(err)) return
        setError(err instanceof VoiceApiError ? err : new VoiceApiError(0, 'unknown', 'We couldn’t load your Voice Lab allowance.'))
      })
    return () => controller.abort()
  }, [attempt])

  const retry = useCallback(() => {
    setError(null)
    setUsage(null)
    setAttempt((n) => n + 1)
  }, [])

  /** Applies the allowance a tool route just reported. */
  const applyHeaders = useCallback((kind: 'tts' | 'stt', headers: Headers) => {
    const allowance = allowanceFromHeaders(headers)
    if (!allowance) return
    setUsage((current) =>
      current
        ? {
            ...current,
            period: allowance.resetsAt ? { ...current.period, end: allowance.resetsAt } : current.period,
            [kind]: { ...current[kind], limit: allowance.limit, used: allowance.used, remaining: allowance.remaining },
          }
        : current
    )
  }, [])

  return { usage, error, isLoading: !usage && !error, retry, applyHeaders }
}
