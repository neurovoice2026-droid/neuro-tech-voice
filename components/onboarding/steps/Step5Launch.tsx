'use client'
// Step 4, "Go live": pick a plan and create the agent, then a checklist of
// what's left before it answers real callers (test call, number, calendar).
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Rocket, Check, Building2, Bot, Mic2, CreditCard, ArrowLeft, ArrowRight, Zap, Shield, Star,
  Layers, Gift, CheckCircle2, Globe, Languages, Loader2, TriangleAlert, Phone, CalendarCheck, AudioLines,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { UpgradeNotice } from '@/components/shared/UpgradeNotice'
import { TestCallPanel } from '@/components/voice/TestCallPanel'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { cn } from '@/lib/utils'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { parseApiError } from '@/lib/audio/call-protocol'
import { entitlementsFor, requiredPlanFor } from '@/lib/billing/entitlements'
import { TONE_PROFILES } from '@/lib/voice/tone'
import { PLANS } from '@/types'
import type { Plan } from '@/types'
import {
  ONBOARDING_STEPS, buildCompletionBody, firstIncompleteStep, type OnboardingData, type OnboardingOrganization,
} from '@/app/onboarding/_lib/onboarding-state'
import { timeZoneOption } from '@/app/onboarding/_lib/timezones'
import { StepHeader } from '../StepHeader'

interface StepLaunchProps {
  organization: OnboardingOrganization
  /** The organisation already has an active number (e.g. returning after a cancelled checkout). */
  hasPhoneNumber: boolean
  calendarConnected: boolean
  /** Called once the agent exists and the checklist is showing. */
  onLaunched?: () => void
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = [
  '#9333ea', '#a855f7', '#c084fc',
  '#ec4899', '#f472b6',
  '#3b82f6', '#60a5fa',
  '#f59e0b', '#fbbf24',
  '#10b981', '#34d399',
  '#f97316', '#fb923c',
]

interface ConfettiParticle {
  id: number; left: number; delay: number; duration: number
  color: string; size: number; rotation: number; isCircle: boolean; sway: number
}

function makeParticles(count: number): ConfettiParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.4,
    duration: 2 + Math.random() * 2,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: 6 + Math.random() * 10,
    rotation: Math.random() * 360,
    isCircle: Math.random() > 0.55,
    sway: (Math.random() > 0.5 ? 1 : -1) * (30 + Math.random() * 70),
  }))
}

