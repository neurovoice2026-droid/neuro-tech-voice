import { NextResponse, after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError, handleRoute, noStore, parseJson } from '@/lib/api/http'
import { requireOrgContext, type OrgContext } from '@/lib/api/auth'
import { appUrl, isCartesiaConfigured, isProduction, isSupabaseAdminConfigured } from '@/lib/env'
import { sendEmail } from '@/lib/email/client'
import { welcomeEmail } from '@/lib/email/templates'
import { kvDel, kvGet, kvIncr, kvSet } from '@/lib/kv'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { getStripeClient, isSelfServePlan, isStripeConfigured, planLineItems } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLANS, stripePriceId, type Agent, type BillingInterval } from '@/types'
import { syncAgentAfterResponse } from '@/lib/voice/sync'
import { AGENT_010_COLUMNS, loadOrgAgent } from '@/lib/voice/sync/agent-store'
import { isMissingRelationError } from '@/lib/voice/sync/db'
import {
  legacyAgentFields,
  onboardingAgentFields,
  resolveOnboardingPlan,
  trialEndsAtFor,
  type OnboardingAgentFields,
} from '@/lib/voice/sync/onboarding'
import { onboardingCompleteSchema, type OnboardingComplete } from '@/lib/voice/sync/schemas'
import { defaultVoiceFacts, isOtherOrgClone, resolveSelectableVoice } from '@/lib/voice/sync/voices'

// Finishes onboarding: saves the business profile, creates or updates the
// organisation's single agent, sets the plan and trial, and, for paid tiers,
// opens Stripe Checkout. Safe to submit twice: the agent row is reused, the
// provider agents are created once by the sync, and an organisation that has
// already finished setup keeps its plan, trial dates and billing.

export const runtime = 'nodejs'
// Stripe calls plus the provider sync that runs in after().
export const maxDuration = 60

const LOCK_TTL_SECONDS = 30
const WELCOME_DEDUPE_SECONDS = 30 * 24 * 60 * 60

const SAVE_FAILED = 'We couldn’t save your setup. Please try again.'

type DbError = { code?: string; message: string } | null

function saveFailed(label: string, error: NonNullable<DbError>): ApiError {
  console.error('[onboarding]', `${label} failed`, error.code, error.message)
  return new ApiError(500, 'save_failed', SAVE_FAILED)
}

async function resolveVoice(
  ctx: OrgContext,
  admin: SupabaseClient,
  voice: OnboardingComplete['voice']
): Promise<{ id: string; name: string } | null> {
  const id = voice.cartesia_voice_id
  if (!id) return null
  const known = defaultVoiceFacts(id)
  if (known) return { id, name: voice.cartesia_voice_name ?? known.name }
  if (!isCartesiaConfigured()) {
    // Nothing can verify the pick; the agent speaks with the language's default voice until one is chosen.
    console.warn('[onboarding]', 'voice not verifiable without Cartesia; using the default voice', ctx.org.id)
    return null
  }
  try {
    const facts = await resolveSelectableVoice(ctx.supabase, ctx.org.id, id)
    return { id, name: voice.cartesia_voice_name ?? facts.name }
  } catch (error) {
    if (error instanceof ApiError && error.code === 'voice_not_found') throw error
    // A provider hiccup must not block finishing setup (the sync re-checks that
    // the voice exists), but another organisation's cloned voice is never accepted.
    if (await isOtherOrgClone(admin, ctx.org.id, id)) {
      throw new ApiError(400, 'voice_not_found', 'That voice isn’t available. Please pick another one.')
    }
    console.warn('[onboarding]', 'voice check skipped', error instanceof Error ? error.message : error)
    return { id, name: voice.cartesia_voice_name ?? 'Selected voice' }
  }
}

