'use client'

import { useRef, useState } from 'react'
import { AlertCircle, Loader2, MessageSquare, Phone, Search } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { PHONE_NUMBER_MONTHLY_PRICE_USD } from '@/lib/phone/pricing'
import { PHONE_NUMBER_COUNTRIES } from '@/lib/twilio/countries'
import type { AvailableNumber, PhoneSearchResponse } from '@/lib/twilio/types'
import { cn, formatPhoneNumber } from '@/lib/utils'
import { errorMessage, phoneApi } from './api'

interface BuyNumberDialogProps {
  open: boolean
  onClose: () => void
}

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; numbers: AvailableNumber[]; smsAvailable: boolean; preferSms: boolean }

export function BuyNumberDialog({ open, onClose }: BuyNumberDialogProps) {
  const [country, setCountry] = useState('US')
  const [preferSms, setPreferSms] = useState(true)
  const [search, setSearch] = useState<SearchState>({ status: 'idle' })
  const [selected, setSelected] = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const requestId = useRef(0)

  const countryLabel = PHONE_NUMBER_COUNTRIES.find((c) => c.code === country)?.label ?? country

  function resetResults() {
    requestId.current++
    setSearch({ status: 'idle' })
    setSelected(null)
    setPurchaseError(null)
  }

  async function runSearch() {
    const id = ++requestId.current
    setSearch({ status: 'loading' })
    setSelected(null)
    setPurchaseError(null)
    try {
      const params = new URLSearchParams({ country, sms: preferSms ? '1' : '0' })
      const data = await phoneApi<PhoneSearchResponse>(`/api/phone/search?${params}`)
      if (id !== requestId.current) return
      setSearch({ status: 'done', numbers: data.numbers, smsAvailable: data.sms_available, preferSms })
    } catch (err) {
      if (id !== requestId.current) return
      setSearch({ status: 'error', message: errorMessage(err) })
    }
  }

  async function purchase() {
    if (!selected) return
    setPurchasing(true)
    setPurchaseError(null)
    try {
      const data = await phoneApi<{ url: string }>('/api/phone/checkout', {
        method: 'POST',
        body: JSON.stringify({ number: selected, country }),
      })
      window.location.assign(data.url)
    } catch (err) {
      setPurchaseError(errorMessage(err))
      setPurchasing(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (next || purchasing) return
    onClose()
  }

  const results = search.status === 'done' ? search.numbers : []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-purple-100" aria-hidden="true">
              <Phone className="size-4 text-purple-600" />
            </span>
            Get a phone number
          </DialogTitle>
          <DialogDescription>
            Pick a local number. Your agent starts answering it as soon as checkout is complete.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <span id="buy-country-label" className="text-sm font-medium text-foreground">
              Country
            </span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={country}
                onValueChange={(value) => {
                  setCountry((value as string | null) ?? 'US')
                  resetResults()
                }}
              >
                <SelectTrigger className="h-10 w-full sm:flex-1" aria-labelledby="buy-country-label">
                  <SelectValue>
                    {(value: string) => {
                      const c = PHONE_NUMBER_COUNTRIES.find((o) => o.code === value)
                      return c ? (
                        <span className="flex items-center gap-2">
                          <FlagIcon country={c.code} />
                          {c.label}
                        </span>
                      ) : (
                        value
                      )
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PHONE_NUMBER_COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="flex items-center gap-2">
                        <FlagIcon country={c.code} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={runSearch} disabled={search.status === 'loading'} className="h-10 gap-2 sm:shrink-0">
                {search.status === 'loading' ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Search aria-hidden="true" />
                )}
                Search
              </Button>
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
            <div className="min-w-0">
              <label htmlFor="prefer-sms" className="text-sm font-medium text-foreground">
                Prefer numbers that can text
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Needed for booking confirmations and reminders by text.
              </p>
            </div>
            <Switch
              id="prefer-sms"
              checked={preferSms}
              onCheckedChange={(checked) => {
                setPreferSms(checked)
                resetResults()
              }}
              aria-label="Prefer numbers that can send texts"
            />
          </div>

          <div aria-live="polite" className="space-y-2">
            {search.status === 'loading' && (
              <div className="space-y-1.5">
                <span className="sr-only">Loading available numbers…</span>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-[58px] w-full rounded-lg" aria-hidden="true" />
                ))}
              </div>
            )}

            {search.status === 'error' && (
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertDescription>{search.message}</AlertDescription>
              </Alert>
            )}

            {search.status === 'done' && results.length === 0 && (
              <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
                No numbers are available instantly in {countryLabel} right now. Try another country, or check back later.
              </p>
            )}

            {search.status === 'done' && results.length > 0 && search.preferSms && !search.smsAvailable && (
              <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                None of these numbers can send texts, so confirmations and reminders by text won’t be available with them. Calls work normally.
              </p>
            )}

            {results.length > 0 && (
              <div role="radiogroup" aria-label="Available numbers" className="max-h-64 space-y-1.5 overflow-y-auto">
                {results.map((r) => {
                  const isSelected = selected === r.number
                  return (
                    <button
                      key={r.number}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setSelected(r.number)
                        setPurchaseError(null)
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                        isSelected ? 'border-primary bg-purple-50 ring-1 ring-primary' : 'border-border hover:border-purple-200'
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block font-mono text-sm font-medium">{formatPhoneNumber(r.number)}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[r.locality, r.region].filter(Boolean).join(', ') || 'Local number'}
                        </span>
                      </span>
                      {r.capabilities.sms ? (
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                          <MessageSquare aria-hidden="true" />
                          Calls and texts
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Calls only
                        </Badge>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {purchaseError && (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertDescription>{purchaseError}</AlertDescription>
            </Alert>
          )}

          <Button
            className="purple-glow h-10 w-full gap-2 whitespace-normal"
            disabled={!selected || purchasing}
            onClick={purchase}
            aria-busy={purchasing}
          >
            {purchasing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Phone aria-hidden="true" />}
            {purchasing
              ? 'Opening secure checkout…'
              : selected
                ? `Buy ${formatPhoneNumber(selected)} for $${PHONE_NUMBER_MONTHLY_PRICE_USD}/mo`
                : 'Select a number'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            ${PHONE_NUMBER_MONTHLY_PRICE_USD}/month, billed by Stripe. Release the number any time to stop the charge.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
