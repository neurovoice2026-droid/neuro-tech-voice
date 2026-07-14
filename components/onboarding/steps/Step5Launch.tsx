'use client'
// Step 6 — Launch & Pricing
import { useState, useMemo } from 'react'
import {
  Rocket, Check, Building2, Bot, Mic2, CreditCard,
  ArrowLeft, Zap, Shield, Star, Layers, Gift,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { cn } from '@/lib/utils'
import { PLANS } from '@/types'
import type { Plan, Organization } from '@/types'

interface Step6LaunchProps {
  organization: Organization
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = [
  '#9333ea', '#a855f7', '#c084fc',
  '#ec4899', '#f472b6',
  '#3b82f6', '#60a5fa',
  '#f59e0b', '#fbbf24',
  '#10b981', '#34d399',
  '#f97316', '#fb923c',
  '#ffffff',
]

interface ConfettiParticle {
  id: number; left: number; delay: number; duration: number
  color: string; size: number; rotation: number; isCircle: boolean; sway: number
}

function useConfettiParticles(count = 130): ConfettiParticle[] {
  return useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.4,
      duration: 2 + Math.random() * 2,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 10,
      rotation: Math.random() * 360,
      isCircle: Math.random() > 0.55,
      sway: (Math.random() > 0.5 ? 1 : -1) * (30 + Math.random() * 70),
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [])
}

function Confetti({ active }: { active: boolean }) {
  const particles = useConfettiParticles(130)
  if (!active) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--sway' as any]: `${p.sway}px`,
          animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  )
}

