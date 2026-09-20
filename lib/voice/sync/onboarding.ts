import { PLANS, stripePriceId, type AgentTone, type BillingInterval, type Organization, type Plan } from '@/types'
import { buildIndustrySystemPrompt } from '@/lib/agent-prompts'
import type { OnboardingComplete } from '@/lib/voice/sync/schemas'

// Pure decisions behind POST /api/onboarding/complete, kept apart from the
// route so repeat submissions (double clicks, a cancelled Stripe checkout and
// a second try) are testable: the same organisation always converges to one
// agent row and one trial, never a second trial window.

export const TRIAL_DAYS = 14

export interface PlanDecision {
  /** Stripe price for the checkout session ('' when none applies). */
  priceId: string
  willCheckout: boolean
  /** Plan written now: paid self-serve tiers stay on trial until the billing webhook confirms payment. */
  effectivePlan: Plan
  /** Stripe is set up but this paid tier has no price id, or production runs without Stripe (a deployment mistake to log). */
  priceMissing: boolean
}

/**
 * The rules the route has always used for Stripe checkout: paid tiers go
 * through checkout, custom goes to sales, and without Stripe at all (demo
 * deployments) the chosen tier is granted directly. One tightening: when Stripe
 * is configured but the tier's price id is missing, the owner lands on the
 * trial instead of getting a paid tier for free.
 */
export function resolveOnboardingPlan(input: {
  plan: Plan
  annual: boolean
  stripeConfigured: boolean
  /** Production never grants a paid tier without payment, even if Stripe is missing. */
  production?: boolean
}): PlanDecision {
  const planConfig = PLANS[input.plan]
  const interval: BillingInterval = input.annual ? 'year' : 'month'
  // Fall back to the monthly price if an annual one isn't configured yet.
  const priceId = stripePriceId(input.plan, interval) || planConfig.stripe_price_id
  const willCheckout = !!priceId && input.stripeConfigured
  const paidTier = input.plan !== 'trial' && !planConfig.contact_sales
  const priceMissing = paidTier && ((input.stripeConfigured && !priceId) || (!input.stripeConfigured && input.production === true))
  const effectivePlan: Plan = willCheckout || planConfig.contact_sales || priceMissing ? 'trial' : input.plan
  return { priceId, willCheckout, effectivePlan, priceMissing }
}

/**
 * The trial clock starts when setup is finished. An organisation that already
 * completed onboarding keeps its dates, so re-submitting can't extend a trial.
 */
export function trialEndsAtFor(
  org: Pick<Organization, 'onboarding_completed'> & Partial<Pick<Organization, 'trial_ends_at'>>,
  effectivePlan: Plan,
  now: Date
): string | undefined {
  if (org.onboarding_completed || effectivePlan !== 'trial') return undefined
  // A trial that already ran out stays over: setup can't be re-run to start another one.
  const current = org.trial_ends_at ? Date.parse(org.trial_ends_at) : Number.NaN
  if (Number.isFinite(current) && current <= now.getTime()) return undefined
  return new Date(now.getTime() + TRIAL_DAYS * 86_400_000).toISOString()
}

export interface OnboardingAgentFields {
  name: string
  language: string
  tone: AgentTone
  system_prompt: string
  first_message: string | null
  cartesia_voice_id: string | null
  cartesia_voice_name: string | null
  is_active: boolean
}

/**
 * Agent columns written by onboarding. An empty prompt gets the industry
 * template; an empty greeting stays null so calls use the generated greeting
 * for the agent's language and tone (with the AI disclosure).
 */
export function onboardingAgentFields(
  input: Pick<OnboardingComplete, 'agent' | 'company'>,
  voice: { id: string; name: string } | null
): OnboardingAgentFields {
  return {
    name: input.agent.name,
    language: input.agent.language,
    tone: input.agent.tone,
    system_prompt:
      input.agent.system_prompt ??
      buildIndustrySystemPrompt({
        name: input.company.name,
        industry: input.company.industry,
        description: input.company.description,
      }),
    first_message: input.agent.first_message,
    cartesia_voice_id: voice?.id ?? null,
    cartesia_voice_name: voice ? voice.name : null,
    is_active: true,
  }
}

/** Columns that exist before migration 010, for writing onboarding before it is applied. */
export function legacyAgentFields(fields: OnboardingAgentFields, metadata: Record<string, unknown>): Record<string, unknown> {
  return {
    name: fields.name,
    language: fields.language,
    system_prompt: fields.system_prompt,
    first_message: fields.first_message,
    is_active: fields.is_active,
    // The pre-010 dashboard read the tone from metadata.personality.
    metadata: { ...metadata, personality: fields.tone },
  }
}
