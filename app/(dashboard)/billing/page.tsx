'use client'

import { useState } from 'react'
import {
  CreditCard, Zap, Shield, Layers, Clock, Building2,
  AlertTriangle, ArrowUpRight, ExternalLink, Loader2, Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/hooks/useOrganization'
import { PLANS } from '@/types'
import type { Plan } from '@/types'

const PLAN_META: Record<Plan, { icon: LucideIcon; iconBg: string; iconColor: string }> = {
  trial: { icon: Layers, iconBg: 'bg-gray-100', iconColor: 'text-gray-500' },
  starter: { icon: Layers, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  pro: { icon: Zap, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
  business: { icon: Building2, iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600' },
  custom: { icon: Shield, iconBg: 'bg-gray-900', iconColor: 'text-purple-400' },
}

// Self-serve upgrade path (custom is sales-led, trial is the entry tier).
const UPGRADE_NEXT: Partial<Record<Plan, Plan>> = {
  trial: 'starter',
  starter: 'pro',
  pro: 'business',
}

export default function BillingPage() {
  const { organization: org, isLoading } = useOrganization()
  const [pending, setPending] = useState<string | null>(null)

  async function goToCheckout(plan: Plan) {
    setPending(plan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      toast.error(data.error ?? 'Could not start checkout')
    } catch {
      toast.error('Could not start checkout')
    }
    setPending(null)
  }

  async function openPortal() {
    setPending('portal')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      toast.error(data.error ?? 'Could not open billing portal')
    } catch {
      toast.error('Could not open billing portal')
    }
    setPending(null)
  }

  if (isLoading || !org) {
    return (
      <div className="p-6 max-w-3xl space-y-6">
        <div className="h-44 animate-pulse rounded-2xl bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    )
  }

  const currentPlan = (org.plan ?? 'trial') as Plan
  const planCfg = PLANS[currentPlan]
  const minutesUsed = org.minutes_used ?? 0
  const minutesLimit = org.minutes_limit ?? planCfg.minutes_limit
  const usagePct = minutesLimit > 0 ? Math.min(100, Math.round((minutesUsed / minutesLimit) * 100)) : 0
  const hasBilling = !!org.stripe_customer_id
  const PlanIcon = PLAN_META[currentPlan].icon
  const nextTier: Plan | null = UPGRADE_NEXT[currentPlan] ?? null
  const busy = pending !== null

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your subscription, payment method, and billing history.
        </p>
      </div>

      {/* Current plan + usage */}
      <div className="rounded-2xl overflow-hidden border-2 border-primary shadow-sm">
        <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <PlanIcon className="h-5 w-5 text-yellow-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{planCfg.name} Plan</h2>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    {currentPlan === 'trial' ? 'Trial' : 'Active'}
                  </span>
                </div>
                <p className="text-sm text-purple-200">
                  {planCfg.price_monthly === 0 ? 'No subscription' : `$${planCfg.price_monthly}/month`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-white">${planCfg.price_monthly}</p>
              <p className="text-xs text-purple-200">per month</p>
            </div>
          </div>
        </div>

        <div className="bg-card px-6 py-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">This month&apos;s usage</p>
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Minutes used
              </span>
              <span className={cn('font-semibold', usagePct > 80 ? 'text-orange-500' : 'text-foreground')}>
                {minutesUsed} / {minutesLimit}
              </span>
            </div>
            <Progress value={usagePct} className="h-2" />
            {usagePct > 80 && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-orange-500">
                <AlertTriangle className="h-3 w-3" />
                {100 - usagePct}% of minutes remaining — consider upgrading
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {hasBilling && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={openPortal} disabled={busy}>
                {pending === 'portal' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
                Manage subscription
              </Button>
            )}
            {nextTier && (
              <Button size="sm" className="purple-glow gap-1.5 ml-auto" onClick={() => goToCheckout(nextTier)} disabled={busy}>
                {pending === nextTier ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                Upgrade to {PLANS[nextTier].name}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Plan picker */}
      <div className="rounded-2xl border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Change plan</h2>
        <div className="space-y-3">
          {(Object.keys(PLANS) as Plan[]).map((planId) => {
            const cfg = PLANS[planId]
            const meta = PLAN_META[planId]
            const Icon = meta.icon
            const isCurrent = planId === currentPlan
            const isCustom = planId === 'custom'

            return (
              <div
                key={planId}
                className={cn(
                  'relative rounded-xl border-2 p-4 transition-all',
                  isCustom ? 'bg-gray-950 border-gray-800' : isCurrent ? 'border-primary bg-purple-50/60' : 'border-border'
                )}
              >
                {isCurrent && (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    Current plan
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl', meta.iconBg)}>
                    <Icon className={cn('h-4 w-4', meta.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={cn('font-semibold text-sm', isCustom ? 'text-white' : 'text-foreground')}>
                      {cfg.name}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {cfg.features.slice(0, 3).map((f) => (
                        <span key={f} className={cn('text-[11px]', isCustom ? 'text-gray-400' : 'text-muted-foreground')}>
                          · {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('text-lg font-black', isCustom ? 'text-white' : 'text-foreground')}>
                      ${cfg.price_monthly}{isCustom && '+'}
                      <span className={cn('text-xs font-normal ml-0.5', isCustom ? 'text-gray-400' : 'text-muted-foreground')}>/mo</span>
                    </p>
                    {!isCurrent && isCustom && (
                      <a
                        href="mailto:sales@neuro-tech-voice.com?subject=Custom%20plan%20enquiry"
                        className="mt-1.5 inline-flex h-7 items-center rounded-md border border-gray-600 px-3 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
                      >
                        Contact sales
                      </a>
                    )}
                    {!isCurrent && !isCustom && planId !== 'trial' && (
                      <Button
                        size="sm"
                        variant="default"
                        className={cn('mt-1.5 h-7 text-xs', planId === 'pro' && 'purple-glow')}
                        onClick={() => goToCheckout(planId)}
                        disabled={busy}
                      >
                        {pending === planId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Upgrade'}
                      </Button>
                    )}
                    {!isCurrent && planId === 'trial' && hasBilling && (
                      <Button size="sm" variant="ghost" className="mt-1.5 h-7 text-xs text-muted-foreground" onClick={openPortal} disabled={busy}>
                        Downgrade
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Payment method & invoices → Stripe customer portal */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-muted">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Payment method &amp; invoices</p>
              <p className="text-xs text-muted-foreground">
                Update your card, download invoices, or cancel — securely via Stripe.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={openPortal} disabled={busy || !hasBilling}>
            {pending === 'portal' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
            Open portal
          </Button>
        </div>
        {!hasBilling && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            No billing account yet — upgrade to a paid plan to manage payments here.
          </p>
        )}
      </div>
    </div>
  )
}
