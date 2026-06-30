import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'
import { PLANS } from '@/types'
import type { Plan } from '@/types'

// Authenticated checkout — lets an existing user upgrade from the dashboard.
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 })
  }

  const { plan } = (await request.json().catch(() => ({}))) as { plan?: Plan }
  // Custom is sales-led; trial has no checkout. Only the self-serve paid tiers.
  if (plan !== 'starter' && plan !== 'pro' && plan !== 'business') {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const priceId = PLANS[plan].stripe_price_id
  if (!priceId) {
    return NextResponse.json({ error: `No Stripe price configured for ${plan}` }, { status: 400 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id, stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const stripe = getStripeClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
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
        .eq('id', org.id)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?success=true`,
      cancel_url: `${appUrl}/billing?canceled=true`,
      allow_promotion_codes: true,
      // Collect the buyer's billing address + fiscal code (CUI) so the SmartBill
      // invoice emitted on payment has the data Romanian B2B invoicing requires.
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      metadata: { org_id: org.id },
      subscription_data: { metadata: { org_id: org.id } },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout session error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
