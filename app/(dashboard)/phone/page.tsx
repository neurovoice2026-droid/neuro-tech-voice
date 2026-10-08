'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Phone, Plus, Search, Trash2, Copy, MoreHorizontal,
  CheckCircle2, Bot, RotateCw, Route, AlertCircle, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/shared/EmptyState'
import { Field } from '@/components/shared/FormSection'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { OptionCard } from '@/components/shared/OptionCard'
import { OrbInline, OrbLoader } from '@/components/shared/OrbLoader'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusChip } from '@/components/shared/StatusChip'
import { StatusPill, routingStatusCopy } from '@/components/agent/ProviderStatusCard'
import { errorMessage, parseApiError } from '@/hooks/useVoiceCatalog'
import { toast } from 'sonner'
import { cn, formatPhoneNumber } from '@/lib/utils'
import { PHONE_NUMBER_MONTHLY_PRICE_USD } from '@/lib/phone/pricing'
import type { ProviderResourceStatus } from '@/types'

type RoutingMode = 'app_routed' | 'native_elevenlabs'

interface PhoneNumber {
  id: string
  number: string
  friendly_name: string | null
  country: string | null
  is_active: boolean
  agent_id: string | null
  agents: { name: string } | null
  routing_mode?: RoutingMode
  routing_status?: ProviderResourceStatus
  routing_error?: string | null
}

interface BindingResult {
  status: 'ready' | 'degraded' | 'failed'
  steps: Array<{ step: string; ok: boolean; error?: string }>
}

interface SearchResult {
  number: string
  friendly_name: string
  locality: string
  region: string
}

const ROUTING_MODES: Record<RoutingMode, { title: string; short: string; summary: string; details: string[] }> = {
  app_routed: {
    title: 'Smart routing with failover (recommended)',
    short: 'Smart routing with failover',
    summary: 'Calls reach the platform first, then your agent.',
    details: [
      'Working hours and after-hours handling apply.',
      'If ElevenLabs is unavailable, new calls are answered by the backup voice agent.',
      'Human transfers are done by the platform on the live call.',
    ],
  },
  native_elevenlabs: {
    title: 'Direct ElevenLabs (native transfer, no failover/after-hours)',
    short: 'Direct ElevenLabs',
    summary: 'The number is connected straight to ElevenLabs.',
    details: [
      'Uses ElevenLabs’ native call transfer.',
      'No failover: if ElevenLabs is down, calls to this number are not answered.',
      'Working hours and after-hours handling do not apply.',
    ],
  },
}

function modeOf(n: PhoneNumber): RoutingMode {
  return n.routing_mode === 'native_elevenlabs' ? 'native_elevenlabs' : 'app_routed'
}

function firstStepError(result: BindingResult | null): string | null {
  return result?.steps.find((s) => !s.ok && s.error)?.error ?? null
}

function isBindingResult(value: unknown): value is BindingResult {
  return !!value && typeof value === 'object' && typeof (value as BindingResult).status === 'string' && Array.isArray((value as BindingResult).steps)
}

// Countries offered here are ones that can typically get an instant number
// with no Twilio regulatory bundle / address proof required. This list is a
// starting point, not an authoritative guarantee — the real guarantee is
// server-side in /api/phone/search, which only ever returns numbers where
// Twilio's own address_requirements is "none". Romania is deliberately
// excluded since it requires a regulatory bundle.
// `value` is the ISO 3166-1 alpha-2 code, reused directly for <FlagIcon />.
const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'AT', label: 'Austria' },
  { value: 'BE', label: 'Belgium' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'CZ', label: 'Czechia' },
  { value: 'DK', label: 'Denmark' },
  { value: 'FI', label: 'Finland' },
  { value: 'HU', label: 'Hungary' },
  { value: 'LU', label: 'Luxembourg' },
  { value: 'NO', label: 'Norway' },
  { value: 'PT', label: 'Portugal' },
  { value: 'SE', label: 'Sweden' },
  { value: 'SK', label: 'Slovakia' },
  { value: 'SG', label: 'Singapore' },
  { value: 'JP', label: 'Japan' },
  { value: 'IN', label: 'India' },
  { value: 'BR', label: 'Brazil' },
  { value: 'ZA', label: 'South Africa' },
]

/** Small muted bullet list item (phrasing content, so it also works inside an OptionCard button). */
function Detail({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex gap-2 text-xs leading-[18px] text-muted-foreground">
      <span aria-hidden="true" className="mt-[7px] size-1 shrink-0 rounded-full bg-current" />
      <span>{children}</span>
    </span>
  )
}

