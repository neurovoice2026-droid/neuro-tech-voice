import type { Metadata } from 'next'
import { LegalHeader, LegalSection } from '@/components/marketing/LegalContent'

export const metadata: Metadata = {
  title: 'Terms of Service - Neuro Tech Voice',
  description: 'The terms governing your use of Neuro Tech Voice.',
}

const UPDATED = 'July 4, 2026'

export default function TermsPage() {
  return (
    <>
      <LegalHeader title="Terms of Service" updated={UPDATED} />

      <LegalSection title="1. Acceptance of these terms">
        <p>
          These Terms of Service (&quot;Terms&quot;) form a binding agreement between you, the
          business or individual creating an account (&quot;Customer&quot;, &quot;you&quot;), and{' '}
          <strong>Neuro Tech Voice S.R.L.</strong>, CUI 53666540, registered address Bulevardul
          Revoluția Din Decembrie, Nr. 12, Ap. 2, Reșița, Județ Caraș-Severin, România
          (&quot;Neuro Tech Voice&quot;, &quot;we&quot;). By creating an account or using our AI
          voice agent platform (the &quot;Service&quot;), you agree to these Terms. If you do not
          agree, do not use the Service.
        </p>
      </LegalSection>

      <LegalSection title="2. Description of the Service">
        <p>
          Neuro Tech Voice provides a platform to configure and deploy an AI voice agent that can
          answer inbound calls, place outbound calls, schedule appointments, and integrate with
          third-party productivity tools. Features, minutes, and limits available to you depend
          on your selected subscription plan.
        </p>
      </LegalSection>

      <LegalSection title="3. Eligibility and accounts">
        <p>
          The Service is intended for business use. You must be at least 18 years old and have
          the authority to bind the business you represent to these Terms. You are responsible
          for maintaining the confidentiality of your account credentials and for all activity
          that occurs under your account.
        </p>
      </LegalSection>

      <LegalSection title="4. Plans, billing, and free trial">
        <p>
          New accounts begin with a free trial (currently 14 days, with a limited number of
          included minutes) that does not require a credit card. Paid plans are billed monthly or
          annually in advance, in accordance with the pricing displayed on our website at the
          time of purchase. Usage beyond the minutes included in your plan is billed at the
          applicable per-minute overage rate for that plan.
        </p>
        <p>
          Subscriptions renew automatically at the end of each billing period unless cancelled
          before the renewal date. We may change our prices, but will give existing Customers
          reasonable advance notice before a price change takes effect on their account.
        </p>
      </LegalSection>

      <LegalSection title="5. Cancellation and refunds">
        <p>
          You may upgrade, downgrade, or cancel your subscription at any time from your billing
          settings. Cancellation takes effect at the end of the current billing period unless
          stated otherwise. See our <a href="/refund-policy">Refund &amp; Cancellation Policy</a>{' '}
          for full details on refund eligibility.
        </p>
      </LegalSection>

      <LegalSection title="6. Acceptable use">
        <p>You agree not to use the Service to:</p>
        <ul>
          <li>
            place calls in violation of applicable telemarketing, robocall, or do-not-call laws
            (including, in the United States, the Telephone Consumer Protection Act (TCPA) and
            related state laws);
          </li>
          <li>record any call without obtaining any consent required by applicable law;</li>
          <li>harass, threaten, defraud, or mislead any person;</li>
          <li>
            transmit unlawful, defamatory, infringing, or sexually explicit content, or content
            that violates the rights of a third party;
          </li>
          <li>attempt to reverse-engineer, resell, or white-label the Service without our written consent; or</li>
          <li>interfere with or disrupt the integrity or performance of the Service.</li>
        </ul>
        <p>
          You are solely responsible for the content, scripts, and instructions you configure for
          your AI agent, and for ensuring your use of the Service complies with all laws
          applicable to your business and the jurisdictions in which your callers are located.
        </p>
      </LegalSection>

      <LegalSection title="7. Your content and license">
        <p>
          You retain ownership of the content you provide to configure your agent (scripts,
          knowledge-base documents, prompts) and of the call recordings and transcripts generated
          through your use of the Service (&quot;Your Content&quot;). You grant us a limited
          license to host, process, and use Your Content solely to provide and improve the
          Service to you.
        </p>
      </LegalSection>

      <LegalSection title="8. Intellectual property">
        <p>
          The Service, including its software, design, and trademarks, is owned by Neuro Tech
          Voice and its licensors and is protected by intellectual property laws. Nothing in
          these Terms grants you any right to use our trademarks or branding without our prior
          written consent.
        </p>
      </LegalSection>

      <LegalSection title="9. Third-party services">
        <p>
          The Service integrates with third-party providers (for example, calendar, email,
          document, and payment providers). Your use of those integrations is also subject to the
          relevant third party&apos;s own terms and privacy policy. We are not responsible for the
          acts or omissions of third-party providers.
        </p>
      </LegalSection>

      <LegalSection title="10. Disclaimers">
        <p>
          The Service, including AI-generated speech and conversation, is provided &quot;as
          is&quot; and &quot;as available.&quot; AI-generated responses may occasionally be
          inaccurate or unexpected. We do not guarantee that the Service will be uninterrupted,
          error-free, or available at all times. To the maximum extent permitted by law, we
          disclaim all warranties, express or implied, including merchantability, fitness for a
          particular purpose, and non-infringement.
        </p>
      </LegalSection>

      <LegalSection title="11. Limitation of liability">
        <p>
          To the maximum extent permitted by applicable law, Neuro Tech Voice will not be liable
          for any indirect, incidental, special, consequential, or punitive damages, or any loss
          of profits, revenue, data, or business opportunity, arising out of or related to your
          use of the Service. Our total liability arising out of these Terms will not exceed the
          amount you paid us for the Service in the twelve (12) months preceding the claim.
          Nothing in these Terms limits liability that cannot be limited under applicable law.
        </p>
      </LegalSection>

      <LegalSection title="12. Indemnification">
        <p>
          You agree to indemnify and hold Neuro Tech Voice harmless from any claims, damages, or
          expenses (including reasonable legal fees) arising from your use of the Service, your
          violation of these Terms, or your violation of any applicable law, including laws
          governing telemarketing, recording consent, or data protection.
        </p>
      </LegalSection>

      <LegalSection title="13. Termination">
        <p>
          We may suspend or terminate your access to the Service if you materially breach these
          Terms, including the Acceptable Use section, or if required to do so by law. You may
          terminate your account at any time as described in Section 5.
        </p>
      </LegalSection>

      <LegalSection title="14. Governing law and disputes">
        <p>
          These Terms are governed by the laws of Romania, without regard to conflict-of-law
          principles, except where mandatory consumer-protection laws of your country of
          residence apply and cannot be excluded. Any dispute arising out of these Terms will be
          submitted to the competent courts of Romania, unless applicable law requires otherwise.
        </p>
      </LegalSection>

      <LegalSection title="15. Changes to these terms">
        <p>
          We may update these Terms from time to time. If we make material changes, we will
          notify you by email or through the dashboard before the changes take effect. Continued
          use of the Service after changes take effect constitutes acceptance of the updated
          Terms.
        </p>
      </LegalSection>

      <LegalSection title="16. Contact us">
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
