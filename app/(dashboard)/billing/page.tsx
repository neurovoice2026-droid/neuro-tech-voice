import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getOrgContext, type OrgContext } from '@/lib/api/auth'
import { getUsageSummary } from '@/lib/billing/usage'
import { isStripeConfigured, priceIdFor } from '@/lib/stripe/client'
import { AUTH } from '@/lib/site'
import { BillingSkeleton } from '@/components/billing/BillingSkeleton'
import { CheckoutStatusToast } from '@/components/billing/CheckoutStatusToast'
import { InvoicesList, type BillingInvoice } from '@/components/billing/InvoicesList'
import { ManageBillingButton } from '@/components/billing/ManageBillingButton'
import { PhoneNumbersSummary, type BillingPhoneNumber } from '@/components/billing/PhoneNumbersSummary'
import { PlanFeatures } from '@/components/billing/PlanFeatures'
import { PlanPicker, type SelfServePlanId } from '@/components/billing/PlanPicker'
import { UsageOverview } from '@/components/billing/UsageOverview'

// Billing: usage this period, what the plan includes, plan changes, phone
// number subscriptions and invoices. Server-rendered from the database; the
// only client pieces are the plan picker, the portal button and the checkout toast.

const INVOICE_COLUMNS = 'id, smartbill_series, smartbill_number, amount, currency, status, pdf_url, issued_at, created_at'

async function BillingOverview({ ctx }: { ctx: OrgContext }) {
  const { org, supabase } = ctx

  const [summary, invoices, numbers] = await Promise.all([
    getUsageSummary(org, { supabase }),
    supabase.from('invoices').select(INVOICE_COLUMNS).eq('org_id', org.id).order('created_at', { ascending: false }).limit(24),
    supabase
      .from('phone_numbers')
      .select('id, number, country, is_active, monthly_cost')
      .eq('org_id', org.id)
      .order('created_at', { ascending: true }),
  ])
  if (invoices.error) console.error('[billing] invoices read failed', org.id, invoices.error.code, invoices.error.message)
  if (numbers.error) console.error('[billing] phone numbers read failed', org.id, numbers.error.code, numbers.error.message)

  const stripeConfigured = isStripeConfigured()
  const plans: SelfServePlanId[] = ['starter', 'pro', 'business']
  const availability = Object.fromEntries(
    plans.map((plan) => [plan, { month: !!priceIdFor(plan, 'month'), year: !!priceIdFor(plan, 'year') }])
  ) as Record<SelfServePlanId, { month: boolean; year: boolean }>

  return (
    <div className="space-y-6">
      <UsageOverview summary={summary} timeZone={org.timezone} />

      <div className="grid gap-6 lg:grid-cols-2">
        <PlanFeatures plan={summary.plan} />
        <PhoneNumbersSummary numbers={(numbers.data ?? []) as BillingPhoneNumber[]} failed={!!numbers.error} />
      </div>

      <PlanPicker
        currentPlan={summary.plan}
        currentInterval={org.billing_interval}
        hasActiveSubscription={summary.plan !== 'trial' && !!org.stripe_subscription_id}
        stripeConfigured={stripeConfigured}
        availability={availability}
        salesHref={AUTH.contactSales}
      />

      <InvoicesList
        invoices={(invoices.data ?? []) as BillingInvoice[]}
        failed={!!invoices.error}
        timeZone={org.timezone}
        hasBillingAccount={!!org.stripe_customer_id}
      />
    </div>
  )
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/login')

  const { checkout } = await searchParams
  const status = checkout === 'success' ? 'success' : checkout === 'canceled' ? 'canceled' : null
  const showPortal = isStripeConfigured() && !!ctx.org.stripe_customer_id

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your plan, minutes, phone numbers and invoices in one place.
          </p>
        </div>
        {showPortal && <ManageBillingButton className="w-full sm:w-auto" />}
      </div>

      <CheckoutStatusToast status={status} plan={ctx.org.plan} />

      <Suspense fallback={<BillingSkeleton />}>
        <BillingOverview ctx={ctx} />
      </Suspense>
    </div>
  )
}