// ─── Buy dialog ───────────────────────────────────────────────────────────────
function AddNumberDialog({
  open, onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [country, setCountry]       = useState('US')
  const [searching, setSearching]   = useState(false)
  const [results, setResults]       = useState<SearchResult[]>([])
  const [selected, setSelected]     = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  async function handleSearch() {
    setSearching(true); setSelected(null); setResults([])
    try {
      const res = await fetch(`/api/phone/search?country=${encodeURIComponent(country)}`)
      if (!res.ok) throw await parseApiError(res, 'Search failed. Please try again.')
      const data: unknown = await res.json()
      setResults(Array.isArray(data) ? (data as SearchResult[]) : [])
    } catch (err) {
      toast.error('Search failed', { description: errorMessage(err, 'Please try again.') })
    } finally {
      setSearching(false)
      setHasSearched(true)
    }
  }

  async function handlePurchase() {
    if (!selected) return
    setPurchasing(true)
    try {
      const res = await fetch('/api/phone/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: selected, country }),
      })
      if (!res.ok) throw await parseApiError(res, 'Could not start checkout.')
      const data = (await res.json()) as { url?: string }
      if (!data.url) throw new Error('missing checkout url')
      window.location.href = data.url
    } catch (err) {
      toast.error('Could not start checkout', { description: errorMessage(err, 'Please try again.') })
      setPurchasing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Buy a phone number</DialogTitle>
        </DialogHeader>

        <div className="min-w-0 space-y-5">
          <Field label="Country" htmlFor="buy-country">
            <div className="flex gap-2">
              <Select value={country} onValueChange={(v) => { setCountry(v ?? 'US'); setResults([]); setSelected(null); setHasSearched(false) }}>
                <SelectTrigger id="buy-country" className="min-w-0 flex-1">
                  <SelectValue>
                    {(value: string) => {
                      const c = COUNTRIES.find((o) => o.value === value)
                      return c ? (
                        <span className="flex items-center gap-2">
                          <FlagIcon country={c.value} />
                          {c.label}
                        </span>
                      ) : value
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <FlagIcon country={c.value} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* The searching orb sits in the results area below (one orb per region), so the
                  button is only disabled while a search runs; it keeps focus (aria-disabled). */}
              <Button
                variant="outline"
                className="h-10 shrink-0 aria-disabled:opacity-50"
                onClick={() => void handleSearch()}
                disabled={searching}
                focusableWhenDisabled
                aria-busy={searching || undefined}
              >
                <Search aria-hidden="true" />
                Search
              </Button>
            </div>
          </Field>

          {/* Searching and "no numbers" fill the height of a full results grid (5 numbers: three
              64 px rows on two columns, or the 280 px scroll area on one), so the centred
              dialog does not resize again when the results arrive. */}
          {searching ? (
            <OrbLoader
              size={32}
              layout="row"
              state="searching"
              delayMs={0}
              label="Searching available numbers…"
              className="min-h-70 justify-center rounded-2xl bg-secondary px-6 sm:min-h-52"
            />
          ) : hasSearched && results.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No instantly-available numbers for this country right now"
              description="Try another country."
              className="min-h-70 py-8 sm:min-h-52"
            />
          ) : null}

          {results.length > 0 && (
            // The wrapper takes the stack spacing; the inner -m-1/p-1 leaves room for the
            // selected ring and focus outline inside the scroll area.
            <div>
              <div
                className="-m-1 grid max-h-72 gap-2 overflow-y-auto p-1 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Available numbers"
              >
                {results.map((r) => (
                  <OptionCard
                    key={r.number}
                    selected={selected === r.number}
                    onSelect={() => setSelected(r.number)}
                    title={<span className="tabular-nums">{formatPhoneNumber(r.number)}</span>}
                    description={[r.locality, r.region].filter(Boolean).join(', ') || 'Local number'}
                    className="py-3"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {/* On phones the label ("Buy +1 (212) 555-0122 for $1.15/mo") is set a size down and may
                wrap, so a long number never pushes the dialog wider than the screen. */}
            <Button
              size="lg"
              className="w-full max-sm:h-auto max-sm:min-h-11 max-sm:px-4 max-sm:py-2.5 max-sm:text-sm max-sm:leading-5 max-sm:whitespace-normal"
              disabled={!selected}
              onClick={() => void handlePurchase()}
              loading={purchasing}
              loadingText="Redirecting to checkout…"
            >
              <Phone aria-hidden="true" />
              {selected
                ? `Buy ${formatPhoneNumber(selected)} for $${PHONE_NUMBER_MONTHLY_PRICE_USD}/mo`
                : 'Select a number'}
            </Button>
            <p className="text-center text-xs leading-4 text-muted-foreground">
              ${PHONE_NUMBER_MONTHLY_PRICE_USD}/month, billed automatically via Stripe. Cancel anytime from your billing settings.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Routing dialog ──────────────────────────────────────────────────────────
function RoutingDialog({
  number, onClose, onChanged, onRefresh,
}: {
  number: PhoneNumber | null
  onClose: () => void
  onChanged: (updated: PhoneNumber) => void
  /** Reloads the list (and so this dialog's `number`) from the server. */
  onRefresh: () => void
}) {
  const current = number ? modeOf(number) : 'app_routed'
  const [choice, setChoice] = useState<RoutingMode>(current)
  const [saving, setSaving] = useState(false)

  // A different number opened the dialog: start from its current mode.
  const [lastId, setLastId] = useState<string | null>(number?.id ?? null)
  if ((number?.id ?? null) !== lastId) {
    setLastId(number?.id ?? null)
    setChoice(current)
  }

  async function confirm() {
    if (!number || choice === current) return
    setSaving(true)
    try {
      const res = await fetch(`/api/phone/${number.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routing_mode: choice }),
      })
      if (!res.ok) throw await parseApiError(res, 'The routing could not be changed.')
      const data = (await res.json()) as PhoneNumber & { binding?: BindingResult }
      const { binding, ...updated } = data
      onChanged(updated)
      if (binding && binding.status !== 'ready') {
        toast.warning('Routing changed, but not fully applied', {
          description: firstStepError(binding) ?? 'Use “Re-apply routing” to try again.',
        })
      } else {
        toast.success(choice === 'app_routed' ? 'Smart routing is on' : 'Number connected directly to ElevenLabs')
      }
      onClose()
    } catch (err) {
      toast.error('Could not change the routing', { description: errorMessage(err, 'Please try again.') })
      // The server may have saved the new mode (status 'pending') before the
      // binding failed: show what is actually persisted, not the old row.
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!number} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Change routing</DialogTitle>
          <DialogDescription>
            How calls to {number ? formatPhoneNumber(number.number) : 'this number'} reach your agent. Calls already in
            progress are not affected.
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Routing mode" className="grid gap-2">
          {(Object.keys(ROUTING_MODES) as RoutingMode[]).map((mode) => {
            const copy = ROUTING_MODES[mode]
            return (
              <OptionCard
                key={mode}
                selected={choice === mode}
                onSelect={() => setChoice(mode)}
                disabled={saving}
                icon={mode === 'app_routed' ? Route : Phone}
                title={copy.title}
                badge={mode === current ? <Badge variant="outline">Current</Badge> : undefined}
                description={copy.summary}
              >
                <span className="mt-2 flex flex-col gap-1">
                  {copy.details.map((d) => <Detail key={d}>{d}</Detail>)}
                </span>
              </OptionCard>
            )
          })}
        </div>

        {choice === 'native_elevenlabs' && current !== 'native_elevenlabs' && (
          <Alert variant="warning">
            <AlertTriangle aria-hidden="true" />
            <AlertDescription>
              With direct routing, an ElevenLabs outage means missed calls on this number, and your working hours are ignored.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={() => void confirm()}
            disabled={choice === current}
            loading={saving}
            loadingState="connecting"
            loadingText="Applying…"
          >
            Change routing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Release confirmation ────────────────────────────────────────────────────
function ReleaseDialog({
  number, onClose, onReleased,
}: {
  number: PhoneNumber | null
  onClose: () => void
  onReleased: (id: string) => void
}) {
  const [releasing, setReleasing] = useState(false)

  async function release() {
    if (!number) return
    setReleasing(true)
    try {
      const res = await fetch(`/api/phone/${number.id}`, { method: 'DELETE' })
      if (!res.ok) throw await parseApiError(res, 'Failed to release the number.')
      const data = (await res.json()) as { warning?: string }
      if (data.warning) toast.warning('Number released', { description: data.warning })
      else toast.success('Number released')
      onReleased(number.id)
      onClose()
    } catch (err) {
      toast.error('Could not release the number', { description: errorMessage(err, 'Please try again.') })
    } finally {
      setReleasing(false)
    }
  }

  return (
    <Dialog open={!!number} onOpenChange={(o) => !o && !releasing && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Release <span className="tabular-nums">{number ? formatPhoneNumber(number.number) : 'this number'}</span>?
          </DialogTitle>
          <DialogDescription>
            Calls to this number stop immediately and its subscription is cancelled. A released number usually cannot
            be bought back.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={releasing}>Keep number</Button>
          <Button
            variant="destructive-solid"
            onClick={() => void release()}
            loading={releasing}
            loadingText="Releasing…"
          >
            Release number
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Routing explainer (aside) ───────────────────────────────────────────────
function RoutingGuide() {
  return (
    <aside aria-labelledby="routing-guide" className="rounded-[24px] bg-secondary p-2 sm:p-3 xl:sticky xl:top-6">
      <div className="px-3 pt-3 pb-4">
        <h2 id="routing-guide" className="text-[15px] leading-[22px] font-medium">How calls reach your agent</h2>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
        {(Object.keys(ROUTING_MODES) as RoutingMode[]).map((mode) => {
          const copy = ROUTING_MODES[mode]
          return (
            <div key={mode} className="rounded-2xl bg-card p-4 shadow-panel">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm leading-5 font-medium">{copy.short}</h3>
                {mode === 'app_routed'
                  ? <Badge variant="secondary">Recommended</Badge>
                  : <Badge variant="outline">No failover</Badge>}
              </div>
              <p className="mt-1.5 text-[13px] leading-[19px] text-muted-foreground">{copy.summary}</p>
              <div className="mt-3 flex flex-col gap-1.5 border-t border-rule pt-3">
                {copy.details.map((d) => <Detail key={d}>{d}</Detail>)}
              </div>
            </div>
          )
        })}
      </div>
      <p className="flex items-start gap-2 px-3 pt-4 pb-2 text-xs leading-[18px] text-muted-foreground">
        <CheckCircle2 className="mt-px size-3.5 shrink-0 text-success-dot" aria-hidden="true" />
        Inbound calls are handled automatically once a number is assigned to an agent.
      </p>
    </aside>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function PhonePage() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch]   = useState('')
  // By id, so a reload refreshes the open routing dialog's row as well.
  const [routingTargetId, setRoutingTargetId] = useState<string | null>(null)
  const [releaseTarget, setReleaseTarget] = useState<PhoneNumber | null>(null)
  const [busy, setBusy] = useState<Record<string, 'toggle' | 'reapply' | undefined>>({})
  const routingTarget = routingTargetId ? (numbers.find((n) => n.id === routingTargetId) ?? null) : null

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/phone', { cache: 'no-store' })
      if (!res.ok) throw await parseApiError(res, 'Could not load your phone numbers.')
      const data: unknown = await res.json()
      setNumbers(Array.isArray(data) ? (data as PhoneNumber[]) : [])
      setLoadError(null)
    } catch (err) {
      // Keep the list already shown; say why it may be stale.
      setLoadError(errorMessage(err, 'Could not load your phone numbers.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const setBusyFor = (id: string, value: 'toggle' | 'reapply' | undefined) =>
    setBusy((b) => ({ ...b, [id]: value }))

  async function handleToggle(n: PhoneNumber) {
    setBusyFor(n.id, 'toggle')
    try {
      const res = await fetch(`/api/phone/${n.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !n.is_active }),
      })
      if (!res.ok) throw await parseApiError(res, 'Failed to update the number.')
      const updated = (await res.json()) as PhoneNumber
      setNumbers((p) => p.map((x) => (x.id === n.id ? updated : x)))
    } catch (err) {
      toast.error('Could not update the number', { description: errorMessage(err, 'Please try again.') })
    } finally {
      setBusyFor(n.id, undefined)
    }
  }

  async function handleReapply(n: PhoneNumber) {
    setBusyFor(n.id, 'reapply')
    try {
      const res = await fetch(`/api/phone/${n.id}/routing`, { method: 'POST' })
      // 502 carries the binding result (status 'failed' + the step that failed).
      const body: unknown = res.ok || res.status === 502 ? await res.clone().json().catch(() => null) : null
      const result = isBindingResult(body) ? body : null
      if (!res.ok && !result) throw await parseApiError(res, 'The routing could not be re-applied.')
      if (result?.status === 'ready') toast.success('Routing re-applied')
      else if (result?.status === 'degraded') {
        toast.warning('Routing partly applied', { description: firstStepError(result) ?? 'Calls are answered, but part of the routing is missing.' })
      } else {
        toast.error('Routing could not be applied', { description: firstStepError(result) ?? 'Please try again in a few minutes.' })
      }
    } catch (err) {
      toast.error('Could not re-apply routing', { description: errorMessage(err, 'Please try again.') })
    } finally {
      setBusyFor(n.id, undefined)
      void load()
    }
  }

  function copyNumber(number: string) {
    navigator.clipboard.writeText(number).then(
      () => toast.success('Copied'),
      () => toast.error('Could not copy the number'),
    )
  }

  const filtered = numbers.filter((n) =>
    !search ||
    n.number.includes(search) ||
    (n.friendly_name ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const activeCount = numbers.filter((n) => n.is_active).length

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Phone numbers"
        title="Phone numbers"
        description="Manage virtual numbers and how calls reach your AI agent."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus aria-hidden="true" />
            Buy a number
          </Button>
        }
      />

      {loadError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>{loadError}</AlertTitle>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); void load() }}>
              <RotateCw aria-hidden="true" /> Try again
            </Button>
          </AlertAction>
        </Alert>
      )}

      {/* The guide sits beside the list only from xl: next to a 320 px aside at lg the list
          was too narrow for the number. Below xl it stacks under the list. */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Your phone numbers" className="min-w-0">
          {/* Toolbar: search + summary. It is also drawn during the first load (search
              disabled) so the list does not move down when the numbers arrive. */}
          {(loading || numbers.length > 0) && (
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder="Search numbers…"
                  aria-label="Search numbers"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  disabled={loading && numbers.length === 0}
                  className="h-9 rounded-full pl-9"
                />
              </div>
              {loading ? (
                // Refetch with the list still on screen ("Try again"): the rows stay, dimmed.
                numbers.length > 0 && (
                  <span className="ml-auto inline-flex">
                    <OrbInline state="breathing" label="Updating…" />
                  </span>
                )
              ) : (
                <p className="ml-auto text-[13px] leading-[19px] text-muted-foreground tabular-nums">
                  {numbers.length} number{numbers.length !== 1 ? 's' : ''} · {activeCount} active
                </p>
              )}
            </div>
          )}

          {/* List */}
          {loading && numbers.length === 0 ? (
            <Card className="py-0">
              <OrbLoader label="Loading phone numbers…" className="min-h-[240px]" />
            </Card>
          ) : numbers.length === 0 ? (
            <Card className="py-0">
              {loadError ? (
                // The alert above carries the message and "Try again"; this only keeps the
                // list area from claiming there are no numbers.
                <EmptyState
                  bare
                  icon={AlertCircle}
                  iconClassName="bg-destructive-soft text-destructive shadow-none"
                  title="Your numbers could not be loaded"
                  description="They will show here once the list loads."
                  className="min-h-[280px]"
                />
              ) : (
                <EmptyState
                  bare
                  icon={Phone}
                  title="No phone numbers yet"
                  description="Buy one to start taking calls."
                  action={
                    <Button onClick={() => setAddOpen(true)}>
                      <Plus aria-hidden="true" /> Buy a number
                    </Button>
                  }
                  className="min-h-[280px]"
                />
              )}
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="py-0">
              <EmptyState bare icon={Search} title="No numbers match your search" />
            </Card>
          ) : (
            <Card
              aria-busy={loading || undefined}
              className={cn('gap-0 py-0 transition-opacity duration-200', loading && 'opacity-60')}
            >
              {/* Rows lay out by the list's own width (container queries), not the viewport:
                  the number keeps its full width wherever the panel is narrow. */}
              <ul className="@container/numbers">
                {filtered.map((n) => {
                  const mode = modeOf(n)
                  const routing = n.routing_status ? routingStatusCopy(n.routing_status) : null
                  const rowBusy = busy[n.id]
                  const needsReapply = n.routing_status === 'failed' || n.routing_status === 'degraded'
                  const pretty = formatPhoneNumber(n.number)
                  return (
                    <li
                      key={n.id}
                      className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-x-3 gap-y-3 border-b border-rule px-4 py-4 last:border-b-0 @lg/numbers:grid-cols-[2.5rem_minmax(0,1fr)_auto_auto] @lg/numbers:px-5"
                    >
                      {/* Flag disc */}
                      <span
                        aria-hidden="true"
                        className="grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground"
                      >
                        {n.country ? <FlagIcon country={n.country} /> : <Phone className="size-4" />}
                      </span>

                      {/* Number + agent */}
                      <div className="min-w-0 self-center">
                        <div className="flex items-center gap-1">
                          <p className="truncate text-base leading-6 font-medium tabular-nums @lg/numbers:text-[17px]" title={pretty}>{pretty}</p>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="tap-44 text-muted-foreground hover:text-foreground"
                            onClick={() => copyNumber(n.number)}
                            aria-label={`Copy ${pretty}`}
                          >
                            <Copy aria-hidden="true" />
                          </Button>
                        </div>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] leading-[19px] text-muted-foreground">
                          {n.agents?.name ? (
                            <><Bot className="size-3.5 shrink-0" aria-hidden="true" /> {n.agents.name}</>
                          ) : (
                            'No agent assigned'
                          )}
                          {n.country ? ` · ${n.country}` : ''}
                        </p>
                      </div>

                      {/* Active toggle: own row in a narrow list, top-right from @lg */}
                      <div className="col-span-2 col-start-2 row-start-2 flex items-center gap-2.5 @lg/numbers:col-span-1 @lg/numbers:col-start-3 @lg/numbers:row-start-1 @lg/numbers:self-center">
                        {/* Named after the number. The Active/Paused text is the visible state, not a
                            <label>: Base UI would name the switch from a linked label (aria-labelledby),
                            so its name would flip with the state and never say which number it is. */}
                        <Switch
                          aria-label={`Answer calls on ${pretty}`}
                          checked={n.is_active}
                          onCheckedChange={() => void handleToggle(n)}
                          disabled={!!rowBusy}
                        />
                        <span className="w-12 text-[13px] leading-[19px] text-muted-foreground">
                          {n.is_active ? 'Active' : 'Paused'}
                        </span>
                        {/* Reserved slot so the switch does not move while the orb shows. */}
                        <span className="-ml-1.5 inline-flex size-5 shrink-0">
                          {rowBusy === 'toggle' && <OrbInline state="working" label="Updating…" />}
                        </span>
                      </div>

                      {/* Row menu */}
                      <div className="col-start-3 row-start-1 self-center @lg/numbers:col-start-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={`Actions for ${pretty}`}
                            render={<Button variant="ghost" size="icon-sm" className="tap-44 text-muted-foreground hover:text-foreground aria-expanded:text-foreground" />}
                          >
                            <MoreHorizontal aria-hidden="true" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuGroup>
                              <DropdownMenuItem onClick={() => setRoutingTargetId(n.id)} disabled={!!rowBusy}>
                                <Route /> Change routing…
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void handleReapply(n)} disabled={!!rowBusy}>
                                <RotateCw /> Re-apply routing
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setReleaseTarget(n)}>
                              <Trash2 /> Release number…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Routing */}
                      <div className="col-span-3 row-start-3 min-w-0 rounded-xl bg-band px-3 py-2.5 @lg/numbers:col-start-2 @lg/numbers:row-start-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                          <Route className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="text-[13px] leading-[19px] font-medium" title={ROUTING_MODES[mode].title}>
                            {ROUTING_MODES[mode].short}
                          </span>
                          {rowBusy === 'reapply' ? (
                            <StatusChip tone="neutral" icon={<OrbInline state="connecting" />}>Re-applying…</StatusChip>
                          ) : (
                            routing && <StatusPill copy={routing} />
                          )}
                          {mode === 'native_elevenlabs' && (
                            <Badge variant="outline">No failover</Badge>
                          )}
                          <div className="ml-auto flex flex-wrap gap-1.5">
                            {needsReapply && (
                              <Button
                                size="xs"
                                onClick={() => void handleReapply(n)}
                                disabled={!!rowBusy}
                              >
                                <RotateCw aria-hidden="true" />
                                Re-apply routing
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => setRoutingTargetId(n.id)}
                              disabled={!!rowBusy}
                            >
                              Change routing
                            </Button>
                          </div>
                        </div>
                        {n.routing_error && n.routing_status !== 'ready' && (
                          <p className="mt-2 flex items-start gap-1.5 text-xs leading-4 break-words text-destructive">
                            <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                            {n.routing_error}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
        </section>

        <RoutingGuide />
      </div>

      <AddNumberDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <RoutingDialog
        number={routingTarget}
        onClose={() => setRoutingTargetId(null)}
        onChanged={(updated) => {
          setNumbers((p) => p.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
          void load()
        }}
        onRefresh={() => void load()}
      />
      <ReleaseDialog
        number={releaseTarget}
        onClose={() => setReleaseTarget(null)}
        onReleased={(id) => setNumbers((p) => p.filter((n) => n.id !== id))}
      />
    </PageContainer>
  )
}
