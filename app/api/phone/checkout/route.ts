import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'
import { PHONE_NUMBER_MONTHLY_PRICE_USD } from '@/lib/phone/pricing'

// Starts a recurring monthly Stripe subscription for a specific phone number
// the Customer picked from search results - its own dedicated subscription,
// not an item on the org's plan subscription, so the webhook can tell them
// apart (see app/api/billing/webhook's applySubscription early-return on
// metadata.type === 'phone_number', and the subscription.deleted handling
// that releases the number if this subscription is ever cancelled). The
// number is only actually purchased from Twilio/imported into ElevenLabs
// after the first payment succeeds - see checkout.session.completed there.
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 })
  }

  const { number, country, agent_id } = (await request.json().catch(() => ({}))) as {
    number?: string
    country?: string
    agent_id?: string
  }
  if (!number) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
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
      await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', org.id)
    }

    const metadata = {
      type: 'phone_number',
      org_id: org.id,
      number,
      country: country ?? 'US',
      ...(agent_id ? { agent_id } : {}),
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(PHONE_NUMBER_MONTHLY_PRICE_USD * 100),
            recurring: { interval: 'month' },
            product_data: {
              name: `Phone number ${number}`,
              description: 'Monthly phone number fee',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/phone?purchased=true`,
      cancel_url: `${appUrl}/phone?canceled=true`,
      // Set on both: the session's own metadata (read in checkout.session.completed)
      // and subscription_data.metadata, which Stripe copies onto the actual
      // Subscription object - needed so customer.subscription.* events (which
      // only carry the Subscription, not the originating session) can also
      // tell this apart from a plan subscription.
      metadata,
      subscription_data: { metadata },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Phone number checkout session error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