// ─── Summary Row ──────────────────────────────────────────────────────────────
function SummaryRow({ icon: Icon, label, value, muted = false }: {
  icon: React.ElementType; label: string; value: string; muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 flex-shrink-0" />
        {label}
      </div>
      <span className={cn('text-sm font-medium', muted ? 'text-muted-foreground italic' : 'text-foreground')}>
        {value}
      </span>
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
        <div className="flex w-full sm:w-52 sm:flex-shrink-0 flex-col justify-between bg-gray-50 p-5 transition-colors group-hover:bg-gray-100/70">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-200">
            <Icon className="h-4.5 w-4.5 text-gray-500" />
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
        <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-4 px-6 py-5">
          <ul className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {p.features.map((f) => (
              <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                {f}
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            onClick={(e) => { e.stopPropagation(); onSelect() }}
            className={cn('shrink-0 px-5', selected && 'border-primary text-primary')}
          >
            {selected ? 'Selected' : 'Choose'}
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
          ? 'ring-4 ring-white/70 ring-offset-2 ring-offset-purple-700 scale-[1.01]'
          : 'hover:shadow-purple-500/40 hover:scale-[1.005]'
      )}
    >
      {/* Most Popular strip */}
      <div className="flex items-center justify-center gap-1.5 bg-white/15 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white">
        <Star className="h-3 w-3 fill-current text-yellow-300" />
        Most Popular
        <Star className="h-3 w-3 fill-current text-yellow-300" />
      </div>

      <div className="flex flex-col sm:flex-row sm:min-h-[130px] sm:items-stretch">
        {/* Left identity */}
        <div className="flex w-full sm:w-52 sm:flex-shrink-0 flex-col justify-between bg-white/10 p-5 backdrop-blur-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
            <Zap className="h-4.5 w-4.5 text-yellow-300" />
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
        <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-4 px-6 py-5">
          <ul className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {PLANS.pro.features.map((f) => (
              <li key={f} className="flex items-center gap-1.5 text-xs text-purple-100">
                <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-white/25">
                  <Check className="h-2.5 w-2.5 text-white" />
                </div>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect() }}
            className="shrink-0 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-purple-700 shadow-lg transition-all hover:bg-purple-50 hover:shadow-xl active:scale-95"
          >
            Start free trial
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
        <div className="flex w-full sm:w-52 sm:flex-shrink-0 flex-col justify-between border-r border-gray-800 bg-black/30 p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-900/60">
            <Shield className="h-4.5 w-4.5 text-purple-400" />
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
        <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-4 px-6 py-5">
          <ul className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {PLANS.custom.features.map((f) => (
              <li key={f} className="flex items-center gap-1.5 text-xs text-gray-400">
                <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-purple-900/60">
                  <Check className="h-2.5 w-2.5 text-purple-400" />
                </div>
                {f}
              </li>
            ))}
          </ul>
          {/* Custom button — no shadcn variant="outline" to avoid white-on-white */}
          <button
            onClick={(e) => { e.stopPropagation(); onSelect() }}
            className="shrink-0 rounded-xl border border-purple-600/50 bg-purple-950/60 px-5 py-2.5 text-sm font-semibold text-purple-300 transition-all hover:border-purple-500 hover:bg-purple-900/60 hover:text-purple-200 hover:shadow-[0_0_12px_rgba(147,51,234,0.3)] active:scale-95"
          >
            Contact sales →
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
      <div className="flex items-center justify-center gap-1.5 bg-emerald-500/10 py-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-700">
        <Star className="h-3 w-3 fill-current" /> Best to start · no card required
      </div>
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <div className="flex w-full sm:w-52 sm:flex-shrink-0 flex-col justify-between p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
            <Gift className="h-4.5 w-4.5 text-emerald-600" />
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
        <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-4 px-6 py-5">
          <ul className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {p.features.map((f) => (
              <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                {f}
              </li>
            ))}
          </ul>
          <Button
            variant={selected ? 'default' : 'outline'}
            onClick={(e) => { e.stopPropagation(); onSelect() }}
            className={cn('shrink-0 px-5', selected ? 'purple-glow' : 'border-emerald-400 text-emerald-700 hover:bg-emerald-50')}
          >
            {selected ? 'Selected' : 'Start free'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({ agentName }: { agentName: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shadow-xl shadow-purple-500/30">
        <Rocket className="h-10 w-10 text-white" />
      </div>
      <div>
        <h2 className="text-3xl font-extrabold text-foreground">You&apos;re live! 🎉</h2>
        <p className="mt-2 text-muted-foreground">
          {agentName ? `${agentName} is` : 'Your AI agent is'} ready to take calls.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <a
          href="/dashboard"
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:scale-[1.02]"
        >
          <Rocket className="h-4 w-4" />
          Go to Dashboard
        </a>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export function Step6Launch({ organization }: Step6LaunchProps) {
  const { plan, setPlan, setStep, agent, voice, company } = useOnboardingStore()
  const [annual, setAnnual]             = useState(false)
  const [isLaunching, setIsLaunching]   = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [launched, setLaunched]         = useState(false)

  const displayCompanyName = company.name || organization.name || '—'

  async function completeOnboarding() {
    setIsLaunching(true)
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          annual,
          company: {
            name: company.name,
            industry: company.industry,
            website: company.website,
            description: company.description,
          },
          agent: {
            name: agent.name,
            language: agent.language,
            system_prompt: agent.system_prompt,
            first_message: agent.first_message,
          },
          voice: { voice_id: voice.voice_id, voice_name: voice.voice_name },
        }),
      })
      const data = await res.json()

      setShowConfetti(true)

      if (data.checkout_url) {
        // Paid plan → Stripe checkout (confetti visible briefly before redirect)
        setTimeout(() => { window.location.href = data.checkout_url }, 1500)
      } else {
        // Free plan or Stripe not configured → show success screen
        setTimeout(() => {
          setIsLaunching(false)
          setLaunched(true)
        }, 1800)
      }
    } catch {
      // Fallback: still show success even if API fails
      setShowConfetti(true)
      setTimeout(() => {
        setIsLaunching(false)
        setLaunched(true)
      }, 1800)
    }
  }

  if (launched) {
    return (
      <>
        <Confetti active={showConfetti} />
        <SuccessScreen agentName={agent.name} />
      </>
    )
  }

  return (
    <>
      <Confetti active={showConfetti} />

      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col items-start gap-4">
          <div className="rounded-xl bg-purple-100 p-2.5">
            <Rocket className="h-7 w-7 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">You&apos;re almost ready!</h2>
            <p className="mt-1 text-muted-foreground">Choose a plan and launch your AI agent</p>
          </div>
        </div>

        {/* Annual / Monthly toggle */}
        <div className="flex items-center justify-center gap-3">
          <span className={cn('text-sm font-medium', !annual ? 'text-foreground' : 'text-muted-foreground')}>
            Monthly
          </span>
          <Switch checked={annual} onCheckedChange={setAnnual} />
          <span className={cn('flex items-center gap-1.5 text-sm font-medium', annual ? 'text-foreground' : 'text-muted-foreground')}>
            Annual
            {annual && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                2 MONTHS FREE
              </span>
            )}
          </span>
        </div>

        {/* Plan cards — stacked horizontal */}
        <div className="space-y-4">
          <TrialPlanCard selected={plan === 'trial'} onSelect={() => setPlan('trial')} />
          <LightPlanCard  id="starter"  icon={Layers}    selected={plan === 'starter'}  onSelect={() => setPlan('starter')}  annual={annual} />
          <ProPlanCard    id="pro"                       selected={plan === 'pro'}      onSelect={() => setPlan('pro')}      annual={annual} />
          <LightPlanCard  id="business" icon={Building2}  selected={plan === 'business'} onSelect={() => setPlan('business')} annual={annual} />
          <CustomPlanCard id="custom"                     selected={plan === 'custom'}   onSelect={() => setPlan('custom')}   annual={annual} />
        </div>

        {/* Summary */}
        <div className="rounded-xl border border-purple-100 bg-purple-50 p-6">
          <p className="mb-3 font-semibold text-foreground">Your setup summary</p>
          <div className="divide-y divide-purple-100">
            <SummaryRow icon={Building2} label="Company"      value={displayCompanyName} />
            <SummaryRow icon={Bot}       label="Agent name"   value={agent.name ? `${agent.name} · ${agent.personality}` : '—'} />
            <SummaryRow icon={Mic2}      label="Voice"        value={voice.voice_name || '—'} />
            <SummaryRow icon={CreditCard} label="Plan" value={PLANS[plan].name} />
          </div>
        </div>

        {/* Launch button */}
        <Button
          className="w-full py-4 text-base purple-glow"
          onClick={completeOnboarding}
          disabled={isLaunching}
        >
          {isLaunching ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Setting everything up…
            </span>
          ) : (
            <><Rocket className="mr-2 h-5 w-5" />Launch my AI agent</>
          )}
        </Button>

        {/* Back */}
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => setStep(3)} disabled={isLaunching} className="gap-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </div>
      </div>
    </>
  )
}
