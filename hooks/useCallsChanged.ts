'use client'

import { useEffect, useRef } from 'react'

// One Supabase Realtime subscription per organisation for "a call was added
// or changed", shared by every dashboard widget that refreshes on it (the
// metrics, recent calls and chart used to open a channel each). supabase-js
// is loaded after the first paint: realtime is only a refresh nudge, so the
// page doesn't parse the client before its numbers show.

type Listener = () => void

interface Subscription {
  listeners: Set<Listener>
  stop: (() => void) | null
  closed: boolean
}

const subscriptions = new Map<string, Subscription>()

function subscribe(orgId: string, listener: Listener): () => void {
  let sub = subscriptions.get(orgId)
  if (!sub) {
    const created: Subscription = { listeners: new Set(), stop: null, closed: false }
    sub = created
    subscriptions.set(orgId, created)
    void import('@/lib/supabase/client')
      .then(({ createClient }) => {
        if (created.closed) return
        const supabase = createClient()
        const notify = () => {
          for (const l of [...created.listeners]) l()
        }
        const channel = supabase
          .channel(`calls-changed:${orgId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `org_id=eq.${orgId}` }, notify)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `org_id=eq.${orgId}` }, notify)
          .subscribe()
        created.stop = () => void supabase.removeChannel(channel)
      })
      .catch((error: unknown) => console.warn('[dashboard] live updates unavailable', error))
  }
  const current = sub
  current.listeners.add(listener)
  return () => {
    current.listeners.delete(listener)
    if (current.listeners.size > 0) return
    current.closed = true
    current.stop?.()
    subscriptions.delete(orgId)
  }
}

/** Calls `onChange` whenever one of the organisation's calls is inserted or updated. */
export function useCallsChanged(orgId: string | null | undefined, onChange: () => void): void {
  const latest = useRef(onChange)
  useEffect(() => {
    latest.current = onChange
  })
  useEffect(() => {
    if (!orgId) return
    return subscribe(orgId, () => latest.current())
  }, [orgId])
}

/** Test hook: how many live subscriptions exist. */
export function activeCallsSubscriptions(): number {
  return subscriptions.size
}
