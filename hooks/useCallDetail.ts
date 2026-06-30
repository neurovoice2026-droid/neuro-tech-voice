'use client'

import { useState, useEffect } from 'react'
import type { Call } from '@/types'

export function useCallDetail(callId: string | null) {
  const [call, setCall] = useState<Call | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!callId) {
      setCall(null)
      return
    }

    setIsLoading(true)
    setError(null)

    fetch(`/api/calls/${callId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load call')
        return r.json()
      })
      .then((data) => {
        setCall(data)
        setIsLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setIsLoading(false)
      })
  }, [callId])

  return { call, isLoading, error }
}
