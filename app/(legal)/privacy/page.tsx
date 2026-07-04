import type { Metadata } from 'next'
import { LegalHeader, LegalSection } from '@/components/marketing/LegalContent'

export const metadata: Metadata = {
  title: 'Privacy Policy - Neuro Tech Voice',
  description: 'How Neuro Tech Voice collects, uses, and protects your data.',
}

const UPDATED = 'July 4, 2026'

export default function PrivacyPolicyPage() {
  return (
    <>
      <LegalHeader title="Privacy Policy" updated={UPDATED} />

      <LegalSection title="1. Who we are">
        <p>
          This Privacy Policy is issued by <strong>Neuro Tech Voice S.R.L.</strong>, a company
          registered in Romania under fiscal code (CUI) <strong>53666540</strong>, with its
          registered address at Bulevardul Revoluția Din Decembrie, Nr. 12, Ap. 2, Reșița,
          Județ Caraș-Severin, România (&quot;Neuro Tech Voice&quot;, &quot;we&quot;, &quot;us&quot;,
          or &quot;our&quot;).
        </p>
        <p>
          We provide an AI voice agent platform that answers, qualifies, and books calls on
          behalf of our business customers (&quot;Customers&quot;). This policy explains how we
          collect, use, share, and protect personal data when you visit our website, create an
          account, use our dashboard, or otherwise interact with our services (collectively, the
          &quot;Service&quot;).
        </p>
      </LegalSection>

      <LegalSection title="2. Scope of this policy">
        <p>
          This policy applies to visitors of our website and to Customers who register for an
          account. It also explains, at a high level, how we process data belonging to the
          people who call or are called by a Customer&apos;s AI agent (&quot;End Callers&quot;).
        </p>
        <p>
          For most call data, our Customer is the data controller (they decide to deploy an AI
          agent on their business line and configure what it does), and Neuro Tech Voice acts as
          a data processor, processing that data on the Customer&apos;s behalf and instructions.
          If you are an End Caller and have a question about how your call was handled, please
          contact the business you called directly, they are best placed to assist you, and can
          contact us on your behalf if needed.
        </p>
      </LegalSection>

      <LegalSection title="3. Information we collect">
        <p>We collect the following categories of information:</p>
        <ul>
          <li>
            <strong>Account and company data:</strong> name, email address, password (hashed),
            company name, industry, and any other details you provide when you register or
            configure your organization.
          </li>
          <li>
            <strong>Billing data:</strong> your subscription plan, invoices, and payment method
            details. Card numbers are collected and stored directly by our payment processor;
            we never see or store full card numbers ourselves.
          </li>
          <li>
            <strong>Agent configuration data:</strong> the personality, scripts, prompts,
            knowledge-base documents, and voice you choose for your AI agent.
          </li>
          <li>
            <strong>Call content:</strong> when your AI agent handles a call, we process the
            audio in real time to generate a response, and, depending on your settings, may
            store a transcript, an audio recording, and a sentiment summary of the call.
          </li>
          <li>
            <strong>Usage and device data:</strong> log data, IP address, browser type, pages
            visited, and similar technical information collected automatically when you use our
            website or dashboard.
          </li>
          <li>
            <strong>Cookies and similar technologies:</strong> see our{' '}
            <a href="/cookies">Cookie Policy</a> for details.
          </li>
          <li>
            <strong>Third-party integration data:</strong> if you connect Google Calendar,
            Gmail, Sheets, Docs, or Drive, we access only the specific data needed to perform the
            action you configured (for example, creating a calendar event or a spreadsheet row).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. How we use information">
        <p>We use the information described above to:</p>
        <ul>
          <li>provide, operate, and maintain the Service, including routing and answering calls;</li>
          <li>create and manage your account and process payments;</li>
          <li>generate transcripts, summaries, and analytics you request;</li>
          <li>send you service, billing, and security notifications;</li>
          <li>improve the reliability, safety, and quality of our AI agents;</li>
          <li>detect, investigate, and prevent fraud, abuse, or violations of our{' '}
            <a href="/terms">Terms of Service</a>; and
          </li>
          <li>comply with legal obligations, including tax and accounting rules.</li>
        </ul>
        <p>
          Where we act as a data controller (for example, for your account and billing data),
          our legal bases under the EU General Data Protection Regulation (GDPR) are the
          performance of our contract with you, our legitimate interest in operating and
          securing the Service, your consent where requested, and compliance with legal
          obligations.
        </p>
      </LegalSection>

      <LegalSection title="5. Call recording and transcription">
        <p>
          Call recording and transcription is a feature Customers can enable for their own AI
          agent. <strong>Laws on recording phone calls vary significantly by country and, in the
          United States, by state.</strong> Some jurisdictions require the consent of only one
          party to a call, while others require the consent of all parties before a call may be
          recorded.
        </p>
        <p>
          As the party that enables call recording and instructs our Service to record specific
          lines, our <strong>Customers are responsible for complying with all applicable
          recording-consent laws</strong> in the jurisdictions where they and their callers are
          located, including providing any required notice or disclosure to callers (for
          example, an automated announcement at the start of a call). Neuro Tech Voice provides
          the technical means to record and configure such notices, but does not determine
          whether recording is legally permitted for any specific call.
        </p>
      </LegalSection>

      <LegalSection title="6. How we share information">
        <p>
          We do not sell personal data. We share information only with:
        </p>
        <ul>
          <li>
            <strong>Infrastructure and hosting providers</strong> that store our database and
            run our application;
          </li>
          <li>
            <strong>Voice and speech-processing technology partners</strong> that convert speech
            to text and generate the AI agent&apos;s spoken responses;
          </li>
          <li>
            <strong>Telephony carriers</strong> that provide and route phone numbers and calls;
          </li>
          <li>
            <strong>Payment processors</strong> that handle subscription billing;
          </li>
          <li>
            <strong>Email delivery providers</strong> that send transactional emails on our
            behalf;
          </li>
          <li>
            <strong>Google APIs</strong>, only when you explicitly connect a Google integration,
            and only to perform the action you configured; and
          </li>
          <li>
            <strong>Authorities</strong>, where required by law, regulation, or a valid legal
            process.
          </li>
        </ul>
        <p>
          Neuro Tech Voice&apos;s use and transfer of information received from Google APIs to
          any other app will adhere to the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <p>
          A full, up-to-date list of subprocessors, and a Data Processing Agreement (DPA) for
          Customers who need one for their own compliance, is available on request using the
          contact details below.
        </p>
      </LegalSection>

      <LegalSection title="7. International data transfers">
        <p>
          Neuro Tech Voice is based in Romania (European Union). Some of our infrastructure and
          subprocessor partners are located outside the European Economic Area (EEA), including
          in the United States. Where we transfer personal data outside the EEA, we rely on
          appropriate safeguards recognized under GDPR, such as Standard Contractual Clauses, or
          transfers to providers certified under an applicable adequacy framework.
        </p>
      </LegalSection>

      <LegalSection title="8. Data retention">
        <p>
          We retain account and billing data for as long as your account is active and for a
          reasonable period afterward to comply with tax, accounting, and legal obligations. Call
          recordings and transcripts are retained according to your organization&apos;s settings
          and plan, and are deleted or anonymized after account closure, subject to any
          legal retention requirements.
        </p>
      </LegalSection>

      <LegalSection title="9. Your rights">
        <p>
          If you are located in the European Economic Area, the United Kingdom, or a
          jurisdiction with similar protections, you have the right to request access to,
          correction of, deletion of, or a copy of your personal data, to object to or restrict
          certain processing, and to withdraw consent at any time. You also have the right to
          lodge a complaint with your local data protection authority, for Romania, this is the{' '}
          <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer">
            National Supervisory Authority for Personal Data Processing (ANSPDCP)
          </a>
          .
        </p>
        <p>
          If you are a California resident, you have rights under the California Consumer
          Privacy Act (CCPA/CPRA), including the right to know what personal information we
          collect, to request deletion, to correct inaccurate information, and to opt out of the
          sale or sharing of personal information. We do not sell or share personal information
          for cross-context behavioral advertising.
        </p>
        <p>
          To exercise any of these rights, contact us using the details in Section 14.
        </p>
      </LegalSection>

      <LegalSection title="10. Children's privacy">
        <p>
          Our Service is intended for business use and is not directed at children. We do not
          knowingly collect personal data from individuals under 16 years of age.
        </p>
      </LegalSection>

      <LegalSection title="11. Security">
        <p>
          We use administrative, technical, and physical safeguards designed to protect personal
          data, including encryption in transit, access controls, and row-level security on our
          database. No method of transmission or storage is completely secure, and we cannot
          guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection title="12. Cookies">
        <p>
          Our website and dashboard use cookies and similar technologies. See our{' '}
          <a href="/cookies">Cookie Policy</a> for details on what we use and how to control
          them.
        </p>
      </LegalSection>

      <LegalSection title="13. Changes to this policy">
        <p>
          We may update this policy from time to time. If we make material changes, we will
          notify Customers by email or through the dashboard before the changes take effect. The
          &quot;Last updated&quot; date above reflects the most recent revision.
        </p>
      </LegalSection>

      <LegalSection title="14. Contact us">
        <p>
          Questions about this policy or requests regarding your personal data can be sent to:
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
