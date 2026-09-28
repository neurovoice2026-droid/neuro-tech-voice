'use client'

import { useEffect, useSyncExternalStore } from 'react'

// Unread message count for the navigation badge. Messages aren't pushed over
// realtime, so the count refreshes on mount and navigation, when the tab
// regains focus, once a minute while visible, and whenever the inbox changes a
// message. Every component that shows the count (the sidebar badge, the inbox
// tabs) shares one store, so the page polls once however many read it.

const INBOX_CHANGED_EVENT = 'ntv:inbox-changed'
const REFRESH_MS = 60_000
/** Two readers mounting together (sidebar + inbox) make one request, not two. */
const DEDUPE_MS = 1_000

export function notifyInboxChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(INBOX_CHANGED_EVENT))
}

/** The unread count, or null when it couldn't be read (a missed refresh only leaves the badge stale). */
async function fetchUnread(signal: AbortSignal): Promise<number | null> {
  try {
    const res = await fetch('/api/messages/count', { cache: 'no-store', signal })
    if (!res.ok) return null
    const data = (await res.json()) as { unread?: unknown }
    return typeof data.unread === 'number' ? data.unread : null
  } catch {
    return null
  }
}

const store = {
  unread: 0,
  listeners: new Set<() => void>(),
  controller: null as AbortController | null,
  lastStartedAt: 0,
  stopPolling: null as (() => void) | null,
}

function refresh(force: boolean): void {
  const now = Date.now()
  if (!force && now - store.lastStartedAt < DEDUPE_MS) return
  store.lastStartedAt = now
  store.controller?.abort()
  const controller = new AbortController()
  store.controller = controller
  void fetchUnread(controller.signal).then((count) => {
    if (count === null || controller.signal.aborted || count === store.unread) return
    store.unread = count
    for (const listener of [...store.listeners]) listener()
  })
}

function startPolling(): () => void {
  const refreshIfVisible = () => {
    if (document.visibilityState === 'visible') refresh(false)
  }
  const onInboxChanged = () => refresh(true)
  const timer = window.setInterval(refreshIfVisible, REFRESH_MS)
  window.addEventListener(INBOX_CHANGED_EVENT, onInboxChanged)
  window.addEventListener('focus', refreshIfVisible)
  document.addEventListener('visibilitychange', refreshIfVisible)
  return () => {
    window.clearInterval(timer)
    window.removeEventListener(INBOX_CHANGED_EVENT, onInboxChanged)
    window.removeEventListener('focus', refreshIfVisible)
    document.removeEventListener('visibilitychange', refreshIfVisible)
    store.controller?.abort()
    store.controller = null
  }
}

function subscribe(listener: () => void): () => void {
  store.listeners.add(listener)
  if (store.listeners.size === 1) {
    store.stopPolling = startPolling()
    refresh(false)
  }
  return () => {
    store.listeners.delete(listener)
    if (store.listeners.size === 0) {
      store.stopPolling?.()
      store.stopPolling = null
    }
  }
}

export function useUnreadMessages(refreshKey?: string): number {
  const unread = useSyncExternalStore(subscribe, () => store.unread, () => 0)
  // A navigation (the sidebar passes the path) is a moment the count may have changed.
  useEffect(() => {
    if (refreshKey !== undefined) refresh(false)
  }, [refreshKey])
  return unread
}
