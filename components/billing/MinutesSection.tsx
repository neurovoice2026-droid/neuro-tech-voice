'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { CardError } from '@/components/dashboard/CardError'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { SectionHeading } from '@/components/shared/SectionHeading'
import type { MinutePack } from '@/lib/billing/minute-packs'
import { outOfMinutesChoice } from '@/lib/billing/upgrade'
import { minutesErrorMessage, type AutoTopUpInput, type UseMinutes } from '@/hooks/useMinutes'
import { useAppStore } from '@/store/useAppStore'
import { AutoTopUpCard } from './AutoTopUpCard'
import { BuyMinutesGrid } from './BuyMinutesGrid'
import { MinutesCard } from './MinutesCard'
import { PurchaseHistory } from './PurchaseHistory'
import { minutesSectionDescription, parseBuyParam } from './minutes-logic'

/** The anchor every "Buy minutes" link points at (/billing#minutes). */
export const MINUTES_ANCHOR = 'minutes'

interface MinutesSectionProps {
  /** useMinutes(), owned by the page so a plan change can refresh it. */
  minutes: UseMinutes
  /** Opens the Stripe customer portal (for a missing card). */
  onOpenPortal?: () => void
  /** Another billing action is running. */
  disabled?: boolean
}

/**
 * Reports the pack of /billing?buy=<minutes> (the banner's, the e-mail's and
 * the store overview's "Buy 100 minutes" link). Its own Suspense boundary
 * keeps the search-params read from holding up the rest of the section.
 */
function BuyParam({ onChange }: { onChange: (pack: MinutePack | null) => void }) {
  const pack = parseBuyParam(useSearchParams().get('buy'))
  useEffect(() => {
    onChange(pack)
  }, [pack, onChange])
  return null
}

/**
 * The billing page's Minutes section (id="minutes"): included and extra
 * minutes (with the out-of-minutes choice at zero: the next plan up or 100
 * minutes), the packs to buy, auto top-up and the purchase history.
 * ?buy=<minutes> highlights and focuses that pack; it never buys by itself.
 */
export function MinutesSection({ minutes, onOpenPortal, disabled = false }: MinutesSectionProps) {
  const router = useRouter()
  const { summary, isLoading, error, refresh, buy, saveAutoTopUp } = minutes
  const [buying, setBuying] = useState<MinutePack | null>(null)
  const [requested, setRequested] = useState<MinutePack | null>(null)
  // The billing page loads the organization into the app store before this section renders:
  // its business type picks the plan family a trial upgrades within, its plan words the section.
  const businessType = useAppStore((s) => s.organization?.business_type ?? null)
  const orgPlan = useAppStore((s) => s.organization?.plan ?? null)
  const plan = summary?.plan ?? orgPlan

  /** Saves auto top-up, then re-renders the layout: its "running low" banner hides while auto top-up is on. */
  async function onSaveAutoTopUp(input: AutoTopUpInput) {
    const saved = await saveAutoTopUp(input)
    router.refresh()
    return saved
  }

  // Back from Stripe Checkout through the browser's page cache: the buttons work again.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBuying(null)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  async function onBuy(pack: MinutePack) {
    setBuying(pack)
    try {
      await buy(pack)
      // The browser is leaving for Stripe Checkout: keep the button's orb until it does.
    } catch (err) {
      toast.error(minutesErrorMessage(err, 'Could not start checkout.'))
      setBuying(null)
    }
  }

  return (
    <section id={MINUTES_ANCHOR} aria-label="Minutes" className="scroll-mt-6">
      <Suspense fallback={null}>
        <BuyParam onChange={setRequested} />
      </Suspense>
      <SectionHeading
        title="Minutes"
        description={minutesSectionDescription(plan, plan === 'trial' && summary ? summary.included.limit : undefined)}
      />
      {isLoading && !summary ? (
        <OrbLoader label="Loading your minutes…" className="min-h-[240px]" />
      ) : !summary ? (
        <div className="rounded-2xl bg-card shadow-hair">
          <CardError message="Your minutes could not be loaded." detail={error} onRetry={refresh} />
        </div>
      ) : (
        <div className="space-y-6">
          <MinutesCard
            summary={summary}
            choice={summary.paused ? outOfMinutesChoice(summary.plan, businessType) : null}
            onBuy={(pack) => void onBuy(pack)}
            pending={buying}
            disabled={disabled}
          />

          <div>
            <h3 className="mb-3 text-[15px] leading-[22px] font-medium">Buy extra minutes</h3>
            <BuyMinutesGrid
              summary={summary}
              onBuy={(pack) => void onBuy(pack)}
              pending={buying}
              disabled={disabled}
              highlight={requested}
              businessType={businessType}
            />
          </div>

          <AutoTopUpCard
            key={`${summary.auto_topup.enabled}-${summary.auto_topup.pack}-${summary.auto_topup.threshold}-${summary.auto_topup.last_failed_at}`}
            autoTopUp={summary.auto_topup}
            packs={summary.packs}
            canBuy={summary.can_buy}
            totalLeft={summary.total_left}
            includedLimit={summary.included.limit}
            onSave={onSaveAutoTopUp}
            onOpenPortal={onOpenPortal}
            disabled={disabled}
          />

          <PurchaseHistory purchases={summary.purchases} />

          {error && (
            <p role="status" className="text-xs leading-4 text-muted-foreground">
              The latest update could not be loaded; showing the last known figures.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
