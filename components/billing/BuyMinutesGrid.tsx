'use client'

import { useEffect, useRef } from 'react'
import { Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MINUTE_PACKS, PACK_DISCOUNTS, type MinutePack } from '@/lib/billing/minute-packs'
import type { MinutesSummaryDto } from '@/lib/billing/minutes-summary'
import { cn } from '@/lib/utils'
import type { BusinessType } from '@/types'
import { discountLabel, formatCents, formatMinutes, formatPerMinute, trialPackPreview } from './minutes-logic'

interface BuyMinutesGridProps {
  summary: MinutesSummaryDto
  /** Starts Stripe Checkout for the pack (the page leaves on success). */
  onBuy: (minutes: MinutePack) => void
  /** The pack whose checkout is starting; any value disables the other buttons. */
  pending: MinutePack | null
  /** Another billing action is running (a plan change, the portal). */
  disabled?: boolean
  /**
   * The pack a link asked for (/billing?buy=100#minutes): its card is
   * highlighted and its Buy button takes the focus once it can be pressed.
   * Nothing is bought until the owner presses it.
   */
  highlight?: MinutePack | null
  /**
   * The organization's business type: an organization that cannot buy yet
   * (the trial) sees what the packs cost on its family's plans.
   */
  businessType?: BusinessType | null
}

/**
 * The four prepaid packs at the plan's extra-minute price, less the volume
 * discount (lib/billing/minute-packs.ts; the server prices the pack again
 * from the plan it has stored, never from this page). On the trial the packs
 * cannot be bought: they show what they cost on the family's first plan, and
 * the family's rates ("$0.20 a minute on every plan") say the rest.
 */
export function BuyMinutesGrid({ summary, onBuy, pending, disabled = false, highlight = null, businessType = null }: BuyMinutesGridProps) {
  const canBuy = summary.can_buy && summary.packs.length > 0
  const preview = canBuy ? null : trialPackPreview(businessType)
  const quotes = new Map((canBuy ? summary.packs : (preview?.quotes ?? [])).map((q) => [q.minutes, q]))
  // Only a pack this plan can buy is highlighted (never on the trial).
  const highlighted = highlight !== null && canBuy && quotes.has(highlight) ? highlight : null
  const highlightButton = useRef<HTMLButtonElement>(null)
  const focusedFor = useRef<MinutePack | null>(null)
  const focusable = highlighted !== null && !disabled && pending === null

  // Focus the requested pack's Buy button once per request (pressing it is still up to the owner).
  useEffect(() => {
    if (!focusable || highlighted === null || focusedFor.current === highlighted) return
    focusedFor.current = highlighted
    highlightButton.current?.focus()
  }, [focusable, highlighted])

  return (
    <div className="space-y-3">
      <ul aria-label="Extra minute packs" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MINUTE_PACKS.map((minutes) => {
          const quote = quotes.get(minutes)
          const badge = discountLabel(quote?.discount ?? PACK_DISCOUNTS[minutes])
          const isHighlighted = minutes === highlighted
          return (
            <li
              key={minutes}
              data-highlighted={isHighlighted || undefined}
              className={cn('relative flex flex-col rounded-2xl bg-card p-4 shadow-hair', isHighlighted && 'ring-2 ring-primary')}
            >
              <h4 className="text-[15px] leading-[22px] font-medium tabular-nums">{formatMinutes(minutes)} min</h4>
              {/* A tab on the card's top edge, so it never pushes the price down. */}
              {isHighlighted && <Badge className="absolute -top-3 right-3">Selected</Badge>}
              {/* The discount's own row, as tall on the 100-minute card (no discount), so all four prices line up. */}
              <div className="mt-1 flex h-6 items-center">{badge && <Badge variant="success">{badge}</Badge>}</div>
              {quote ? (
                <>
                  <p className="mt-2 text-[22px] leading-7 font-semibold tracking-[-0.02em] tabular-nums">
                    {formatCents(quote.amount_cents, 'usd')}
                  </p>
                  <p className="text-xs leading-4 text-muted-foreground tabular-nums">
                    {formatPerMinute(quote.per_minute_cents)} a minute
                    {preview && !preview.uniform ? ` on ${preview.planName}` : ''}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-[22px] leading-7 font-semibold tracking-[-0.02em] text-muted-foreground">—</p>
                  <p className="text-xs leading-4 text-muted-foreground">Priced by plan</p>
                </>
              )}
              <div className="mt-auto pt-4">
                <Button
                  ref={isHighlighted ? highlightButton : undefined}
                  variant={isHighlighted ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => onBuy(minutes)}
                  disabled={!canBuy || !quote || disabled || pending !== null}
                  loading={pending === minutes}
                  loadingText="Redirecting…"
                >
                  Buy
                  <span className="sr-only">
                    {' '}
                    {formatMinutes(minutes)} extra minutes{quote && canBuy ? ` for ${formatCents(quote.amount_cents, 'usd')}` : ''}
                  </span>
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {canBuy ? (
        <p className="text-xs leading-4 text-muted-foreground">
          Prepaid, charged once. Extra minutes never expire and are used only after your plan&apos;s included minutes.
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-[13px] leading-[19px] text-muted-foreground">
          <Info className="size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {preview ? `Extra minutes cost ${preview.rate}, less in bigger packs. Choose a plan to buy them.` : 'Choose a plan to buy extra minutes.'}{' '}
            <a href="#plans" className="font-medium text-foreground underline underline-offset-4">See plans</a>
          </span>
        </p>
      )}
    </div>
  )
}