async function saveAgent(ctx: OrgContext, fields: OnboardingAgentFields): Promise<Agent> {
  const client = ctx.supabase
  const existing = await loadOrgAgent(client, ctx.org.id)

  const write = async (columns: Record<string, unknown>) =>
    existing
      ? client.from('agents').update(columns).eq('id', existing.id).eq('org_id', ctx.org.id).select('id')
      : client.from('agents').insert({ org_id: ctx.org.id, ...columns }).select('id')

  let { data, error } = await write({ ...fields })
  if (error && isMissingRelationError(error)) {
    console.warn('[onboarding]', 'agents is missing migration 010 columns; saving the legacy fields', AGENT_010_COLUMNS.join(', '))
    ;({ data, error } = await write(legacyAgentFields(fields, existing?.metadata ?? {})))
  }
  if (error) throw saveFailed(existing ? 'agent update' : 'agent insert', error)
  if (!Array.isArray(data) || data.length === 0) throw new ApiError(500, 'save_failed', SAVE_FAILED)

  const saved = await loadOrgAgent(client, ctx.org.id)
  if (!saved) throw new ApiError(500, 'save_failed', SAVE_FAILED)
  return saved
}

async function updateOrganization(admin: SupabaseClient, orgId: string, update: Record<string, unknown>): Promise<void> {
  if (Object.keys(update).length === 0) return
  const { error } = await admin.from('organizations').update(update).eq('id', orgId)
  if (!error) return
  if (isMissingRelationError(error)) {
    // Before migration 010: no timezone / trial_ends_at columns yet.
    const legacy = Object.fromEntries(Object.entries(update).filter(([key]) => key !== 'timezone' && key !== 'trial_ends_at'))
    console.warn('[onboarding]', 'organizations is missing migration 010 columns; saved without time zone and trial end')
    if (Object.keys(legacy).length === 0) return
    const retry = await admin.from('organizations').update(legacy).eq('id', orgId)
    if (!retry.error) return
    throw saveFailed('organization update (legacy)', retry.error)
  }
  throw saveFailed('organization update', error)
}

function scheduleWelcomeEmail(ctx: OrgContext, companyName: string, agentName: string): void {
  const email = ctx.user.email
  if (!email) return
  after(async () => {
    try {
      const key = `welcome-email:${ctx.org.id}`
      if (await kvGet<boolean>(key)) return
      const sent = await sendEmail({ to: email, ...welcomeEmail({ name: companyName, agentName }) })
      if (sent) await kvSet(key, true, WELCOME_DEDUPE_SECONDS)
    } catch (error) {
      // Best effort: setup is already saved.
      console.error('[onboarding]', 'welcome email failed', error instanceof Error ? error.message : error)
    }
  })
}

