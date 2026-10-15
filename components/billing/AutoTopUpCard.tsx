'use client'

import { useId, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { MINUTE_PACKS, isMinutePack, type PackQuote } from '@/lib/billing/minute-packs'
import type { AutoTopUpDto } from '@/lib/billing/minutes-summary'
import { MinutesRequestError, minutesErrorMessage, type AutoTopUpInput } from '@/hooks/useMinutes'
import {
  THRESHOLD_HINT,
  autoTopUpDirty,
  autoTopUpDraftFrom,
  autoTopUpNotice,
  autoTopUpTerms,
  autoTopUpThresholdProblem,
  formatCents,
  formatMinutes,
  formatPurchaseDate,
  parseThreshold,
  type AutoTopUpDraft,
} from './minutes-logic'

interface AutoTopUpCardProps {
  autoTopUp: AutoTopUpDto
  /** The plan's packs with their prices (empty on the trial). */
  packs: PackQuote[]
  /** The plan may buy extra minutes (every plan but the trial). */
  canBuy: boolean
  /** Minutes left now (included + extra): a threshold above it buys a pack right after saving. */
  totalLeft?: number
  /** The plan's included minutes a month: a threshold above them buys packs before they are used up. */
  includedLimit?: number
  onSave: (input: AutoTopUpInput) => Promise<AutoTopUpDto>
  /** Opens the Stripe customer portal (offered when no card is saved). */
  onOpenPortal?: () => void
  /** Another billing action is running. */
  disabled?: boolean
}

const SAVE_ERROR = 'Auto top-up could not be saved.'

/**
 * Auto top-up (off by default): when the minutes left (included + extra) fall
 * below the threshold, the chosen pack is charged to the saved card through a
 * Stripe invoice (lib/billing/auto-topup.ts). A failed charge turns it off and
 * is never retried; turning it back on here clears the failure.
 *
 * The parent keys this card by the saved settings, so a save (or a refresh
 * that changes them) starts the form over from the server's values.
 */
export function AutoTopUpCard({ autoTopUp, packs, canBuy, totalLeft, includedLimit = 0, onSave, onOpenPortal, disabled = false }: AutoTopUpCardProps) {
  const [draft, setDraft] = useState<AutoTopUpDraft>(() => autoTopUpDraftFrom(autoTopUp))
  const [saving, setSaving] = useState(false)
  const switchId = useId()
  const packLabelId = useId()
  const thresholdId = useId()
  const thresholdHintId = useId()

  const quotes = new Map(packs.map((q) => [q.minutes, q]))
  const threshold = parseThreshold(draft.threshold)
  const dirty = autoTopUpDirty(draft, autoTopUp)
  // Unavailable (trial, no subscription): the form is read-only, but a saved "on" can still be turned off.
  const locked = !autoTopUp.available && !autoTopUp.enabled
  const fieldsDisabled = locked || disabled || saving
  const quote = quotes.get(draft.pack)
  // A threshold above the pack would buy pack after pack: the route refuses it, the form says so first.
  const problem = autoTopUpThresholdProblem(draft.pack, threshold)
  const notice =
    totalLeft === undefined ? null : autoTopUpNotice(draft, threshold, { totalLeft, includedLimit, amountCents: quote?.amount_cents ?? null })

  const items: Record<string, string> = {}
  for (const minutes of MINUTE_PACKS) {
    const q = quotes.get(minutes)
    items[String(minutes)] = q ? `${formatMinutes(minutes)} minutes · ${formatCents(q.amount_cents, 'usd')}` : `${formatMinutes(minutes)} minutes`
  }

  async function save() {
    if (threshold === null || problem) return
    setSaving(true)
    try {
      const saved = await onSave({ enabled: draft.enabled, pack: draft.pack, threshold })
      if (saved.enabled) {
        const savedQuote = quotes.get((saved.pack ?? draft.pack) as typeof draft.pack)
        toast.success(`Auto top-up is on. ${autoTopUpTerms(saved.threshold ?? threshold, saved.pack ?? draft.pack, savedQuote?.amount_cents ?? null)}`)
      } else {
        toast.success('Auto top-up is off.')
      }
    } catch (err) {
      const message = minutesErrorMessage(err, SAVE_ERROR)
      const needsCard = err instanceof MinutesRequestError && err.reason === 'payment_method_required' && !!onOpenPortal
      toast.error(message, needsCard ? { action: { label: 'Open portal', onClick: () => onOpenPortal?.() } } : undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl bg-card shadow-hair">
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <h3 id={`${switchId}-label`} className="text-[15px] leading-[22px] font-medium">
            Auto top-up
          </h3>
          <p className="mt-0.5 text-[13px] leading-[19px] text-muted-foreground">
            Buy a pack automatically each time your minutes run low, so you rarely run out.
          </p>
        </div>
        <Switch
          id={switchId}
          aria-labelledby={`${switchId}-label`}
          checked={draft.enabled}
          onCheckedChange={(checked) => setDraft((d) => ({ ...d, enabled: checked }))}
          disabled={fieldsDisabled}
          className="mt-1"
        />
      </div>

      {autoTopUp.last_failed_at && !autoTopUp.enabled && (
        <div className="px-5 pb-4">
          <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{`The last auto top-up failed on ${formatPurchaseDate(autoTopUp.last_failed_at)}, so it was turned off.`}</AlertTitle>
            <AlertDescription>
              {autoTopUp.failure ? `${autoTopUp.failure} ` : ''}
              Update your card in the billing portal, then turn auto top-up back on. Nothing is retried automatically.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="grid gap-4 border-t border-rule p-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label id={packLabelId}>Pack to buy</Label>
          <Select
            items={items}
            value={String(draft.pack)}
            onValueChange={(v) => {
              const n = Number(v)
              if (isMinutePack(n)) setDraft((d) => ({ ...d, pack: n }))
            }}
            disabled={fieldsDisabled}
          >
            <SelectTrigger aria-labelledby={packLabelId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(items).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={thresholdId}>When minutes left fall below</Label>
          <Input
            id={thresholdId}
            inputMode="numeric"
            autoComplete="off"
            value={draft.threshold}
            onChange={(e) => setDraft((d) => ({ ...d, threshold: e.target.value }))}
            aria-invalid={threshold === null || undefined}
            aria-describedby={thresholdHintId}
            disabled={fieldsDisabled}
          />
          <p id={thresholdHintId} className={threshold === null || problem ? 'text-xs leading-4 text-destructive' : 'text-xs leading-4 text-muted-foreground'}>
            {problem ?? THRESHOLD_HINT}
          </p>
        </div>
      </div>

      {notice && !locked && (
        <div className="px-5 pb-5">
          <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-rule p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-[19px] text-muted-foreground">
          {locked
            ? canBuy
              ? 'Auto top-up needs a plan subscription paid by card. Contact us if your plan is billed another way.'
              : 'Auto top-up is available on paid plans.'
            : draft.enabled && threshold !== null && !problem && quote
              ? `${autoTopUpTerms(threshold, draft.pack, quote.amount_cents)} If a charge fails, auto top-up turns off and we email you.`
              : 'Off: when your minutes run out, calls pause until you buy minutes.'}
        </p>
        <Button
          className="shrink-0 self-start sm:self-center"
          onClick={() => void save()}
          disabled={!dirty || threshold === null || problem !== null || fieldsDisabled}
          loading={saving}
          loadingText="Saving…"
        >
          Save
        </Button>
      </div>
    </div>
  )
}