function Confetti() {
  const [particles] = useState(() => makeParticles(110))
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 4500)
    return () => window.clearTimeout(timer)
  }, [])
  if (!visible) return null
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden motion-reduce:hidden">
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-12px) rotate(0deg) translateX(0px); opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg) translateX(var(--sway)); opacity: 0; }
        }
      `}</style>
      {particles.map((p) => (
        <div key={p.id} style={{
          position: 'absolute', left: `${p.left}%`, top: '-12px',
          width: p.size, height: p.isCircle ? p.size : p.size * 0.45,
          backgroundColor: p.color, borderRadius: p.isCircle ? '50%' : '2px',
          transform: `rotate(${p.rotation}deg)`,
          ['--sway' as string]: `${p.sway}px`,
          animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  )
}

// ─── Summary Row ──────────────────────────────────────────────────────────────
function SummaryRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="flex shrink-0 items-center gap-2.5 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

// ─── Plan Cards (horizontal stacked) ─────────────────────────────────────────
interface PlanCardProps { id: Plan; selected: boolean; onSelect: () => void; annual: boolean }

// Annual billing = pay for 10 months (2 months free).
function priceFor(id: Plan, annual: boolean): number {
  const monthly = PLANS[id].price_monthly
  return annual ? Math.round((monthly * 10) / 12) : monthly
}

// Generic light card used for the self-serve paid tiers (Starter, Business).
function LightPlanCard({ id, selected, onSelect, annual, icon: Icon }: PlanCardProps & { icon: React.ElementType }) {
  const p = PLANS[id]
  const price = priceFor(id, annual)
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group cursor-pointer overflow-hidden rounded-2xl border-2 transition-all duration-200',
        selected
          ? 'border-primary shadow-lg ring-2 ring-primary ring-offset-2'
          : 'border-border hover:border-purple-300 hover:shadow-md'
      )}
    >
      <div className="flex flex-col sm:flex-row sm:min-h-[130px] sm:items-stretch">
        {/* Left identity panel */}
        <div className="flex w-full sm:w-52 sm:flex-shrink-0 flex-col justify-between gap-2 bg-gray-50 p-5 transition-colors group-hover:bg-gray-100/70">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-200">
            <Icon className="h-4.5 w-4.5 text-gray-500" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.minutes_limit.toLocaleString()} minutes/month</p>
          </div>
          <div>
            <span className="text-3xl font-black text-foreground">${price}</span>
            <span className="ml-1 text-xs text-muted-foreground">/ month</span>
            <p className="text-[11px] text-muted-foreground">
              {annual ? 'billed annually · 2 months free' : '14-day free trial'}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px flex-shrink-0 bg-border" />

        {/* Features + CTA */}
        <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-4 px-5 py-5 sm:px-6">
          <ul className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {p.features.map((f) => (
              <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            aria-pressed={selected}
            onClick={(e) => { e.stopPropagation(); onSelect() }}
            className={cn('h-9 shrink-0 px-5', selected && 'border-primary text-primary')}
          >
            {selected ? 'Selected' : `Choose ${p.name}`}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ProPlanCard({ selected, onSelect, annual }: PlanCardProps) {
  const monthly = PLANS.pro.price_monthly
  const price   = priceFor('pro', annual)

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group cursor-pointer overflow-hidden rounded-2xl transition-all duration-200',
        'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700',
        'shadow-xl shadow-purple-500/25',
        selected
          ? 'ring-4 ring-white/70 ring-offset-2 ring-offset-purple-700'
          : 'hover:shadow-purple-500/40'
      )}
    >
      {/* Most Popular strip */}
      <div className="flex items-center justify-center gap-1.5 bg-white/15 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white">
        <Star className="h-3 w-3 fill-current text-yellow-300" aria-hidden="true" />
        Most Popular
        <Star className="h-3 w-3 fill-current text-yellow-300" aria-hidden="true" />
      </div>

      <div className="flex flex-col sm:flex-row sm:min-h-[130px] sm:items-stretch">
        {/* Left identity */}
        <div className="flex w-full sm:w-52 sm:flex-shrink-0 flex-col justify-between gap-2 bg-white/10 p-5 backdrop-blur-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
            <Zap className="h-4.5 w-4.5 text-yellow-300" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">Pro</p>
            <p className="text-xs text-purple-200">{PLANS.pro.minutes_limit.toLocaleString()} minutes/month</p>
          </div>
          <div>
            <span className="text-3xl font-black text-white">${price}</span>
            <span className="ml-1 text-xs text-purple-200">/ month</span>
            {annual ? (
              <p className="text-[11px] text-purple-300 mt-0.5">
                <span className="line-through opacity-60">${monthly}/mo</span> · 2 months free
              </p>
            ) : (
              <p className="text-[11px] text-purple-300">14-day free trial</p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px flex-shrink-0 bg-white/20" />

        {/* Features + CTA */}
        <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-4 px-5 py-5 sm:px-6">
          <ul className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {PLANS.pro.features.map((f) => (
              <li key={f} className="flex items-center gap-1.5 text-xs text-purple-100">
                <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-white/25">
                  <Check className="h-2.5 w-2.5 text-white" aria-hidden="true" />
                </div>
                {f}
              </li>
            ))}
          </ul>
          <button
            type="button"
            aria-pressed={selected}
            onClick={(e) => { e.stopPropagation(); onSelect() }}
            className="shrink-0 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-purple-700 shadow-lg outline-none transition-all hover:bg-purple-50 hover:shadow-xl focus-visible:ring-3 focus-visible:ring-white/70 active:scale-95"
          >
            {selected ? 'Selected' : 'Start free trial'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CustomPlanCard({ selected, onSelect }: PlanCardProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group cursor-pointer overflow-hidden rounded-2xl border-2 transition-all duration-200',
        'bg-gray-950',
        selected
          ? 'border-purple-500 ring-2 ring-purple-500/40 ring-offset-2 shadow-[0_0_30px_rgba(147,51,234,0.2)]'
          : 'border-gray-800 hover:border-purple-700/70 hover:shadow-[0_0_20px_rgba(147,51,234,0.12)]'
      )}
    >
      {/* Top neon accent bar */}
      <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-70" />

      <div className="flex flex-col sm:flex-row sm:min-h-[130px] sm:items-stretch">
        {/* Left identity */}
        <div className="flex w-full sm:w-52 sm:flex-shrink-0 flex-col justify-between gap-2 border-gray-800 bg-black/30 p-5 sm:border-r">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-900/60">
            <Shield className="h-4.5 w-4.5 text-purple-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">Custom</p>
            <p className="text-xs text-gray-400">For large teams & agencies</p>
          </div>
          <div>
            <span className="text-3xl font-black text-white">${PLANS.custom.price_monthly}+</span>
            <span className="ml-1 text-xs text-gray-400">/ month</span>
            <p className="text-[11px] text-gray-500">Volume pricing · let&apos;s talk</p>
          </div>
        </div>

        {/* Features + CTA */}
        {/* Side by side only from lg: at tablet width the two feature columns and the button squeeze each other. */}
        <div className="flex flex-1 flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center">
          <ul className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {PLANS.custom.features.map((f) => (
              <li key={f} className="flex items-center gap-1.5 text-xs text-gray-400">
                <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-purple-900/60">
                  <Check className="h-2.5 w-2.5 text-purple-400" aria-hidden="true" />
                </div>
                {f}
              </li>
            ))}
          </ul>
          {/* Custom button — no shadcn variant="outline" to avoid white-on-white */}
          <button
            type="button"
            aria-pressed={selected}
            onClick={(e) => { e.stopPropagation(); onSelect() }}
            className="shrink-0 rounded-xl border border-purple-600/50 bg-purple-950/60 px-5 py-2.5 text-sm font-semibold text-purple-300 outline-none transition-all hover:border-purple-500 hover:bg-purple-900/60 hover:text-purple-200 hover:shadow-[0_0_12px_rgba(147,51,234,0.3)] focus-visible:ring-3 focus-visible:ring-purple-400/60 active:scale-95"
          >
            {selected ? 'Selected' : 'Choose Custom'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Free Trial card (no card required) ──────────────────────────────────────
function TrialPlanCard({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const p = PLANS.trial
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group cursor-pointer overflow-hidden rounded-2xl border-2 transition-all duration-200',
        selected
          ? 'border-primary bg-purple-50 ring-2 ring-primary ring-offset-2 shadow-lg'
          : 'border-emerald-300 bg-emerald-50/40 hover:border-emerald-400 hover:shadow-md'
      )}
    >
      <div className="flex items-center justify-center gap-1.5 bg-emerald-500/10 px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-widest text-emerald-700">
        <Star className="h-3 w-3 shrink-0 fill-current" aria-hidden="true" /> Best to start · no card required
      </div>
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <div className="flex w-full sm:w-52 sm:flex-shrink-0 flex-col justify-between gap-2 p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
            <Gift className="h-4.5 w-4.5 text-emerald-600" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">Free Trial</p>
            <p className="text-xs text-muted-foreground">Set everything up, no payment</p>
          </div>
          <div>
            <span className="text-3xl font-black text-foreground">$0</span>
            <p className="text-[11px] text-muted-foreground">{p.minutes_limit} minutes · 14 days</p>
          </div>
        </div>
        <div className="hidden sm:block w-px flex-shrink-0 bg-emerald-100" />
        <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-4 px-5 py-5 sm:px-6">
          <ul className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {p.features.map((f) => (
              <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant={selected ? 'default' : 'outline'}
            aria-pressed={selected}
            onClick={(e) => { e.stopPropagation(); onSelect() }}
            className={cn('h-9 shrink-0 px-5', selected ? 'purple-glow' : 'border-emerald-400 text-emerald-700 hover:bg-emerald-50')}
          >
            {selected ? 'Selected' : 'Start free'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Completion ───────────────────────────────────────────────────────────────

function pickDraft(): OnboardingData {
  const s = useOnboardingStore.getState()
  return {
    orgId: s.orgId, currentStep: s.currentStep, company: s.company, agent: s.agent,
    voice: s.voice, voiceLanguage: s.voiceLanguage, edited: s.edited, plan: s.plan, annual: s.annual,
  }
}

function isPlan(value: unknown): value is Plan {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLANS, value)
}

/** Stripe Checkout is always served over https; anything else isn't followed. */
function isSafeRedirect(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

type LaunchStatus =
  | { name: 'idle' }
  | { name: 'launching' }
  | { name: 'redirecting' }
  | { name: 'error'; message: string; signIn: boolean }

interface LaunchedAgent {
  plan: Plan
  agentName: string
  companyName: string
}

// ─── Component ────────────────────────────────────────────────────────────────
export function StepLaunch({ organization, hasPhoneNumber, calendarConnected, onLaunched }: StepLaunchProps) {
  const plan = useOnboardingStore((s) => s.plan)
  const annual = useOnboardingStore((s) => s.annual)
  const company = useOnboardingStore((s) => s.company)
  const agent = useOnboardingStore((s) => s.agent)
  const voice = useOnboardingStore((s) => s.voice)
  const setPlan = useOnboardingStore((s) => s.setPlan)
  const setAnnual = useOnboardingStore((s) => s.setAnnual)
  const setStep = useOnboardingStore((s) => s.setStep)

  const [status, setStatus] = useState<LaunchStatus>({ name: 'idle' })
  const [launched, setLaunched] = useState<LaunchedAgent | null>(null)

  // The browser's Back button from Stripe Checkout can restore this page from
  // the back/forward cache with "Opening secure checkout…" still showing and
  // the button disabled; a restored page starts idle again.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setStatus((current) => (current.name === 'redirecting' ? { name: 'idle' } : current))
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  const incompleteStep = firstIncompleteStep({ company, agent, voice })
  const busy = status.name === 'launching' || status.name === 'redirecting'
  const languageLabel = AGENT_LANGUAGES.find((l) => l.value === agent.language)?.label ?? agent.language

  async function completeOnboarding() {
    if (busy) return
    const draft = pickDraft()
    if (firstIncompleteStep(draft) !== null) return

    setStatus({ name: 'launching' })
    let response: Response
    try {
      response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCompletionBody(draft)),
        cache: 'no-store',
      })
    } catch (error) {
      console.warn('[onboarding] completion request failed', error)
      const message = 'We couldn’t reach Neuro Tech Voice. Check your internet connection and try again. Your answers are saved.'
      setStatus({ name: 'error', message, signIn: false })
      toast.error(message)
      return
    }

    // A non-JSON body is treated like any other failed response.
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const info = parseApiError(response.status, body)
      const message =
        info.status === 401
          ? 'Your session has expired. Sign in again and you’ll pick up where you left off.'
          : info.status === 429
            ? info.message ?? 'Too many attempts in a short time. Please wait a minute and try again.'
            : info.message ?? 'We couldn’t finish setting up your agent. Your answers are saved, so you can try again.'
      setStatus({ name: 'error', message, signIn: info.status === 401 })
      toast.error(message)
      return
    }

    const data = (body && typeof body === 'object' ? body : {}) as { checkout_url?: unknown; plan?: unknown }
    if (typeof data.checkout_url === 'string' && data.checkout_url) {
      if (!isSafeRedirect(data.checkout_url)) {
        console.warn('[onboarding] refusing a non-https checkout URL')
        const message = 'We couldn’t open checkout. Please try again.'
        setStatus({ name: 'error', message, signIn: false })
        toast.error(message)
        return
      }
      // Paid plan: Stripe Checkout. A cancelled checkout comes back here with the draft intact.
      setStatus({ name: 'redirecting' })
      window.location.assign(data.checkout_url)
      return
    }

    const effectivePlan: Plan = isPlan(data.plan) ? data.plan : PLANS[draft.plan].contact_sales ? 'trial' : draft.plan
    // Onboarding is finished on the server; the tab no longer needs the draft.
    useOnboardingStore.persist.clearStorage()
    setStatus({ name: 'idle' })
    setLaunched({ plan: effectivePlan, agentName: draft.agent.name.trim(), companyName: draft.company.name.trim() })
    onLaunched?.()
  }

  if (launched) {
    return (
      <ReadyChecklist
        agentName={launched.agentName}
        companyName={launched.companyName || organization.name || 'your business'}
        plan={launched.plan}
        hasPhoneNumber={hasPhoneNumber}
        calendarConnected={calendarConnected}
      />
    )
  }

  return (
    <div className="space-y-8">
      <StepHeader icon={Rocket} title="Go live" description="Pick a plan and we'll create your agent. Next, you'll test it and connect a number." />

      {incompleteStep !== null && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Something is missing in the {ONBOARDING_STEPS[incompleteStep - 1].label.toLowerCase()} step.
          </p>
          <Button type="button" variant="outline" className="h-9 shrink-0 bg-white" onClick={() => setStep(incompleteStep)}>
            Finish {ONBOARDING_STEPS[incompleteStep - 1].label.toLowerCase()}
          </Button>
        </div>
      )}

      {/* Annual / Monthly toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={cn('text-sm font-medium', !annual ? 'text-foreground' : 'text-muted-foreground')}>
          Monthly
        </span>
        <Switch checked={annual} onCheckedChange={setAnnual} aria-label="Bill annually" />
        <span className={cn('flex items-center gap-1.5 text-sm font-medium', annual ? 'text-foreground' : 'text-muted-foreground')}>
          Annual
          <span className={cn('rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700', !annual && 'invisible')}>
            2 MONTHS FREE
          </span>
        </span>
      </div>

      {/* Plan cards — stacked horizontal */}
      <div className="space-y-4" role="group" aria-label="Plans">
        <TrialPlanCard selected={plan === 'trial'} onSelect={() => setPlan('trial')} />
        <LightPlanCard  id="starter"  icon={Layers}    selected={plan === 'starter'}  onSelect={() => setPlan('starter')}  annual={annual} />
        <ProPlanCard    id="pro"                       selected={plan === 'pro'}      onSelect={() => setPlan('pro')}      annual={annual} />
        <LightPlanCard  id="business" icon={Building2} selected={plan === 'business'} onSelect={() => setPlan('business')} annual={annual} />
        <CustomPlanCard id="custom"                    selected={plan === 'custom'}   onSelect={() => setPlan('custom')}   annual={annual} />
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 sm:p-6">
        <p className="mb-2 font-semibold text-foreground">Your setup</p>
        <dl className="divide-y divide-purple-100">
          <SummaryRow icon={Building2}  label="Company"   value={company.name || organization.name || '—'} />
          <SummaryRow icon={Bot}        label="Agent"     value={agent.name ? `${agent.name} · ${TONE_PROFILES[agent.tone].label}` : '—'} />
          <SummaryRow icon={Languages}  label="Language"  value={languageLabel} />
          <SummaryRow icon={Mic2}       label="Voice"     value={voice.cartesia_voice_name || '—'} />
          <SummaryRow icon={Globe}      label="Time zone" value={timeZoneOption(company.timezone).label} />
          <SummaryRow icon={CreditCard} label="Plan"      value={`${PLANS[plan].name}${plan !== 'trial' && !PLANS[plan].contact_sales ? (annual ? ' · annual' : ' · monthly') : ''}`} />
        </dl>
      </div>

      {status.name === 'error' && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {status.message}
          </p>
          {status.signIn ? (
            <Link href="/login" className={cn(buttonVariants({ variant: 'outline' }), 'h-9 shrink-0 bg-white')}>
              Sign in
            </Link>
          ) : (
            <Button type="button" variant="outline" className="h-9 shrink-0 bg-white" onClick={() => void completeOnboarding()}>
              Try again
            </Button>
          )}
        </div>
      )}

      {/* Launch button */}
      <div className="space-y-2">
        <Button
          type="button"
          className="h-12 w-full text-base purple-glow"
          onClick={() => void completeOnboarding()}
          disabled={busy || incompleteStep !== null}
        >
          {status.name === 'launching' ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />Creating your agent…</>
          ) : status.name === 'redirecting' ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />Opening secure checkout…</>
          ) : (
            <><Rocket className="mr-2 h-5 w-5" aria-hidden="true" />Create my agent</>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground" aria-live="polite">
          {PLANS[plan].contact_sales
            ? 'You’ll start on the free trial. Custom pricing is arranged with our team from the Billing page.'
            : plan === 'trial'
              ? 'No card needed. Upgrade any time from Billing.'
              : 'Paid plans start with a 14-day free trial. You’ll confirm payment details at checkout.'}
        </p>
      </div>

      {/* Back */}
      <div className="flex justify-center">
        <Button type="button" variant="ghost" size="sm" onClick={() => setStep(3)} disabled={busy} className="h-9 gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </Button>
      </div>
    </div>
  )
}

// ─── After launch: what's left ────────────────────────────────────────────────

const GOOGLE_CALENDAR_CONNECT_URL = '/api/integrations/google/connect?type=google_calendar'

function ReadyChecklist({
  agentName, companyName, plan, hasPhoneNumber, calendarConnected,
}: {
  agentName: string
  companyName: string
  plan: Plan
  hasPhoneNumber: boolean
  calendarConnected: boolean
}) {
  const agent = agentName || 'Your agent'
  const [tested, setTested] = useState(false)
  const [connectingCalendar, setConnectingCalendar] = useState(false)
  const canUseGoogle = useMemo(() => entitlementsFor(plan).googleIntegrations, [plan])
  const headingRef = useRef<HTMLHeadingElement | null>(null)

  // The plan screen is gone: start keyboard and screen reader users at the new heading.
  useEffect(() => {
    window.scrollTo(0, 0)
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className="space-y-8">
      <Confetti />
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100" aria-hidden="true">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <div>
          <h2 ref={headingRef} data-step-heading tabIndex={-1} className="text-2xl font-extrabold text-foreground outline-none sm:text-3xl">
            Your agent is ready
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
            {hasPhoneNumber
              ? `${agent} is set up to answer for ${companyName}. Give it a test call to hear how it sounds.`
              : `${agent} is set up for ${companyName}, but it isn’t answering a phone line yet. Test it, then get a number to go live.`}
          </p>
        </div>
      </div>

      <ol className="space-y-4">
        <ChecklistItem
          step={1}
          done={tested}
          icon={AudioLines}
          title="Test your agent now"
          description="Hear how it greets and helps a caller, before anyone real rings."
        >
          <TestCallPanel
            agentName={agent}
            hasPhoneNumber={hasPhoneNumber}
            onCallEnded={(result) => {
              if (result.seconds > 0) setTested(true)
            }}
          />
        </ChecklistItem>

        <ChecklistItem
          step={2}
          done={hasPhoneNumber}
          icon={Phone}
          title="Get a phone number"
          description={
            hasPhoneNumber
              ? `Your number is connected. Calls to it go straight to ${agent}.`
              : `Pick a local number and buy it in seconds. ${agent} starts answering it straight away, with no hardware or porting.`
          }
        >
          {!hasPhoneNumber && (
            <Link href="/phone" className={cn(buttonVariants(), 'h-10 w-full gap-1.5 px-4 sm:w-auto')}>
              Get a phone number
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </ChecklistItem>

        <ChecklistItem
          step={3}
          done={calendarConnected}
          icon={CalendarCheck}
          title="Connect Google Calendar"
          optional
          beta
          description={
            calendarConnected
              ? `Connected. ${agent} can check your free times and book appointments.`
              : `Let ${agent} check your free times and book appointments straight into your calendar.`
          }
        >
          {!calendarConnected &&
            (canUseGoogle ? (
              <Button
                type="button"
                variant="outline"
                disabled={connectingCalendar}
                onClick={() => {
                  // Full page navigation: the connect route redirects to Google's consent screen.
                  setConnectingCalendar(true)
                  window.location.assign(GOOGLE_CALENDAR_CONNECT_URL)
                }}
                className="h-10 w-full gap-1.5 px-4 sm:w-auto"
              >
                {connectingCalendar ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CalendarCheck aria-hidden="true" />}
                {connectingCalendar ? 'Opening Google…' : 'Connect Google Calendar'}
              </Button>
            ) : (
              <UpgradeNotice compact feature="Calendar booking" requiredPlan={requiredPlanFor('googleIntegrations')} />
            ))}
        </ChecklistItem>
      </ol>

      <div className="flex flex-col items-center gap-2">
        <Link href="/dashboard?welcome=true" className={cn(buttonVariants({ variant: 'outline' }), 'h-10 w-full gap-1.5 px-5 sm:w-auto')}>
          Go to your dashboard
          <ArrowRight aria-hidden="true" />
        </Link>
        <p className="text-center text-xs text-muted-foreground">You can finish any of these later from your dashboard.</p>
      </div>
    </div>
  )
}

function ChecklistItem({
  step, done, icon: Icon, title, description, optional = false, beta = false, children,
}: {
  step: number
  done: boolean
  icon: React.ElementType
  title: string
  description: string
  optional?: boolean
  beta?: boolean
  children?: React.ReactNode
}) {
  return (
    <li className={cn('rounded-2xl border bg-white p-4 sm:p-5', done && 'border-emerald-200 bg-emerald-50/40')}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            done ? 'bg-emerald-600 text-white' : 'bg-purple-100 text-purple-700'
          )}
        >
          {done ? <Check className="h-4 w-4" aria-hidden="true" /> : step}
          <span className="sr-only">{done ? ', done' : ', to do'}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div>
            <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-foreground">
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {title}
              {optional && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                  Optional
                </span>
              )}
              {beta && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                  Beta
                </span>
              )}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      {/* Full width under the heading on phones, aligned with the text from sm up. */}
      {children && <div className="mt-3 sm:pl-11">{children}</div>}
    </li>
  )
}
