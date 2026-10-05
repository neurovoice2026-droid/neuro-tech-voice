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
// claim "you're live" otherwise.

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
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { deferBackground } from '@/lib/observability/telemetry'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'
import { sendEmail } from '@/lib/email/client'
import { welcomeEmail } from '@/lib/email/templates'
import {
  AGENT_NAME_MAX,
  AgentLanguageSchema,
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
import { PLANS, stripePriceId } from '@/types'
import type { BillingInterval, Plan } from '@/types'

// Agent sync with the primary provider + Stripe customer/session creation.
export const maxDuration = 60

const PLAN_VALUES = ['trial', 'starter', 'pro', 'business', 'custom'] as const satisfies readonly Plan[]

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
      name: emptyAsUndefined(z.string().trim().max(100)),
      industry: emptyAsUndefined(z.string().trim().max(60)),
      website: WebsiteSchema.optional(),
      description: z.string().trim().max(1_000).optional(),
    })
    .optional(),
  agent: z
    .object({
      name: emptyAsUndefined(z.string().trim().max(AGENT_NAME_MAX)),
      language: emptyAsUndefined(AgentLanguageSchema),
      system_prompt: z.string().max(SYSTEM_PROMPT_MAX).nullable().optional(),
      first_message: z.string().trim().max(FIRST_MESSAGE_MAX).nullable().optional(),
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
      .select('id, name, industry, website, description, stripe_customer_id, onboarding_completed')
      .eq('id', org.id)
      .single()
    if (orgErr) throw new Error(`organizations read failed: ${orgErr.message}`)

    const companyName = (body.company?.name ?? orgRow.name ?? null) as string | null
    const agent = await ensureAgent(org.id, defaultAgentName(companyName))
    log = log.child({ agentId: agent.id })

    // ── Work out what changes (voice excluded) ─────────────────────────────
    const agentPatch: Record<string, unknown> = {}
    if (body.agent?.name) agentPatch.name = body.agent.name
    if (body.agent?.language) agentPatch.language = body.agent.language
    if (body.agent?.system_prompt !== undefined) agentPatch.system_prompt = blankToNull(body.agent.system_prompt)
    if (body.agent?.first_message !== undefined) agentPatch.first_message = blankToNull(body.agent.first_message)
    if (body.agent?.personality) agentPatch.metadata = mergeMetadata(agent.metadata, { personality: body.agent.personality })

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
    // Self-serve paid tiers go through Stripe checkout; trial and custom (which
    // have no price id) land on the trial tier until billing/sales takes over.
    // Fall back to the monthly price if an annual one isn't configured yet.
    const priceId = stripePriceId(body.plan, interval) || planConfig.stripe_price_id
    const willCheckout = !!priceId && isStripeConfigured()
    const effectivePlan: Plan = willCheckout || planConfig.contact_sales ? 'trial' : body.plan

    // plan / minutes_limit are platform-managed columns (guard trigger): written
    // with the service role, scoped to the authorized org.
    // Only mark onboarding complete now if we're NOT sending the user to Stripe.
    // For paid checkout it's completed on payment success (billing webhook), so a
    // cancelled checkout returns to onboarding instead of dumping them in the app.
    const admin = createAdminClient()
    const { error: planErr } = await admin
      .from('organizations')
      .update({
        onboarding_completed: !willCheckout,
        onboarding_step: 4,
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

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

        const session = await stripe.checkout.sessions.create({
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
          metadata: { org_id: org.id },
          subscription_data: {
            trial_period_days: 14,
            metadata: { org_id: org.id },
          },
        })

        return NextResponse.json({ success: true, checkout_url: session.url, activated, primary_provider: primaryProvider, warning, sync })
      } catch (err) {
        // Stripe failed — grant the trial so the user isn't stuck, then continue.
        log.error('onboarding.stripe_failed', err)
        const { error } = await admin
          .from('organizations')
          .update({ onboarding_completed: true, plan: 'trial', minutes_limit: PLANS.trial.minutes_limit })
          .eq('id', org.id)
        if (error) throw new Error(`organizations trial fallback failed: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      redirect: `${appUrl}/dashboard?welcome=true`,
      activated,
      primary_provider: primaryProvider,
      warning,
      sync,
    })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'onboarding.complete_failed', requestId)
  }
}
