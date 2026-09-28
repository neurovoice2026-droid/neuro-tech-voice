'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Globe, Loader2, Plus, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { PhoneNumberView } from '@/lib/twilio/types'
import { errorMessage, phoneApi } from './api'
import { BuyNumberDialog } from './BuyNumberDialog'
import { PhoneNumberCard } from './PhoneNumberCard'
import { ReleaseNumberDialog } from './ReleaseNumberDialog'

interface PhoneNumbersViewProps {
  initialNumbers: PhoneNumberView[]
  initialError: boolean
  /** Stripe and Twilio are configured, so numbers can be bought. */
  canBuy: boolean
  /** Twilio and a voice pipeline are configured, so numbers can be moved to the app router. */
  canReconnect: boolean
}

/** After checkout the billing webhook buys the number; poll until it shows up. */
const PROVISION_POLL_MS = 4_000
const PROVISION_POLL_LIMIT_MS = 90_000

export function PhoneNumbersView({ initialNumbers, initialError, canBuy, canReconnect }: PhoneNumbersViewProps) {
  const [numbers, setNumbers] = useState<PhoneNumberView[]>(initialNumbers)
  const [loadError, setLoadError] = useState(initialError)
  const [refreshing, setRefreshing] = useState(false)
  const [buyOpen, setBuyOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [releaseTarget, setReleaseTarget] = useState<PhoneNumberView | null>(null)
  const [toggling, setToggling] = useState<Set<string>>(() => new Set())
  const [reconnecting, setReconnecting] = useState<Set<string>>(() => new Set())
  const [awaitingPurchase, setAwaitingPurchase] = useState(false)
  // Numbers the page loaded with; a purchase is done once any other id appears.
  const knownIds = useRef(new Set(initialNumbers.map((n) => n.id)))

  const refresh = useCallback(async (opts: { quiet?: boolean } = {}) => {
    if (!opts.quiet) setRefreshing(true)
    try {
      const list = await phoneApi<PhoneNumberView[]>('/api/phone')
      setNumbers(list)
      setLoadError(false)
      return list
    } catch (err) {
      if (!opts.quiet) {
        setLoadError(true)
        toast.error(errorMessage(err))
      }
      return null
    } finally {
      if (!opts.quiet) setRefreshing(false)
    }
  }, [])

  // Returning from Stripe Checkout.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const purchased = params.has('purchased')
    const canceled = params.has('canceled')
    if (!purchased && !canceled) return
    window.history.replaceState(null, '', window.location.pathname)
    if (canceled) {
      toast.info('Checkout canceled. You weren’t charged.')
      return
    }
    toast.success('Payment received. We’re setting up your number now.')
    setAwaitingPurchase(true)
  }, [])

  useEffect(() => {
    if (!awaitingPurchase) return
    const startedAt = Date.now()
    let stopped = false
    const timer = window.setInterval(async () => {
      if (stopped) return
      const list = await refresh({ quiet: true })
      const arrived = list?.some((n) => !knownIds.current.has(n.id))
      if (arrived) {
        stopped = true
        window.clearInterval(timer)
        setAwaitingPurchase(false)
        toast.success('Your new number is ready. Your agent is answering it now.')
      } else if (Date.now() - startedAt > PROVISION_POLL_LIMIT_MS) {
        stopped = true
        window.clearInterval(timer)
        setAwaitingPurchase(false)
        toast.warning(
          'Your number is taking longer than usual to set up. Refresh this page in a few minutes, and if it still isn’t here, contact support and we’ll sort it out.',
          { duration: 15_000 }
        )
      }
    }, PROVISION_POLL_MS)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [awaitingPurchase, refresh])

  function setPending(setter: typeof setToggling, id: string, pending: boolean) {
    setter((current) => {
      const next = new Set(current)
      if (pending) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function handleToggle(n: PhoneNumberView, active: boolean) {
    setPending(setToggling, n.id, true)
    // Optimistic: the switch moves at once and rolls back on failure.
    setNumbers((list) => list.map((x) => (x.id === n.id ? { ...x, is_active: active } : x)))
    try {
      const updated = await phoneApi<PhoneNumberView>(`/api/phone/${n.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: active }),
      })
      setNumbers((list) => list.map((x) => (x.id === n.id ? updated : x)))
      toast.success(active ? 'Number resumed. Your agent is answering it again.' : 'Number paused.')
    } catch (err) {
      setNumbers((list) => list.map((x) => (x.id === n.id ? { ...x, is_active: n.is_active } : x)))
      toast.error(errorMessage(err))
    } finally {
      setPending(setToggling, n.id, false)
    }
  }

  async function handleReconnect(n: PhoneNumberView) {
    setPending(setReconnecting, n.id, true)
    try {
      const updated = await phoneApi<PhoneNumberView>(`/api/phone/${n.id}/routing`, { method: 'POST' })
      setNumbers((list) => list.map((x) => (x.id === n.id ? updated : x)))
      toast.success('Number reconnected. Calls now reach your agent.')
    } catch (err) {
      toast.error(errorMessage(err))
      // The server stores the failure reason on the number; show it.
      void refresh({ quiet: true })
    } finally {
      setPending(setReconnecting, n.id, false)
    }
  }

  const query = filter.trim().toLowerCase()
  const digits = query.replace(/\D/g, '')
  const filtered = numbers.filter(
    (n) =>
      !query ||
      (digits && n.number.replace(/\D/g, '').includes(digits)) ||
      (n.friendly_name ?? '').toLowerCase().includes(query) ||
      (n.agent_name ?? '').toLowerCase().includes(query)
  )
  const activeCount = numbers.filter((n) => n.is_active).length
  const needsReconnect = numbers.filter((n) => n.routing_status === 'needs_reconnect').length

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Phone Numbers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your business numbers. Your AI agent answers every call to them.
          </p>
        </div>
        {/* An empty list has its own "Get a number" button; one call to action is enough. */}
        {(numbers.length > 0 || !canBuy || loadError) && (
          <Button
            className="purple-glow w-full shrink-0 gap-2 sm:w-auto"
            onClick={() => setBuyOpen(true)}
            disabled={!canBuy}
          >
            <Plus aria-hidden="true" />
            Get a number
          </Button>
        )}
      </div>

      {!canBuy && (
        <Alert className="mb-4">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Buying numbers isn’t available right now</AlertTitle>
          <AlertDescription>
            The phone or billing service isn’t set up on this workspace yet. Numbers you already have keep working.
          </AlertDescription>
        </Alert>
      )}

      {needsReconnect > 0 && canReconnect && (
        <Alert className="mb-4 border-amber-200 bg-amber-50">
          <AlertCircle className="text-amber-700" aria-hidden="true" />
          <AlertTitle className="text-amber-900">
            {needsReconnect === 1 ? 'One number needs to be reconnected' : `${needsReconnect} numbers need to be reconnected`}
          </AlertTitle>
          <AlertDescription className="text-amber-800">
            Press Reconnect on the number below. It only takes a few seconds.
          </AlertDescription>
        </Alert>
      )}

      {needsReconnect > 0 && !canReconnect && (
        <Alert className="mb-4">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Reconnecting isn’t available yet</AlertTitle>
          <AlertDescription>
            Your agent’s voice service is still being set up on this workspace. Your numbers stay as they are until then.
          </AlertDescription>
        </Alert>
      )}

      {awaitingPurchase && (
        <div role="status" className="mb-4 flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          Setting up your new number. This usually takes less than a minute.
        </div>
      )}

      {/* The count only helps once there are numbers; before that the empty or error state says it all. */}
      {numbers.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {numbers.length} number{numbers.length !== 1 ? 's' : ''} · {activeCount} active
          </p>
          {numbers.length > 1 && (
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                placeholder="Search numbers…"
                aria-label="Search numbers"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
          )}
        </div>
      )}

      {loadError && numbers.length === 0 ? (
        <div className="rounded-xl border border-dashed">
          <EmptyState
            icon={AlertCircle}
            title="We couldn’t load your numbers"
            description="Your numbers are safe and still answering calls. Please try again."
            action={
              <Button variant="outline" onClick={() => refresh()} disabled={refreshing} className="gap-2">
                {refreshing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
                Try again
              </Button>
            }
          />
        </div>
      ) : refreshing && numbers.length === 0 ? (
        <div role="status">
          <span className="sr-only">Loading your phone numbers…</span>
          <PhoneNumbersSkeleton />
        </div>
      ) : numbers.length === 0 ? (
        <div className="rounded-xl border border-dashed">
          <EmptyState
            icon={Globe}
            title="No phone numbers yet"
            description="Get a local number in seconds. There’s nothing to install and no porting: your agent answers it right away."
            action={
              canBuy ? (
                <Button onClick={() => setBuyOpen(true)} className="gap-2">
                  <Plus aria-hidden="true" />
                  Get a number
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No numbers match “{filter}”.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Your phone numbers">
          {filtered.map((n) => (
            <PhoneNumberCard
              key={n.id}
              number={n}
              toggling={toggling.has(n.id)}
              reconnecting={reconnecting.has(n.id)}
              canReconnect={canReconnect}
              onToggle={handleToggle}
              onReconnect={handleReconnect}
              onRelease={setReleaseTarget}
            />
          ))}
        </ul>
      )}

      <BuyNumberDialog open={buyOpen} onClose={() => setBuyOpen(false)} />
      <ReleaseNumberDialog
        number={releaseTarget}
        onClose={() => setReleaseTarget(null)}
        onReleased={(id) => setNumbers((list) => list.filter((n) => n.id !== id))}
      />
    </div>
  )
}

/** Visual placeholder only; wrap it in an element with role="status" and a text label. */
export function PhoneNumbersSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-32" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-44 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
