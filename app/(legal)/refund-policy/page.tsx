import type { Metadata } from 'next'
import { LegalHeader, LegalSection } from '@/components/marketing/LegalContent'
import { PLANS } from '@/types'

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy',
  description: 'Our policy on trials, billing, cancellations, and refunds.',
}

const UPDATED = 'October 15, 2026'

export default function RefundPolicyPage() {
  return (
    <>
      <LegalHeader title="Refund &amp; Cancellation Policy" updated={UPDATED} />

      <LegalSection title="1. Free trial">
        <p>
          Every new account starts with a 14-day free trial, including {PLANS.trial.minutes_limit}{' '}
          minutes of usage, with no credit card required. If you do not upgrade to a paid plan,
          your trial simply expires at the end of the 14 days; you will not be charged.
        </p>
      </LegalSection>

      <LegalSection title="2. Subscription billing">
        <p>
          Paid plans are billed in advance, either monthly or annually depending on the billing
          interval you select. Annual billing is discounted to the equivalent of 10 months&apos;
          payment (2 months free) compared to paying monthly. Subscriptions renew automatically
          at the end of each billing period until canceled. An upgrade to a higher-priced plan
          on the same billing interval takes effect right away, and the price difference for the
          rest of the billing period is charged immediately. A downgrade, a change to a plan at
          the same price, or a change between monthly and annual billing takes effect at the
          end of the current billing period: nothing is charged or refunded at the time of the
          change, and the new price is invoiced at that renewal. While a paid subscription is
          still in its free trial period, a change takes effect right away and nothing is
          charged until the trial ends.
        </p>
      </LegalSection>

      <LegalSection title="3. Cancellation">
        <p>
          You can cancel your subscription at any time from your billing settings, which are
          powered by our payment processor&apos;s customer portal. When you cancel, your plan
          remains active until the end of the billing period you have already paid for, and will
          not renew afterward. You will not be charged again after cancellation.
        </p>
      </LegalSection>

      <LegalSection title="4. Refunds">
        <p>
          Neuro Tech Voice is a business-to-business (B2B) service intended for use by companies
          and professionals in the course of their business. As such, statutory consumer
          withdrawal rights that apply to purchases made by private consumers may not apply to
          your subscription.
        </p>
        <p>
          That said, we do not want you to pay for something you are not using. As a matter of
          business practice (not a guarantee of entitlement):
        </p>
        <ul>
          <li>
            we do not provide pro-rated refunds for partial billing periods when you cancel
            mid-cycle, your access simply continues until the period you already paid for ends;
          </li>
          <li>
            if you believe you were charged in error (for example, a duplicate charge or a
            failure to process your cancellation on time), contact us within 30 days and we will
            investigate and issue a refund or credit if warranted; and
          </li>
          <li>
            annual plans canceled shortly after purchase may, at our discretion, receive a
            pro-rated refund for the unused portion of the year, minus any minutes already
            consumed.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Included minutes and extra minute packs">
        <p>
          Each paid plan includes a number of call minutes a month. Included minutes reset every
          month, on annual billing too, and do not carry over. When your included minutes and any
          extra minutes you bought are used up, calls pause until you add minutes; we do not bill
          usage after the fact.
        </p>
        <p>
          On a paid plan you can buy extra minute packs. Packs are prepaid, one-time purchases,
          charged when you buy them (or, if you turn on auto top-up, each time your remaining
          minutes fall below the threshold you set). Purchased minutes are used only after your
          plan&apos;s included minutes and never expire while your account exists.
        </p>
        <ul>
          <li>minutes already used, from a pack or from your plan, are non-refundable;</li>
          <li>
            a request to refund a pack, or the unused minutes of a pack (for example, an auto
            top-up you did not intend or a duplicate charge), is handled under section 4 above,
            like any other refund request; and
          </li>
          <li>
            you can turn auto top-up off at any time from your billing settings; a failed auto
            top-up charge is never retried automatically.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Contact us">
        <p>
          For billing questions or refund requests, contact:
        </p>
        <p>
          Neuro Tech Voice S.R.L.
          <br />
          Bulevardul Revoluția Din Decembrie, Nr. 12, Ap. 2, Reșița, Județ Caraș-Severin, România
          <br />
          Phone: <a href="tel:+40774566367">+40 774 566 367</a>
        </p>
      </LegalSection>
    </>
  )
}
