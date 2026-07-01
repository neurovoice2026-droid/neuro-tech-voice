'use client'

import { useState, useTransition } from 'react'
import { Phone, PhoneCall, Clock, ArrowRight, ArrowLeft, Search, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { cn, formatPhoneNumber } from '@/lib/utils'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────
interface AvailableNumber {
  number: string
  friendly_name: string
  locality: string
  region: string
  price: string
}

const COUNTRIES = [
  { value: 'US', label: 'United States (+1)' },
  { value: 'GB', label: 'United Kingdom (+44)' },
  { value: 'RO', label: 'Romania (+40)' },
  { value: 'DE', label: 'Germany (+49)' },
  { value: 'FR', label: 'France (+33)' },
  { value: 'AU', label: 'Australia (+61)' },
]

// ─── Component ────────────────────────────────────────────────────────────────
export function Step4Phone() {
  const { setPhone, setStep } = useOnboardingStore()
  const [isPending, startTransition] = useTransition()

  const [selectedOption, setSelectedOption] = useState<'buy' | 'skip' | null>(null)
  const [country, setCountry] = useState('US')
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([])
  const [selectedNumber, setSelectedNumber] = useState<AvailableNumber | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [purchasedNumber, setPurchasedNumber] = useState<{ number: string; twilio_sid: string } | null>(null)

  async function searchNumbers() {
    setIsSearching(true)
    setAvailableNumbers([])
    setSelectedNumber(null)
    try {
      const res = await fetch(`/api/phone/search?country=${country}`)
      const data = await res.json()
      setAvailableNumbers(Array.isArray(data) ? data : [])
    } catch {
      setAvailableNumbers([])
    } finally {
      setIsSearching(false)
    }
  }

  function handlePurchase() {
    if (!selectedNumber) return
    startTransition(async () => {
      try {
        const res = await fetch('/api/onboarding/phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: selectedNumber.number,
            country,
            skipped: false,
          }),
        })
        const data = await res.json()
        if (res.ok && data.number) {
          setPurchasedNumber({ number: data.number, twilio_sid: data.twilio_sid ?? '' })
          toast.success('Number purchased')
        } else {
          toast.error(data.error ?? 'Could not purchase this number. Check that Twilio is configured, or pick another number.')
        }
      } catch {
        toast.error('Purchase failed — please try again.')
      }
    })
  }

  function handleContinue() {
    if (selectedOption === 'skip') {
      setPhone({ number: '', twilio_sid: '', skipped: true })
      setStep(5) // → Integrations
      return
    }

    if (purchasedNumber) {
      setPhone({ number: purchasedNumber.number, twilio_sid: purchasedNumber.twilio_sid, skipped: false })
      setStep(5) // → Integrations
    }
  }

  const canContinue = selectedOption === 'skip' || !!purchasedNumber

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col items-start gap-4">
        <div className="rounded-xl bg-purple-100 p-2.5">
          <Phone className="h-7 w-7 text-purple-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Add a phone number</h2>
          <p className="mt-1 text-muted-foreground">
            Your AI agent needs a number to receive calls
          </p>
        </div>
      </div>

      {/* Option cards */}
      <div className="space-y-4">
        {/* Option A — Buy */}
        <div
          onClick={() => setSelectedOption('buy')}
          className={cn(
            'cursor-pointer rounded-xl border p-6 transition-all duration-150',
            selectedOption === 'buy'
              ? 'border-primary bg-purple-50 ring-2 ring-primary'
              : 'border-border hover:border-purple-200 hover:bg-purple-50/30'
          )}
        >
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-white p-2 shadow-sm">
              <PhoneCall className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground">Buy a virtual number</p>
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 text-xs">
                  Recommended
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                A dedicated number is <strong>included with every paid plan</strong>. Pick a plan on the next step, then add your number — here or from the dashboard.
              </p>
            </div>
          </div>

          {/* Expanded buy section */}
          {selectedOption === 'buy' && !purchasedNumber && (
            <div className="mt-5 space-y-4 border-t border-purple-100 pt-5">
              {/* Country + Search */}
              <div className="flex gap-3">
                <Select value={country} onValueChange={(v) => v && setCountry(v)}>
                  <SelectTrigger className="h-10 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-2"
                  onClick={searchNumbers}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {isSearching ? 'Searching…' : 'Search'}
                </Button>
              </div>

              {/* Available numbers */}
              {availableNumbers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Available numbers
                  </p>
                  {availableNumbers.map((n) => (
                    <div
                      key={n.number}
                      onClick={() => setSelectedNumber(n)}
                      className={cn(
                        'flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-all',
                        selectedNumber?.number === n.number
                          ? 'border-l-4 border-primary bg-purple-50 pl-3'
                          : 'border-border hover:border-purple-200'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'h-4 w-4 rounded-full border-2 flex-shrink-0',
                            selectedNumber?.number === n.number
                              ? 'border-primary bg-primary'
                              : 'border-gray-300'
                          )}
                        />
                        <span className="font-mono text-sm font-medium">
                          {formatPhoneNumber(n.number)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {n.locality}{n.locality && n.region ? ', ' : ''}{n.region}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{n.price}</span>
                    </div>
                  ))}

                  {/* Purchase button */}
                  <Button
                    type="button"
                    className="mt-2 w-full purple-glow"
                    disabled={!selectedNumber || isPending}
                    onClick={handlePurchase}
                  >
                    {isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Purchasing…</>
                    ) : (
                      `Add this number — ${selectedNumber?.price ?? '$1.15/mo'}`
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Purchase success */}
          {selectedOption === 'buy' && purchasedNumber && (
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">Number added successfully!</p>
                <p className="font-mono text-sm text-green-700">
                  {formatPhoneNumber(purchasedNumber.number)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Option B — Skip */}
        <div
          onClick={() => setSelectedOption('skip')}
          className={cn(
            'cursor-pointer rounded-xl border p-6 transition-all duration-150',
            selectedOption === 'skip'
              ? 'border-primary bg-purple-50 ring-2 ring-primary'
              : 'border-border hover:border-purple-200 hover:bg-purple-50/30'
          )}
        >
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-gray-100 p-2">
              <Clock className="h-6 w-6 text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-muted-foreground">Add a number later</p>
              <p className="mt-1 text-sm text-muted-foreground">
                You can add a phone number from your dashboard after setup is complete.
              </p>
              <div className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                Agent won&apos;t receive calls until a number is added
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setStep(3)} disabled={isPending} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!canContinue || isPending}
          className="purple-glow px-6"
        >
          {isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving&hellip;</>
          ) : (
            <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
          )}
        </Button>
      </div>
    </div>
  )
}
