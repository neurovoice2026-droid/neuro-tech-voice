'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Phone, Plus, Search, Trash2, Globe, Copy, Loader2,
  CheckCircle2, PhoneOff, Bot, RotateCw, Route, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { FlagIcon } from '@/components/shared/FlagIcon'
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

const ROUTING_MODES: Record<RoutingMode, { title: string; summary: string; details: string[] }> = {
  app_routed: {
    title: 'Smart routing with failover (recommended)',
    summary: 'Calls reach the platform first, then your agent.',
    details: [
      'Working hours and after-hours handling apply.',
      'If ElevenLabs is unavailable, new calls are answered by the backup voice agent.',
      'Human transfers are done by the platform on the live call.',
    ],
  },
  native_elevenlabs: {
    title: 'Direct ElevenLabs (native transfer, no failover/after-hours)',
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
              <Phone className="h-4 w-4 text-purple-600" aria-hidden="true" />
            </div>
            Buy a phone number
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label htmlFor="buy-country" className="text-sm font-medium text-foreground">Country</label>
            <div className="flex gap-2">
              <Select value={country} onValueChange={(v) => { setCountry(v ?? 'US'); setResults([]); setSelected(null); setHasSearched(false) }}>
                <SelectTrigger id="buy-country" className="h-10">
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
              <Button onClick={() => void handleSearch()} disabled={searching} className="shrink-0 gap-2">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                Search
              </Button>
            </div>
          </div>

          {hasSearched && !searching && results.length === 0 && (
            <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
              No instantly-available numbers for this country right now. Try another country.
            </p>
          )}

          {results.length > 0 && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto" role="radiogroup" aria-label="Available numbers">
              {results.map((r) => (
                <button
                  key={r.number}
                  type="button"
                  role="radio"
                  aria-checked={selected === r.number}
                  onClick={() => setSelected(r.number)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected === r.number ? 'border-primary bg-purple-50 ring-1 ring-primary' : 'border-border hover:border-purple-200'
                  )}
                >
                  <div>
                    <p className="font-mono text-sm font-medium">{formatPhoneNumber(r.number)}</p>
                    <p className="text-xs text-muted-foreground">{[r.locality, r.region].filter(Boolean).join(', ') || 'Local number'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <Button className="w-full purple-glow gap-2" disabled={!selected || purchasing} onClick={() => void handlePurchase()}>
            {purchasing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Phone className="h-4 w-4" aria-hidden="true" />}
            {purchasing
              ? 'Redirecting to checkout...'
              : selected
                ? `Buy ${formatPhoneNumber(selected)} for $${PHONE_NUMBER_MONTHLY_PRICE_USD}/mo`
                : 'Select a number'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            ${PHONE_NUMBER_MONTHLY_PRICE_USD}/month, billed automatically via Stripe. Cancel anytime from your billing settings.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Routing dialog ──────────────────────────────────────────────────────────
function RoutingDialog({
  number, onClose, onChanged,
}: {
  number: PhoneNumber | null
  onClose: () => void
  onChanged: (updated: PhoneNumber) => void
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
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!number} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Change routing</DialogTitle>
          <DialogDescription>
            How calls to {number ? formatPhoneNumber(number.number) : 'this number'} reach your agent. Calls already in
            progress are not affected.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2" disabled={saving}>
          <legend className="sr-only">Routing mode</legend>
          {(Object.keys(ROUTING_MODES) as RoutingMode[]).map((mode) => {
            const copy = ROUTING_MODES[mode]
            const checked = choice === mode
            return (
              <label
                key={mode}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                  checked ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/40',
                )}
              >
                <input
                  type="radio"
                  name="routing-mode"
                  value={mode}
                  checked={checked}
                  onChange={() => setChoice(mode)}
                  className="mt-1 accent-primary"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">
                    {copy.title}
                    {mode === current && <span className="ml-2 text-xs font-normal text-muted-foreground">(current)</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground">{copy.summary}</span>
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    {copy.details.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                </span>
              </label>
            )
          })}
        </fieldset>

        {choice === 'native_elevenlabs' && current !== 'native_elevenlabs' && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            With direct routing, an ElevenLabs outage means missed calls on this number, and your working hours are ignored.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void confirm()} disabled={saving || choice === current}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {saving ? 'Applying…' : 'Change routing'}
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Release {number ? formatPhoneNumber(number.number) : 'this number'}?</DialogTitle>
          <DialogDescription>
            Calls to this number stop immediately and its subscription is cancelled. A released number usually cannot
            be bought back.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={releasing}>Keep number</Button>
          <Button variant="destructive" onClick={() => void release()} disabled={releasing}>
            {releasing && <Loader2 className="animate-spin" aria-hidden="true" />}
            {releasing ? 'Releasing…' : 'Release number'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function PhonePage() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch]   = useState('')
  const [routingTarget, setRoutingTarget] = useState<PhoneNumber | null>(null)
  const [releaseTarget, setReleaseTarget] = useState<PhoneNumber | null>(null)
  const [busy, setBusy] = useState<Record<string, 'toggle' | 'reapply' | undefined>>({})

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
    <div className="p-4 sm:p-6 max-w-4xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Phone Numbers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage virtual numbers and how calls reach your AI agent.
          </p>
        </div>
        <Button className="purple-glow gap-2 shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Buy a number
        </Button>
      </div>

      {/* Summary + search */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {numbers.length} number{numbers.length !== 1 ? 's' : ''} · {activeCount} active
        </p>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search numbers…"
            aria-label="Search numbers"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); void load() }}>
            <RotateCw aria-hidden="true" /> Try again
          </Button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading phone numbers">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Globe className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {numbers.length === 0 ? 'No phone numbers yet — buy one to start taking calls.' : 'No numbers match your search.'}
          </p>
          {numbers.length === 0 && (
            <Button onClick={() => setAddOpen(true)} className="gap-2"><Plus className="h-4 w-4" aria-hidden="true" /> Buy a number</Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => {
            const mode = modeOf(n)
            const routing = n.routing_status ? routingStatusCopy(n.routing_status) : null
            const rowBusy = busy[n.id]
            return (
              <li key={n.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full', n.is_active ? 'bg-green-50' : 'bg-gray-100')}>
                      {n.is_active ? <Phone className="h-4 w-4 text-green-600" aria-hidden="true" /> : <PhoneOff className="h-4 w-4 text-gray-400" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm font-semibold">{formatPhoneNumber(n.number)}</p>
                        <button
                          type="button"
                          onClick={() => copyNumber(n.number)}
                          className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Copy ${formatPhoneNumber(n.number)}`}
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {n.agents?.name ? (
                          <><Bot className="h-3 w-3" aria-hidden="true" /> {n.agents.name}</>
                        ) : (
                          'No agent assigned'
                        )}
                        {n.country ? ` · ${n.country}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                      {rowBusy === 'toggle' && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
                      <Switch
                        id={`number-${n.id}-active`}
                        checked={n.is_active}
                        onCheckedChange={() => void handleToggle(n)}
                        disabled={!!rowBusy}
                      />
                      <label htmlFor={`number-${n.id}-active`} className="text-xs text-muted-foreground w-12">
                        {n.is_active ? 'Active' : 'Paused'}
                      </label>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setReleaseTarget(n)}
                      aria-label={`Release ${formatPhoneNumber(n.number)}`}
                      title="Release number"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {/* Routing */}
                <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Route className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      <span className="text-xs font-medium">{ROUTING_MODES[mode].title}</span>
                      {routing && <StatusPill copy={routing} />}
                      {mode === 'native_elevenlabs' && (
                        <Badge variant="outline" className="text-[10px]">No failover</Badge>
                      )}
                    </div>
                    {n.routing_error && n.routing_status !== 'ready' && (
                      <p className="text-xs text-destructive break-words">{n.routing_error}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRoutingTarget(n)} disabled={!!rowBusy}>
                      Change routing
                    </Button>
                    <Button
                      variant={n.routing_status === 'failed' || n.routing_status === 'degraded' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => void handleReapply(n)}
                      disabled={!!rowBusy}
                    >
                      {rowBusy === 'reapply' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCw aria-hidden="true" />}
                      Re-apply routing
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Verified badge note */}
      {!loading && numbers.length > 0 && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
          Inbound calls are handled automatically once a number is assigned to an agent.
        </p>
      )}

      <AddNumberDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <RoutingDialog
        number={routingTarget}
        onClose={() => setRoutingTarget(null)}
        onChanged={(updated) => {
          setNumbers((p) => p.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
          void load()
        }}
      />
      <ReleaseDialog
        number={releaseTarget}
        onClose={() => setReleaseTarget(null)}
        onReleased={(id) => setNumbers((p) => p.filter((n) => n.id !== id))}
      />
    </div>
  )
}
