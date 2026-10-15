// POST /api/onboarding/complete — final step: persist company + agent, push the
// agent to the providers, set the plan and (for paid tiers) open Stripe
// checkout.
//
// Re-running it (e.g. after a cancelled checkout) is safe: ensureAgent never
// creates a second local agent, and the sync engine's lease + provider-side
// tags never create a second external agent. Each provider push counts against
// the org's agentSync budget, and an already-onboarded org that changed nothing
// provider-relevant is not re-pushed at all.
//
// The response says whether the agent is live (`activated`): the agent is only
// switched on when the primary provider sync is ready, so the client must not
// claim "you're live" otherwise. When a paid plan was chosen but could not be
// started (its Stripe price could not be resolved, or the checkout could not
// be opened), the organization launches on the trial and the response carries
// `plan_notice` so the client tells the owner to choose the plan from Billing.
//
// An organization that already has a plan subscription in Stripe (Checkout
// finished in another tab, a stale Launch tab, or a payment due) keeps it:
// the plan and its minutes stay the billing webhook's, nothing here rewrites
// them and no second subscription is opened (plan_notice
// 'subscription_exists' or 'payment_due'). The 14 free days of a new
// subscription are only for a Stripe customer that never had a plan
// subscription.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import {
  RequestError,
  assertSameOrigin,
  errorResponse,
  parseJsonBody,
  requestErrorResponse,
} from '@/lib/api/http'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import { deferBackground } from '@/lib/observability/telemetry'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'
import { createBrandedCheckoutSession } from '@/lib/stripe/checkout-branding'
import { ensurePlanPriceId } from '@/lib/stripe/store-prices'
import { findPlanSubscriptions } from '@/lib/stripe/plan-subscription'
import { sendEmail } from '@/lib/email/client'
import { welcomeEmail } from '@/lib/email/templates'
import {
  AgentLanguageSchema,
  AgentNameSchema,
  CompanyNameSchema,
  FIRST_MESSAGE_MAX,
  PersonalitySchema,
  SYSTEM_PROMPT_MAX,
  WebsiteSchema,
  blankToNull,
  defaultAgentName,
  emptyAsUndefined,
  ensureAgent,
  mergeMetadata,
  syncAgentProviders,
  type AgentSyncReport,
} from '@/lib/agents/ensure-agent'
import type { VoiceProvider } from '@/lib/voice-providers/errors'
import { TOTAL_COMMERCE_ONBOARDING_STEPS, isEcommerceOrg } from '@/lib/commerce/business-type'
import { PLANS, PLAN_NOT_AVAILABLE_MESSAGE, SERVICE_PLANS, STORE_PLANS, isSelfServePlan, planAllowedFor } from '@/types'
import type { BillingInterval, BusinessType, Plan } from '@/types'
import { PLATFORM_VARIABLE_MESSAGE, hasNoPlatformVariables } from '@/lib/voice-providers/template-variables'

// Agent sync with the primary provider + Stripe customer/session creation.
export const maxDuration = 60

/** Every plan of the catalogue: the trial, the service ladder (Growth and Scale included) and the store tiers. */
const PLAN_VALUES = ['trial', ...SERVICE_PLANS, ...STORE_PLANS] as const satisfies readonly Plan[]

/**
 * Why the plan the owner chose was not started: its Stripe price could not be
 * resolved or the Stripe checkout could not be opened (the launch went ahead
 * on the trial), or the organization already has a plan subscription (live,
 * or with a payment due), which it keeps.
 */
type PlanNotice = 'price_unavailable' | 'checkout_unavailable' | 'subscription_exists' | 'payment_due'

/** Free days of a first plan subscription bought at launch. */
const FIRST_SUBSCRIPTION_TRIAL_DAYS = 14

/**
 * The organization's plan subscription in Stripe: 'live' (active or
 * trialing), 'due' (a payment is due), 'none', or 'unknown' when Stripe could
 * not answer (then nothing about the plan is changed). `hadAny`: the customer
 * had a plan subscription before (no second free trial).
 */
async function existingPlanSubscription(
  orgId: string,
  row: { stripe_customer_id?: unknown; stripe_subscription_id?: unknown },
  log: Logger,
): Promise<{ state: 'live' | 'due' | 'none' | 'unknown'; hadAny: boolean }> {
  const customerId = typeof row.stripe_customer_id === 'string' && row.stripe_customer_id ? row.stripe_customer_id : null
  if (!customerId || !isStripeConfigured()) return { state: 'none', hadAny: false }
  try {
    const found = await findPlanSubscriptions(getStripeClient(), {
      orgId,
      customerId,
      recordedId: typeof row.stripe_subscription_id === 'string' && row.stripe_subscription_id ? row.stripe_subscription_id : null,
    })
    return { state: found.live ? 'live' : found.due ? 'due' : 'none', hadAny: found.hadAny }
  } catch (err) {
    log.error('onboarding.subscription_lookup_failed', err)
    return { state: 'unknown', hadAny: true }
  }
}

