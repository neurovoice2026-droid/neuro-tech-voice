'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Zap, Layers, Building2, Shield, Sparkles } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Reveal } from '@/components/marketing/Reveal'
import { PLANS } from '@/types'
import type { Plan } from '@/types'
import { cn } from '@/lib/utils'

// Annual billing = pay for 10 months (2 months free) - same formula the
// onboarding plan picker uses (Step5Launch.tsx priceFor), kept identical so
// the marketing price never drifts from what checkout actually charges.
function priceFor(plan: Plan, annual: boolean): number {
  const monthly = PLANS[plan].price_monthly
  return annual ? Math.round((monthly * 10) / 12) : monthly
}

type Tier = { id: Plan; icon: React.ElementType; highlight?: boolean; dark?: boolean }

const TIERS: Tier[] = [
  { id: 'starter', icon: Layers },
  { id: 'pro', icon: Zap, highlight: true },
  { id: 'business', icon: Building2 },
  { id: 'custom', icon: Shield, dark: true },
]

export function Pricing() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            Pricing
          </div>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
            Simple pricing that scales with your calls
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Every plan starts with a 14-day free trial, {PLANS.trial.minutes_limit} minutes included, no credit card required.
          </p>
        </Reveal>

        <Reveal delay={100} className="mt-10 flex items-center justify-center gap-3">
          <span className={cn('text-sm font-medium', !annual ? 'text-foreground' : 'text-muted-foreground')}>
            Monthly
          </span>
          <Switch checked={annual} onCheckedChange={setAnnual} aria-label="Toggle annual billing" />
          <span className={cn('flex items-center gap-2 text-sm font-medium', annual ? 'text-foreground' : 'text-muted-foreground')}>
            Annual
            {annual && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                2 MONTHS FREE
              </span>
            )}
          </span>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-4 lg:items-start">
          {TIERS.map((tier, i) => (
            <Reveal key={tier.id} delay={i * 100}>
              <PricingCard tier={tier} annual={annual} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function PricingCard({ tier, annual }: { tier: Tier; annual: boolean }) {
  const plan = PLANS[tier.id]
  const price = priceFor(tier.id, annual)
  const Icon = tier.icon

  if (tier.highlight) {
    return (
      <div className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 shadow-xl shadow-purple-500/25 transition-transform duration-300 hover:-translate-y-1 hover:shadow-purple-500/40 lg:-mt-4">
        <div className="flex items-center justify-center gap-1.5 bg-white/15 py-2 text-xs font-bold uppercase tracking-widest text-white">
          Most Popular
        </div>
        <div className="flex flex-1 flex-col p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
            <Icon className="h-5 w-5 text-yellow-300" />
          </span>
          <p className="mt-5 text-lg font-bold text-white">{plan.name}</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-4xl font-black text-white">${price}</span>
            <span className="text-sm text-purple-200">/mo</span>
          </div>
          <p className="mt-1 text-xs text-purple-200">
            {annual ? `billed annually · $${plan.price_annual}/yr` : '14-day free trial'}
          </p>
          <ul className="mt-6 flex-1 space-y-3">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-purple-100">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/25">
                  <Check className="h-2.5 w-2.5 text-white" />
                </span>
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/register"
            className="mt-8 flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-purple-700 shadow-lg transition-all hover:bg-purple-50 hover:shadow-xl"
          >
            Start free trial
          </Link>
        </div>
      </div>
    )
  }

  if (tier.dark) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-gray-800 bg-gray-950 transition-all duration-300 hover:-translate-y-1 hover:border-purple-700/70 hover:shadow-[0_0_30px_rgba(147,51,234,0.15)]">
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-70" />
        <div className="flex flex-1 flex-col p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-900/60">
            <Icon className="h-5 w-5 text-purple-400" />
          </span>
          <p className="mt-5 text-lg font-bold text-white">{plan.name}</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-4xl font-black text-white">${plan.price_monthly}+</span>
            <span className="text-sm text-gray-400">/mo</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">Volume pricing, let&apos;s talk</p>
          <ul className="mt-6 flex-1 space-y-3">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-gray-400">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-purple-900/60">
                  <Check className="h-2.5 w-2.5 text-purple-400" />
                </span>
                {f}
              </li>
            ))}
          </ul>
          <a
            href="tel:+40774566367"
            className="mt-8 flex items-center justify-center rounded-xl border border-purple-600/50 bg-purple-950/60 px-5 py-3 text-sm font-semibold text-purple-300 transition-all hover:border-purple-500 hover:bg-purple-900/60 hover:text-purple-200"
          >
            Contact sales →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
      <div className="flex flex-1 flex-col p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <p className="mt-5 text-lg font-bold text-foreground">{plan.name}</p>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-4xl font-black text-foreground">${price}</span>
          <span className="text-sm text-muted-foreground">/mo</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {annual ? `billed annually · $${plan.price_annual}/yr` : '14-day free trial'}
        </p>
        <ul className="mt-6 flex-1 space-y-3">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/90">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="h-2.5 w-2.5" />
              </span>
              {f}
            </li>
          ))}
        </ul>
        <Link
          href="/register"
          className="mt-8 flex items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-primary/5"
        >
          Start free trial
        </Link>
      </div>
    </div>
  )
}
