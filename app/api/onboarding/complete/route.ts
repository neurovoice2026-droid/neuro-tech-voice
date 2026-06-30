import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'
import { agents as elAgents, isConfigured as elConfigured } from '@/lib/elevenlabs/client'
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

  const { plan, annual } = (await request.json()) as { plan: Plan; annual?: boolean }
  const interval: BillingInterval = annual ? 'year' : 'month'

  // Get agent — non-fatal in demo mode; ElevenLabs setup is skipped if missing
  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('org_id', org.id)
    .maybeSingle()

  if (agent) {
    // ── Create ElevenLabs conversational agent ─────────────────────────────
    let elevenLabsAgentId: string | null = null

    if (elConfigured()) {
      try {
        const elAgent = await elAgents.create({
          name: agent.name,
          conversation_config: {
            agent: {
              prompt: {
                prompt: agent.system_prompt ?? `You are a helpful assistant for ${org.name ?? 'our company'}.`,
              },
              first_message: agent.first_message ?? 'Hello! How can I help you today?',
              language: agent.language ?? 'en',
            },
            tts: { voice_id: agent.voice_id ?? '' },
          },
        })
        elevenLabsAgentId = elAgent.agent_id ?? null
      } catch {
        // Non-fatal — agent won't have an ElevenLabs ID yet
      }
    }

    await supabase
      .from('agents')
      .update({ elevenlabs_agent_id: elevenLabsAgentId, is_active: !!elevenLabsAgentId })
      .eq('id', agent.id)
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

  await supabase
    .from('organizations')
    .update({
      onboarding_completed: true,
      onboarding_step: 5,
      plan: effectivePlan,
      minutes_limit: PLANS[effectivePlan].minutes_limit,
    })
    .eq('user_id', user.id)

  // Welcome email (best-effort — never blocks onboarding).
  if (user.email) {
    void sendEmail({
      to: user.email,
      ...welcomeEmail({ name: org.name ?? undefined, agentName: agent?.name }),
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
      // Stripe failed — fall through to the dashboard on the free tier.
      console.error('Stripe error:', err)
    }
  }

  return NextResponse.json({
    success: true,
    redirect: `${appUrl}/dashboard?welcome=true`,
  })
}