/** Agent columns set here that end up in the provider-side agent (AgentSpec). */
const PROVIDER_AGENT_FIELDS = ['name', 'language', 'system_prompt', 'first_message'] as const

const NOT_PUSHED_MESSAGE =
  'Your agent was saved, but the latest changes could not be sent to the voice provider yet.'

// Unknown keys (e.g. a legacy `voice` object) are stripped: the voice is saved
// and confirmed with the provider by PUT /api/agent/voice, never here.
const CompleteSchema = z.object({
  plan: z.enum(PLAN_VALUES),
  annual: z.boolean().optional(),
  company: z
    .object({
      name: emptyAsUndefined(CompanyNameSchema),
      industry: emptyAsUndefined(z.string().trim().max(60)),
      website: WebsiteSchema.optional(),
      description: z.string().trim().max(1_000).optional(),
    })
    .optional(),
  agent: z
    .object({
      name: emptyAsUndefined(AgentNameSchema),
      language: emptyAsUndefined(AgentLanguageSchema),
      system_prompt: z.string().max(SYSTEM_PROMPT_MAX).refine(hasNoPlatformVariables, PLATFORM_VARIABLE_MESSAGE).nullable().optional(),
      first_message: z.string().trim().max(FIRST_MESSAGE_MAX).refine(hasNoPlatformVariables, PLATFORM_VARIABLE_MESSAGE).nullable().optional(),
      personality: emptyAsUndefined(PersonalitySchema),
    })
    .optional(),
})

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'onboarding.complete' })
  try {
    assertSameOrigin(request)
    const { supabase, user, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, CompleteSchema)
    const interval: BillingInterval = body.annual ? 'year' : 'month'

    const { data: orgRow, error: orgErr } = await supabase
      .from('organizations')
      .select('id, name, industry, website, description, stripe_customer_id, stripe_subscription_id, onboarding_completed, business_type')
      .eq('id', org.id)
      .single()
    if (orgErr) throw new Error(`organizations read failed: ${orgErr.message}`)

    // An online store launches on the trial or a store plan, every other
    // organization on the trial or a service plan: the row decides, never the
    // client, and the check runs before anything is written.
    const businessType = (orgRow.business_type ?? null) as BusinessType | null
    if (!planAllowedFor(body.plan, businessType)) {
      throw new RequestError('plan_not_available', PLAN_NOT_AVAILABLE_MESSAGE, 409, {
        reason: 'plan_not_available',
        plan: body.plan,
        business_type: businessType,
      })
    }

    // Asked of Stripe before anything is written: an existing plan subscription is kept as it is.
    const existing = await existingPlanSubscription(org.id, orgRow, log)

    const companyName = (body.company?.name ?? orgRow.name ?? null) as string | null
    const agent = await ensureAgent(org.id, defaultAgentName(companyName))
    log = log.child({ agentId: agent.id })

    // ── Work out what changes (voice excluded) ─────────────────────────────
    // A client that holds the agent always sends its name: the service wizard cannot leave step 2
    // without one, and the store flow sends the saved row. An agent without a name is a wizard
    // still at its defaults (a reload, a return from a cancelled Checkout), so its English and
    // its empty prompt and greeting are nobody's choice: it changes nothing, and the launch
    // pushes the agent the earlier steps saved.
    const agentInput = body.agent?.name ? body.agent : undefined
    const agentPatch: Record<string, unknown> = {}
    if (agentInput?.name) agentPatch.name = agentInput.name
    if (agentInput?.language) agentPatch.language = agentInput.language
    if (agentInput?.system_prompt !== undefined) agentPatch.system_prompt = blankToNull(agentInput.system_prompt)
    if (agentInput?.first_message !== undefined) agentPatch.first_message = blankToNull(agentInput.first_message)
    if (agentInput?.personality) agentPatch.metadata = mergeMetadata(agent.metadata, { personality: agentInput.personality })

    // The org name is part of the provider-side agent too (AgentSpec).
    const current = agent as unknown as Record<string, unknown>
    const providerConfigChanged =
      (!!body.company && companyName !== ((orgRow.name as string | null) ?? null)) ||
      PROVIDER_AGENT_FIELDS.some((k) => k in agentPatch && (agentPatch[k] ?? null) !== (current[k] ?? null))
    // First launch (or a re-run after a cancelled checkout) always pushes; an
    // org that already finished onboarding only when something changed.
    const shouldSync = !orgRow.onboarding_completed || providerConfigChanged

    // Checked before any write, so a 429 leaves nothing half-saved.
    if (shouldSync) {
      await enforceRateLimit(RATE_LIMITS.agentSync, org.id, 'Too many launch attempts. Please wait a moment and try again.')
    }

    // ── Persist the company details entered during onboarding ──────────────
    if (body.company) {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: companyName,
          industry: body.company.industry ?? orgRow.industry,
          website: body.company.website !== undefined ? body.company.website : orgRow.website,
          description: body.company.description ?? orgRow.description,
        })
        .eq('id', org.id)
      if (error) throw new Error(`organizations update failed: ${error.message}`)
    }

    // ── Save the agent config ──────────────────────────────────────────────
    if (Object.keys(agentPatch).length) {
      const { error } = await supabase.from('agents').update(agentPatch).eq('id', agent.id).eq('org_id', org.id)
      if (error) throw new Error(`agents update failed: ${error.message}`)
    }

    // ── Push to the providers (primary now, fallback after the response) ───
    const primaryProvider: VoiceProvider = agent.primary_provider === 'cartesia' ? 'cartesia' : 'elevenlabs'
    let sync: AgentSyncReport[] = []
    if (shouldSync) {
      sync = await syncAgentProviders({
        supabase,
        orgId: org.id,
        agentId: agent.id,
        primaryProvider,
        bump: true,
        primary: true,
        fallback: true,
        log,
      })
    }
    const primaryReport = sync.find((s) => s.provider === primaryProvider) ?? null
    const primaryReady = primaryReport?.status === 'ready'
    if (primaryReady && !agent.is_active) {
      const { error } = await supabase.from('agents').update({ is_active: true }).eq('id', agent.id).eq('org_id', org.id)
      if (error) throw new Error(`agents activate failed: ${error.message}`)
    }
    // Live = the router will answer calls with this agent. Nothing re-activates
    // it later on its own, so the client must send the user to /agent otherwise.
    const activated = primaryReady || agent.is_active
    // Sanitized, product-level detail from the agent's actual primary provider.
    const pushFailed = primaryReport?.status === 'failed' || primaryReport?.status === 'degraded'
    const warning = !activated
      ? (primaryReport?.error ?? null)
      : pushFailed
        ? (primaryReport?.error ?? NOT_PUSHED_MESSAGE)
        : null
    log.info('onboarding.agent_synced', {
      synced: shouldSync,
      activated,
      sync: sync.map((s) => `${s.provider}:${s.status}`),
    })

    // Mark onboarding complete. For a paid plan with Stripe configured we do NOT
    // grant the paid tier yet — the billing webhook upgrades the org only once
    // payment/trial actually starts. In demo mode (no Stripe) we grant it directly
    // so the product is usable without a payment provider.
    const planConfig = PLANS[body.plan]
    // Self-serve paid tiers go through Stripe checkout; the trial and the
    // sales-led tiers land on the trial tier until billing/sales takes over.
    // Every self-serve plan's price, service or store, monthly or annual, is
    // resolved by ensurePlanPriceId: an env pin only while Stripe bills
    // exactly what PLANS says, else the app's own price, found or created by
    // lookup key. That needs no manual setup but can fail like any API call,
    // in which case the trial fallback below applies.
    let priceId = ''
    // Not needed while a plan subscription exists: that one is kept (below).
    if (isSelfServePlan(body.plan) && isStripeConfigured() && existing.state === 'none') {
      try {
        priceId = await ensurePlanPriceId(body.plan, interval)
      } catch (err) {
        log.error('onboarding.plan_price_failed', err, { plan: body.plan, interval })
      }
    }
    const willCheckout = !!priceId && isStripeConfigured()
    // Billing configured but this paid tier has no usable price: never grant a
    // paid plan for free — fall back to the trial and tell the owner.
    const paidWithoutPrice = isStripeConfigured() && isSelfServePlan(body.plan) && !priceId
    const effectivePlan: Plan = willCheckout || planConfig.contact_sales || paidWithoutPrice ? 'trial' : body.plan
    // The owner chose a paid plan that is not being started: say so, never imply it was.
    let planNotice: PlanNotice | null = paidWithoutPrice ? 'price_unavailable' : null

    // plan / minutes_limit are platform-managed columns (guard trigger): written
    // with the service role, scoped to the authorized org.
    // Only mark onboarding complete now if we're NOT sending the user to Stripe.
    // For paid checkout it's completed on payment success (billing webhook), so a
    // cancelled checkout returns to onboarding instead of dumping them in the app.
    // That return must land on the launch step of the flow the org is in: the
    // service flow launches at step 4, the store flow (both post here) at its
    // last step — a store org sent back to 4 would reopen the automations step instead.
    const launchStep = isEcommerceOrg(orgRow) ? TOTAL_COMMERCE_ONBOARDING_STEPS : 4
    const admin = createAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    if (existing.state !== 'none') {
      // A plan subscription exists (or Stripe could not say): the plan and its
      // minutes are left to the billing webhook, no Checkout is opened, and the
      // owner changes plans from Billing.
      const { error } = await admin
        .from('organizations')
        .update({ onboarding_completed: true, onboarding_step: launchStep })
        .eq('id', org.id)
      if (error) throw new Error(`organizations onboarding update failed: ${error.message}`)
      const keptNotice: PlanNotice | null =
        existing.state === 'live'
          ? 'subscription_exists'
          : existing.state === 'due'
            ? 'payment_due'
            : isSelfServePlan(body.plan)
              ? 'checkout_unavailable'
              : null
      log.info('onboarding.plan_kept', { subscription: existing.state, chosenPlan: body.plan })
      return NextResponse.json({
        success: true,
        redirect: `${appUrl}/dashboard?welcome=true`,
        activated,
        primary_provider: primaryProvider,
        warning,
        sync,
        plan_notice: keptNotice,
      })
    }

    const { error: planErr } = await admin
      .from('organizations')
      .update({
        onboarding_completed: !willCheckout,
        onboarding_step: launchStep,
        plan: effectivePlan,
        minutes_limit: PLANS[effectivePlan].minutes_limit,
      })
      .eq('id', org.id)
    if (planErr) throw new Error(`organizations plan update failed: ${planErr.message}`)

    // Welcome email (best-effort — sendEmail never throws; kept alive after the response).
    if (user.email) {
      deferBackground(
        sendEmail({
          to: user.email,
          ...welcomeEmail({
            name: companyName ?? undefined,
            agentName: (agentPatch.name as string | undefined) ?? agent.name,
          }),
        }),
      )
    }

    // ── Stripe checkout for paid plans ─────────────────────────────────────
    if (willCheckout) {
      try {
        const stripe = getStripeClient()

        // Get or create the Stripe customer (stripe_customer_id is platform-managed).
        let customerId = orgRow.stripe_customer_id as string | null
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: user.email,
            metadata: { org_id: org.id, user_id: user.id },
          })
          customerId = customer.id
          const { error } = await admin.from('organizations').update({ stripe_customer_id: customerId }).eq('id', org.id)
          if (error) throw new Error(`stripe_customer_id write failed: ${error.message}`)
        }

        const session = await createBrandedCheckoutSession(stripe, {
          customer: customerId,
          payment_method_types: ['card'],
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${appUrl}/dashboard?welcome=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/onboarding`,
          // Collect billing address + fiscal code (CUI) for SmartBill B2B invoicing.
          billing_address_collection: 'required',
          tax_id_collection: { enabled: true },
          customer_update: { address: 'auto', name: 'auto' },
          metadata: { org_id: org.id, ntv_plan: body.plan },
          subscription_data: {
            // Free days only for a customer that never had a plan subscription (no trial on every re-run).
            ...(existing.hadAny ? {} : { trial_period_days: FIRST_SUBSCRIPTION_TRIAL_DAYS }),
            // ntv_plan is the billing webhook's second signal for the plan,
            // after the price id (a store price carries it too).
            metadata: { org_id: org.id, ntv_plan: body.plan },
          },
        }, log)

        return NextResponse.json({ success: true, checkout_url: session.url, activated, primary_provider: primaryProvider, warning, sync })
      } catch (err) {
        // Stripe failed — grant the trial so the user isn't stuck, then continue.
        log.error('onboarding.stripe_failed', err)
        const { error } = await admin
          .from('organizations')
          .update({ onboarding_completed: true, plan: 'trial', minutes_limit: PLANS.trial.minutes_limit })
          .eq('id', org.id)
        if (error) throw new Error(`organizations trial fallback failed: ${error.message}`)
        planNotice = 'checkout_unavailable'
      }
    }

    return NextResponse.json({
      success: true,
      redirect: `${appUrl}/dashboard?welcome=true`,
      activated,
      primary_provider: primaryProvider,
      warning,
      sync,
      plan_notice: planNotice,
    })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'onboarding.complete_failed', requestId)
  }
}
