'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Phone, Plus, Search, Trash2, Globe, Copy, Loader2,
  CheckCircle2, PhoneOff, Bot,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { toast } from 'sonner'
import { cn, formatPhoneNumber } from '@/lib/utils'
import { PHONE_NUMBER_MONTHLY_PRICE_USD } from '@/lib/phone/pricing'

interface PhoneNumber {
  id: string
  number: string
  friendly_name: string | null
  country: string | null
  is_active: boolean
  agent_id: string | null
  agents: { name: string } | null
}

interface SearchResult {
  number: string
  friendly_name: string
  locality: string
  region: string
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
  open, onClose, onPurchased,
}: {
  open: boolean
  onClose: () => void
  onPurchased: () => void
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
      const res = await fetch(`/api/phone/search?country=${country}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Search failed')
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
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error ?? 'Could not start checkout')
        setPurchasing(false)
      }
    } catch {
      toast.error('Could not start checkout')
      setPurchasing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
              <Phone className="h-4 w-4 text-purple-600" />
            </div>
            Buy a phone number
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Country</label>
            <div className="flex gap-2">
              <Select value={country} onValueChange={(v) => { setCountry(v ?? 'US'); setResults([]); setSelected(null); setHasSearched(false) }}>
                <SelectTrigger className="h-10">
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
              <Button onClick={handleSearch} disabled={searching} className="shrink-0 gap-2">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
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
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.number}
                  onClick={() => setSelected(r.number)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all',
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

          <Button className="w-full purple-glow gap-2" disabled={!selected || purchasing} onClick={handlePurchase}>
            {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
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

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function PhonePage() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch]   = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/phone')
      const data = await res.json()
      setNumbers(Array.isArray(data) ? data : [])
    } catch {
      // keep current list
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string) {
    const res = await fetch(`/api/phone/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Number released')
      setNumbers((p) => p.filter((n) => n.id !== id))
    } else {
      toast.error('Failed to release number')
    }
  }

  async function handleToggle(n: PhoneNumber) {
    const res = await fetch(`/api/phone/${n.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !n.is_active }),
    })
    if (res.ok) {
      const updated = await res.json()
      setNumbers((p) => p.map((x) => (x.id === n.id ? updated : x)))
    } else {
      toast.error('Failed to update number')
    }
  }

  function copyNumber(number: string) {
    navigator.clipboard.writeText(number)
    toast.success('Copied')
  }

  const filtered = numbers.filter((n) =>
    !search ||
    n.number.includes(search) ||
    (n.friendly_name ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const activeCount = numbers.filter((n) => n.is_active).length

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Phone Numbers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage virtual numbers and route calls to your AI agents.
          </p>
        </div>
        <Button className="purple-glow gap-2 shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Buy a number
        </Button>
      </div>

      {/* Summary + search */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {numbers.length} number{numbers.length !== 1 ? 's' : ''} · {activeCount} active
        </p>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search numbers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Globe className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {numbers.length === 0 ? 'No phone numbers yet — buy one to start taking calls.' : 'No numbers match your search.'}
          </p>
          {numbers.length === 0 && (
            <Button onClick={() => setAddOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Buy a number</Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <div key={n.id} className="flex items-center justify-between rounded-xl border p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full', n.is_active ? 'bg-green-50' : 'bg-gray-100')}>
                  {n.is_active ? <Phone className="h-4 w-4 text-green-600" /> : <PhoneOff className="h-4 w-4 text-gray-400" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm font-semibold">{formatPhoneNumber(n.number)}</p>
                    <button onClick={() => copyNumber(n.number)} className="text-muted-foreground hover:text-foreground">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {n.agents?.name ? (
                      <><Bot className="h-3 w-3" /> {n.agents.name}</>
                    ) : (
                      'No agent assigned'
                    )}
                    {n.country ? ` · ${n.country}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-2">
                  <Switch checked={n.is_active} onCheckedChange={() => handleToggle(n)} />
                  <span className="text-xs text-muted-foreground w-12">{n.is_active ? 'Active' : 'Paused'}</span>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(n.id)} title="Release number">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Verified badge note */}
      {!loading && numbers.length > 0 && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          Inbound calls are handled automatically once a number is assigned to an agent.
        </p>
      )}

      <AddNumberDialog open={addOpen} onClose={() => setAddOpen(false)} onPurchased={load} />
    </div>
  )
}
