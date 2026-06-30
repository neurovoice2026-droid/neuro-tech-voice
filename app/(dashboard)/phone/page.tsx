'use client'

import { useState } from 'react'
import {
  Phone, Plus, Search, MoreHorizontal, CheckCircle2,
  PhoneCall, PhoneIncoming, PhoneOff, Trash2, Settings2,
  Globe, Copy, RefreshCw, X, Bot,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ─── Demo data ─────────────────────────────────────────────────────────────────
interface PhoneNumber {
  id: string
  number: string
  friendlyName: string
  country: string
  countryFlag: string
  region: string
  status: 'active' | 'inactive' | 'pending'
  assignedAgent: string | null
  callsToday: number
  callsTotal: number
  monthlyFee: string
  purchasedAt: string
  capabilities: ('voice' | 'sms')[]
}

const DEMO_NUMBERS: PhoneNumber[] = [
  {
    id: '1',
    number: '+14155552671',
    friendlyName: 'Main Line',
    country: 'United States',
    countryFlag: '🇺🇸',
    region: 'San Francisco, CA',
    status: 'active',
    assignedAgent: 'Sarah',
    callsToday: 14,
    callsTotal: 342,
    monthlyFee: '$1.15',
    purchasedAt: '2025-03-12',
    capabilities: ['voice', 'sms'],
  },
  {
    id: '2',
    number: '+14085557823',
    friendlyName: 'Support Line',
    country: 'United States',
    countryFlag: '🇺🇸',
    region: 'San Jose, CA',
    status: 'active',
    assignedAgent: 'Alex',
    callsToday: 6,
    callsTotal: 89,
    monthlyFee: '$1.15',
    purchasedAt: '2025-04-01',
    capabilities: ['voice'],
  },
  {
    id: '3',
    number: '+40213001234',
    friendlyName: 'Romania Office',
    country: 'Romania',
    countryFlag: '🇷🇴',
    region: 'Bucharest',
    status: 'inactive',
    assignedAgent: null,
    callsToday: 0,
    callsTotal: 12,
    monthlyFee: '$1.50',
    purchasedAt: '2025-04-20',
    capabilities: ['voice'],
  },
]

const AVAILABLE_NUMBERS = [
  { number: '+14153559876', region: 'San Francisco, CA', price: '$1.15/mo' },
  { number: '+14083021456', region: 'San Jose, CA',      price: '$1.15/mo' },
  { number: '+13105558234', region: 'Los Angeles, CA',   price: '$1.15/mo' },
  { number: '+17185557012', region: 'New York, NY',      price: '$1.15/mo' },
  { number: '+13125556789', region: 'Chicago, IL',       price: '$1.15/mo' },
  { number: '+17135554321', region: 'Houston, TX',       price: '$1.15/mo' },
]

const COUNTRIES = [
  { value: 'US', label: '🇺🇸 United States (+1)',  price: '$1.15/mo' },
  { value: 'GB', label: '🇬🇧 United Kingdom (+44)', price: '$1.50/mo' },
  { value: 'RO', label: '🇷🇴 Romania (+40)',        price: '$1.50/mo' },
  { value: 'DE', label: '🇩🇪 Germany (+49)',        price: '$2.00/mo' },
  { value: 'FR', label: '🇫🇷 France (+33)',         price: '$2.00/mo' },
  { value: 'AU', label: '🇦🇺 Australia (+61)',      price: '$2.50/mo' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatNumber(n: string) {
  if (n.startsWith('+1') && n.length === 12) {
    return `+1 (${n.slice(2, 5)}) ${n.slice(5, 8)}-${n.slice(8)}`
  }
  return n
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

// ─── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: PhoneNumber['status'] }) {
  if (status === 'active')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Active
      </span>
    )
  if (status === 'inactive')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        Inactive
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-700">
      <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
      Pending
    </span>
  )
}

// ─── Add Number Dialog ─────────────────────────────────────────────────────────
function AddNumberDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (n: PhoneNumber) => void
}) {
  const [country, setCountry]       = useState('US')
  const [searching, setSearching]   = useState(false)
  const [searched, setSearched]     = useState(false)
  const [selected, setSelected]     = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState(false)

  function handleSearch() {
    setSearching(true)
    setSelected(null)
    setSearched(false)
    setTimeout(() => {
      setSearching(false)
      setSearched(true)
    }, 1200)
  }

  function handlePurchase() {
    if (!selected) return
    setPurchasing(true)
    setTimeout(() => {
      const info = AVAILABLE_NUMBERS.find((n) => n.number === selected)!
      const countryInfo = COUNTRIES.find((c) => c.value === country)!
      onAdd({
        id: Date.now().toString(),
        number: selected,
        friendlyName: 'New Number',
        country: countryInfo.label.slice(4).split(' ')[0],
        countryFlag: countryInfo.label.slice(0, 2),
        region: info.region,
        status: 'active',
        assignedAgent: null,
        callsToday: 0,
        callsTotal: 0,
        monthlyFee: info.price.replace('/mo', ''),
        purchasedAt: new Date().toISOString().slice(0, 10),
        capabilities: ['voice'],
      })
      setPurchasing(false)
      onClose()
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
              <Phone className="h-4 w-4 text-purple-600" />
            </div>
            Buy a phone number
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Country picker */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Country</label>
            <Select value={country} onValueChange={(v) => { setCountry(v ?? 'US'); setSearched(false); setSelected(null) }}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    <span className="flex items-center justify-between w-full gap-8">
                      <span>{c.label}</span>
                      <span className="text-xs text-muted-foreground">{c.price}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search button */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleSearch}
            disabled={searching}
          >
            {searching ? (
              <><RefreshCw className="h-4 w-4 animate-spin" />Searching available numbers…</>
            ) : (
              <><Search className="h-4 w-4" />Search available numbers</>
            )}
          </Button>

          {/* Results */}
          {searched && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Available numbers
              </p>
              {AVAILABLE_NUMBERS.map((n) => (
                <button
                  key={n.number}
                  type="button"
                  onClick={() => setSelected(n.number)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left transition-all',
                    selected === n.number
                      ? 'border-primary bg-purple-50 ring-1 ring-primary'
                      : 'border-border hover:border-purple-200'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-3.5 w-3.5 rounded-full border-2 flex-shrink-0',
                      selected === n.number ? 'border-primary bg-primary' : 'border-gray-300'
                    )} />
                    <span className="font-mono text-sm font-medium">{formatNumber(n.number)}</span>
                    <span className="text-xs text-muted-foreground">{n.region}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{n.price}</span>
                </button>
              ))}
            </div>
          )}

          {/* Purchase */}
          {selected && (
            <Button
              className="w-full purple-glow"
              onClick={handlePurchase}
              disabled={purchasing}
            >
              {purchasing ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Purchasing…</>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Add {formatNumber(selected)}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Number Card ───────────────────────────────────────────────────────────────
function NumberCard({
  number,
  onDelete,
  onToggleStatus,
}: {
  number: PhoneNumber
  onDelete: (id: string) => void
  onToggleStatus: (id: string) => void
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    copyToClipboard(number.number)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={cn(
      'rounded-2xl border-2 p-5 transition-all duration-200',
      number.status === 'active'
        ? 'border-border bg-card hover:border-purple-200 hover:shadow-sm'
        : 'border-dashed border-gray-200 bg-gray-50/50'
    )}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-xl',
            number.status === 'active' ? 'bg-purple-100' : 'bg-gray-100'
          )}>
            {number.countryFlag}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-mono text-base font-bold text-foreground">
                {formatNumber(number.number)}
              </p>
              <StatusBadge status={number.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {number.friendlyName} · {number.region} · {number.monthlyFee}/mo
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleCopy}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-all hover:border-border hover:bg-muted hover:text-foreground"
            title="Copy number"
          >
            {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-all hover:border-border hover:bg-muted hover:text-foreground outline-none">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onToggleStatus(number.id)}>
                {number.status === 'active' ? (
                  <><PhoneOff className="mr-2 h-4 w-4" />Deactivate</>
                ) : (
                  <><PhoneCall className="mr-2 h-4 w-4" />Activate</>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings2 className="mr-2 h-4 w-4" />
                Configure
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(number.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Release number
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-muted/60 px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-foreground">{number.callsToday}</p>
          <p className="text-[11px] text-muted-foreground">Calls today</p>
        </div>
        <div className="rounded-xl bg-muted/60 px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-foreground">{number.callsTotal}</p>
          <p className="text-[11px] text-muted-foreground">Total calls</p>
        </div>
        <div className="rounded-xl bg-muted/60 px-3 py-2.5 text-center">
          <div className="flex items-center justify-center gap-1">
            {number.capabilities.map((cap) => (
              <span key={cap} className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                cap === 'voice' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
              )}>
                {cap}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Capabilities</p>
        </div>
      </div>

      {/* Agent assignment */}
      <div className="mt-3 flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
        <Bot className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        {number.assignedAgent ? (
          <span className="text-xs text-foreground">
            Routed to agent <span className="font-semibold">{number.assignedAgent}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">No agent assigned</span>
        )}
        {!number.assignedAgent && (
          <button className="ml-auto text-xs font-medium text-primary hover:underline">
            Assign
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function PhonePage() {
  const [numbers, setNumbers]   = useState<PhoneNumber[]>(DEMO_NUMBERS)
  const [search, setSearch]     = useState('')
  const [addOpen, setAddOpen]   = useState(false)
  const [filter, setFilter]     = useState<'all' | 'active' | 'inactive'>('all')

  function handleDelete(id: string) {
    setNumbers((prev) => prev.filter((n) => n.id !== id))
  }

  function handleToggleStatus(id: string) {
    setNumbers((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, status: n.status === 'active' ? 'inactive' : 'active' }
          : n
      )
    )
  }

  function handleAdd(n: PhoneNumber) {
    setNumbers((prev) => [n, ...prev])
  }

  const filtered = numbers.filter((n) => {
    const matchSearch = !search ||
      n.number.includes(search) ||
      n.friendlyName.toLowerCase().includes(search.toLowerCase()) ||
      n.region.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || n.status === filter
    return matchSearch && matchFilter
  })

  const activeCount = numbers.filter((n) => n.status === 'active').length

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
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

      {/* Stats strip */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Total numbers',  value: numbers.length,                           icon: Phone },
          { label: 'Active',         value: activeCount,                              icon: PhoneCall },
          { label: 'Calls today',    value: numbers.reduce((a, n) => a + n.callsToday, 0), icon: PhoneIncoming },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100">
                <Icon className="h-4.5 w-4.5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search numbers, regions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1 rounded-lg border bg-gray-50 p-1">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium capitalize transition-all',
                filter === f ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Number list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Phone className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No numbers found</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {search ? 'Try a different search.' : 'Buy your first number to get started.'}
            </p>
          </div>
          {!search && (
            <Button className="purple-glow mt-2 gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Buy a number
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((n) => (
            <NumberCard
              key={n.id}
              number={n}
              onDelete={handleDelete}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {/* Twilio note */}
      <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <Globe className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Phone numbers are provisioned via Twilio. Monthly fees apply per number depending on country. Numbers can be released at any time — billing stops at the end of the current period.
        </p>
      </div>

      {/* Add dialog */}
      <AddNumberDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
    </div>
  )
}
