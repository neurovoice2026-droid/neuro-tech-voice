import Link from 'next/link'
import { Check, Lock } from 'lucide-react'
import { entitlementsFor, requiredPlanFor, type Entitlements } from '@/lib/billing/entitlements'
import { PLANS, type Plan } from '@/types'
import { formatNumber } from './format'

type FeatureKey = {
  [K in keyof Entitlements]: Entitlements[K] extends boolean ? K : never
}[keyof Entitlements]

// Plain-language names for what each entitlement switches on.
const FEATURES: { key: FeatureKey; label: string }[] = [
  { key: 'overageAllowed', label: 'Keeps answering past your included minutes' },
  { key: 'smsConfirmations', label: 'Text message confirmations and reminders' },
  { key: 'outboundCalls', label: 'Outbound calls' },
  { key: 'recordings', label: 'Call recordings' },
  { key: 'googleIntegrations', label: 'Google Calendar, Sheets, Docs, Drive and Gmail' },
  { key: 'voiceCloning', label: 'Voice cloning' },
  // Named for what the dashboard actually unlocks (the calls chart ranges).
  { key: 'advancedAnalytics', label: 'Advanced analytics: 30-day call trends' },
  { key: 'fullAnalytics', label: 'Full analytics suite: 90-day call trends' },
]

export function PlanFeatures({ plan }: { plan: Plan }) {
  const entitlements = entitlementsFor(plan)
  const included = FEATURES.filter((f) => entitlements[f.key])
  const locked = FEATURES.filter((f) => !entitlements[f.key])

  return (
    <section aria-labelledby="features-heading" className="flex h-full flex-col rounded-2xl border bg-card p-5">
      <h2 id="features-heading" className="text-sm font-semibold text-foreground">
        What your {PLANS[plan].name} plan includes
      </h2>

      <ul className="mt-4 space-y-2.5">
        {included.map((feature) => (
          <li key={feature.key} className="flex items-start gap-2.5 text-sm text-foreground">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-green-100">
              <Check className="size-3 text-green-700" aria-hidden="true" />
            </span>
            {feature.label}
          </li>
        ))}
        <li className="flex items-start gap-2.5 text-sm text-foreground">
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-green-100">
            <Check className="size-3 text-green-700" aria-hidden="true" />
          </span>
          <span>
            Voice lab: {formatNumber(entitlements.ttsCharactersPerMonth)} characters of speech and{' '}
            {formatNumber(Math.round(entitlements.sttSecondsPerMonth / 60))} minutes of transcription a month
          </span>
        </li>
        <li className="flex items-start gap-2.5 text-sm text-foreground">
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-green-100">
            <Check className="size-3 text-green-700" aria-hidden="true" />
          </span>
          {entitlements.testCallsPerDay} test calls a day
        </li>
      </ul>

      {locked.length > 0 && (
        <>
          <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">On higher plans</h3>
          <ul className="mt-3 space-y-2.5">
            {locked.map((feature) => {
              const required = requiredPlanFor(feature.key)
              return (
                <li key={feature.key} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{feature.label}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {PLANS[required].name}
                    {required === 'custom' ? '' : '+'}
                  </span>
                </li>
              )
            })}
          </ul>
          <Link
            href="#plans"
            className="mt-auto inline-flex items-center pt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Compare plans
          </Link>
        </>
      )}
    </section>
  )
}
