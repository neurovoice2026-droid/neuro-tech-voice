import type { Metadata } from 'next'
import { LegalHeader, LegalSection } from '@/components/marketing/LegalContent'
import { PLANS } from '@/types'

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy - Neuro Tech Voice',
  description: 'Our policy on trials, billing, cancellations, and refunds.',
}

const UPDATED = 'July 4, 2026'

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
          at the end of each billing period until cancelled.
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
            annual plans cancelled shortly after purchase may, at our discretion, receive a
            pro-rated refund for the unused portion of the year, minus any minutes already
            consumed.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Overage charges">
        <p>
          If your usage exceeds the minutes included in your plan, additional minutes are billed
          at your plan&apos;s per-minute overage rate. Overage charges reflect calls already
          placed or received and are non-refundable.
        </p>
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
