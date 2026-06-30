import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'

// Authenticated billing portal — manage payment method, invoices, cancellation.
export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!org?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account yet' }, { status: 400 })
  }

  const stripe = getStripeClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${appUrl}/billing`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Billing portal error:', err)
    return NextResponse.json({ error: 'Failed to open billing portal' }, { status: 500 })
  }
}
