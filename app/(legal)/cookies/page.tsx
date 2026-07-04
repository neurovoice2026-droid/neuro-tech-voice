import type { Metadata } from 'next'
import { LegalHeader, LegalSection } from '@/components/marketing/LegalContent'

export const metadata: Metadata = {
  title: 'Cookie Policy - Neuro Tech Voice',
  description: 'How Neuro Tech Voice uses cookies and similar technologies.',
}

const UPDATED = 'July 4, 2026'

export default function CookiePolicyPage() {
  return (
    <>
      <LegalHeader title="Cookie Policy" updated={UPDATED} />

      <LegalSection title="1. What are cookies">
        <p>
          Cookies are small text files placed on your device when you visit a website. They are
          widely used to make websites work, work more efficiently, and to provide information to
          the site owner.
        </p>
      </LegalSection>

      <LegalSection title="2. Cookies we use">
        <p>Neuro Tech Voice currently uses the following categories of cookies:</p>
        <ul>
          <li>
            <strong>Strictly necessary cookies:</strong> used to keep you signed in and to
            secure your session while using our dashboard. These cookies are set by our
            authentication provider and cannot be switched off, as the Service will not function
            correctly without them.
          </li>
        </ul>
        <p>
          We do not currently use analytics or advertising cookies on this website. If that
          changes, we will update this policy and request your consent through a cookie banner
          before any non-essential cookie is set, as required by applicable law.
        </p>
      </LegalSection>

      <LegalSection title="3. Third-party cookies">
        <p>
          Some pages may load content from third parties (for example, our payment processor
          during checkout, or Google during an integration sign-in) that may set their own
          cookies in accordance with their respective privacy and cookie policies. We do not
          control these third-party cookies.
        </p>
      </LegalSection>

      <LegalSection title="4. How to control cookies">
        <p>
          Most browsers let you refuse or delete cookies through their settings. Because our
          strictly necessary cookies are required to keep you signed in, blocking them will
          prevent you from using the dashboard. Refer to your browser&apos;s help documentation
          for instructions on managing cookies.
        </p>
      </LegalSection>

      <LegalSection title="5. Changes to this policy">
        <p>
          We may update this Cookie Policy as our use of cookies changes. The &quot;Last
          updated&quot; date above reflects the most recent revision.
        </p>
      </LegalSection>

      <LegalSection title="6. Contact us">
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