export const POST = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const input = await parseJson(req, onboardingCompleteSchema)

  if (!isSupabaseAdminConfigured()) {
    throw new ApiError(503, 'not_configured', 'Setup can’t be finished right now because the server isn’t fully configured. Please contact support.')
  }
  const admin = createAdminClient()

  const alreadyCompleted = ctx.org.onboarding_completed
  const decision = resolveOnboardingPlan({
    plan: input.plan,
    annual: input.annual,
    stripeConfigured: isStripeConfigured(),
    production: isProduction(),
  })
  const willCheckout = decision.willCheckout && !alreadyCompleted
  if (decision.priceMissing && !alreadyCompleted) {
    console.error('[onboarding]', 'Stripe (or its price id) is missing for the chosen plan; starting the trial instead', input.plan, input.annual ? 'year' : 'month')
  }
  if (willCheckout) await enforceRateLimit(RATE_LIMITS.checkout, ctx.user.id)

  const lockKey = `lock:onboarding:${ctx.org.id}`
  if ((await kvIncr(lockKey, LOCK_TTL_SECONDS)) > 1) {
    throw new ApiError(409, 'onboarding_in_progress', 'We’re already saving your setup. Please wait a moment and try again.')
  }

  try {
    const voice = await resolveVoice(ctx, admin, input.voice)

    // ── Business profile (columns the owner may edit) ──────────────────────
    const profile = await ctx.supabase
      .from('organizations')
      .update({
        name: input.company.name,
        industry: input.company.industry,
        website: input.company.website,
        description: input.company.description,
      })
      .eq('id', ctx.org.id)
    if (profile.error) throw saveFailed('organization profile update', profile.error)

    // ── The organisation's single agent ────────────────────────────────────
    const agent = await saveAgent(ctx, onboardingAgentFields(input, voice))

    // Numbers bought before the agent existed point at it from now on.
    const numbers = await admin
      .from('phone_numbers')
      .update({ agent_id: agent.id })
      .eq('org_id', ctx.org.id)
      .is('agent_id', null)
    if (numbers.error) console.error('[onboarding]', 'linking phone numbers failed', numbers.error.code, numbers.error.message)

    // ── Plan, trial and time zone (server-owned columns) ───────────────────
    // For a paid plan with Stripe configured the paid tier isn't granted yet:
    // the billing webhook upgrades the org once payment or the Stripe trial
    // starts, and onboarding completes then, so a cancelled checkout returns
    // to onboarding instead of the app.
    const trialEndsAt = trialEndsAtFor(ctx.org, decision.effectivePlan, new Date())
    const orgUpdate: Record<string, unknown> = {}
    if (input.company.timezone) orgUpdate.timezone = input.company.timezone
    if (!alreadyCompleted) {
      orgUpdate.onboarding_completed = !willCheckout
      orgUpdate.onboarding_step = 4
      orgUpdate.plan = decision.effectivePlan
      orgUpdate.minutes_limit = PLANS[decision.effectivePlan].minutes_limit
      if (trialEndsAt) orgUpdate.trial_ends_at = trialEndsAt
    }
    await updateOrganization(admin, ctx.org.id, orgUpdate)

    // Timezone and plan feed the provider agents too, so sync after they're saved.
    await syncAgentAfterResponse(agent)
    if (!alreadyCompleted) scheduleWelcomeEmail(ctx, input.company.name, agent.name)

    const base = appUrl()

    // ── Stripe checkout for paid plans ─────────────────────────────────────
    if (willCheckout) {
      try {
        const stripe = getStripeClient()

        let customerId = ctx.org.stripe_customer_id
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: ctx.user.email ?? undefined,
            metadata: { org_id: ctx.org.id, user_id: ctx.user.id },
          })
          customerId = customer.id
          const saved = await admin.from('organizations').update({ stripe_customer_id: customerId }).eq('id', ctx.org.id)
          // Checkout still works with this customer; the billing webhook links it again on payment.
          if (saved.error) console.error('[onboarding]', 'saving the Stripe customer failed', saved.error.code, saved.error.message)
        }

        const interval: BillingInterval = input.annual && stripePriceId(input.plan, 'year') ? 'year' : 'month'
        const lineItems =
          (isSelfServePlan(input.plan) ? await planLineItems(input.plan, interval) : null) ??
          [{ price: decision.priceId, quantity: 1 }]

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          payment_method_types: ['card'],
          mode: 'subscription',
          line_items: lineItems,
          // Onboarding finishes when the webhook applies the plan; /onboarding waits for it, then opens the dashboard.
          success_url: `${base}/onboarding?checkout=success`,
          cancel_url: `${base}/onboarding`,
          // Collect billing address + fiscal code (CUI) for SmartBill B2B invoicing.
          billing_address_collection: 'required',
          tax_id_collection: { enabled: true },
          customer_update: { address: 'auto', name: 'auto' },
          metadata: { org_id: ctx.org.id },
          subscription_data: {
            trial_period_days: 14,
            metadata: { org_id: ctx.org.id },
          },
        })
        if (!session.url) throw new Error('Stripe returned a checkout session without a URL')

        return noStore(NextResponse.json({ success: true, checkout_url: session.url }))
      } catch (error) {
        // Stripe failed: grant the trial so the owner isn't stuck, then continue.
        console.error('[onboarding]', 'Stripe checkout failed; granting the trial', error instanceof Error ? error.message : error)
        await updateOrganization(admin, ctx.org.id, {
          onboarding_completed: true,
          plan: 'trial',
          minutes_limit: PLANS.trial.minutes_limit,
          ...(trialEndsAt ? { trial_ends_at: trialEndsAt } : {}),
        })
      }
    }

    // The plan the organisation is on now (the launch screen shows it): paid
    // tiers stay on trial until checkout, a finished setup keeps its plan.
    const plan = alreadyCompleted ? ctx.org.plan : decision.effectivePlan
    return noStore(NextResponse.json({ success: true, redirect: `${base}/dashboard?welcome=true`, plan }))
  } finally {
    await kvDel(lockKey)
  }
})
