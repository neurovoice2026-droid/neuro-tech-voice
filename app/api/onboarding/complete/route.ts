import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'
import { isConfigured as elConfigured } from '@/lib/elevenlabs/client'
import { createAgentWithFallback } from '@/lib/elevenlabs/create-agent'
import { linkNumbersToAgent } from '@/lib/phone/link'
import { sendEmail } from '@/lib/email/client'
import { welcomeEmail } from '@/lib/email/templates'
import { PLANS, stripePriceId } from '@/types'
import type { Plan, BillingInterval } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const body = (await request.json()) as {
    plan: Plan
    annual?: boolean
    company?: { name?: string; industry?: string; website?: string; description?: string }
    agent?: { name?: string; language?: string; system_prompt?: string; first_message?: string }
    voice?: { voice_id?: string; voice_name?: string }
  }
  const { plan, annual } = body
  const interval: BillingInterval = annual ? 'year' : 'month'

  // ── Persist the company details entered during onboarding ────────────────
  if (body.company) {
    await supabase
      .from('organizations')
      .update({
        name:        body.company.name ?? org.name,
        industry:    body.company.industry ?? org.industry,
        website:     body.company.website ?? org.website,
        description: body.company.description ?? org.description,
      })
      .eq('id', org.id)
  }

  // ── Upsert the agent row with the full onboarding config ─────────────────
  const agentData = {
    name:          body.agent?.name || 'My Agent',
    language:      body.agent?.language || 'en',
    system_prompt: body.agent?.system_prompt || null,
    first_message: body.agent?.first_message || 'Hello! How can I help you today?',
    voice_id:      body.voice?.voice_id || null,
    voice_name:    body.voice?.voice_name || null,
  }

  const { data: existingAgent } = await supabase
    .from('agents')
    .select('id')
    .eq('org_id', org.id)
    .limit(1)
    .maybeSingle()

  let agentId: string | null = existingAgent?.id ?? null
  if (existingAgent) {
    await supabase.from('agents').update(agentData).eq('id', existingAgent.id)
  } else {
    const { data: newAgent } = await supabase
      .from('agents')
      .insert({ org_id: org.id, ...agentData })
      .select('id')
      .single()
    agentId = newAgent?.id ?? null
  }

  // ── Create the ElevenLabs conversational agent ───────────────────────────
  if (agentId && elConfigured()) {
    const { agent_id: elevenLabsAgentId } = await createAgentWithFallback({
      name: agentData.name,
      system_prompt: agentData.system_prompt ?? `You are a helpful assistant for ${body.company?.name ?? org.name ?? 'our company'}.`,
      first_message: agentData.first_message,
      language: agentData.language,
      voice_id: agentData.voice_id,
    })

    await supabase
      .from('agents')
      .update({ elevenlabs_agent_id: elevenLabsAgentId, is_active: !!elevenLabsAgentId })
      .eq('id', agentId)

    // Link the org's phone number(s) to the new agent so inbound calls route to it.
    if (elevenLabsAgentId) {
      await linkNumbersToAgent(supabase, org.id, agentId, elevenLabsAgentId)
    }
  }

  // Mark onboarding complete. For a paid plan with Stripe configured we do NOT
  // grant the paid tier yet — the billing webhook upgrades the org only once
  // payment/trial actually starts. In demo mode (no Stripe) we grant it directly
  // so the product is usable without a payment provider.
  const planConfig = PLANS[plan]
  // Self-serve paid tiers go through Stripe checkout; trial and custom (which
  // have no price id) land on the trial tier until billing/sales takes over.
  // Fall back to the monthly price if an annual one isn't configured yet.
  const priceId = stripePriceId(plan, interval) || planConfig.stripe_price_id
  const willCheckout = !!priceId && isStripeConfigured()
  const effectivePlan: Plan = willCheckout || planConfig.contact_sales ? 'trial' : plan

  // Only mark onboarding complete now if we're NOT sending the user to Stripe.
  // For paid checkout it's completed on payment success (billing webhook), so a
  // cancelled checkout returns to onboarding instead of dumping them in the app.
  await supabase
    .from('organizations')
    .update({
      onboarding_completed: !willCheckout,
      onboarding_step: 6,
      plan: effectivePlan,
      minutes_limit: PLANS[effectivePlan].minutes_limit,
    })
    .eq('user_id', user.id)

  // Welcome email (best-effort — never blocks onboarding).
  if (user.email) {
    void sendEmail({
      to: user.email,
      ...welcomeEmail({ name: body.company?.name ?? org.name ?? undefined, agentName: agentData.name }),
    })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // ── Stripe checkout for paid plans ───────────────────────────────────────
  if (willCheckout) {
    try {
      const stripe = getStripeClient()

      // Get or create Stripe customer
      let customerId = org.stripe_customer_id
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { org_id: org.id, user_id: user.id },
        })
        customerId = customer.id
        await supabase
          .from('organizations')
          .update({ stripe_customer_id: customerId })
          .eq('user_id', user.id)
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

      return NextResponse.json({ success: true, checkout_url: session.url })
    } catch (err) {
      // Stripe failed — grant the trial so the user isn't stuck, then continue.
      console.error('Stripe error:', err)
      await supabase
        .from('organizations')
        .update({ onboarding_completed: true, plan: 'trial', minutes_limit: PLANS.trial.minutes_limit })
        .eq('user_id', user.id)
    }
  }

  return NextResponse.json({
    success: true,
    redirect: `${appUrl}/dashboard?welcome=true`,
  })
}
