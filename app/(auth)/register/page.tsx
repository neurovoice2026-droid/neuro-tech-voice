import type { Metadata } from 'next'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { BusinessIntentCookie } from '@/components/auth/BusinessIntentCookie'
import { REGISTER_INTRO } from '@/components/auth/register-intro'
import { businessTypeFromIntent } from '@/lib/auth/business-intent'

export const metadata: Metadata = {
  title: 'Create account',
}

// `?intent=store` (the store plans' "Start free") is kept in a cookie for
// Step 0 of the onboarding, which pre-selects "Online store" from it. The
// page reads the query on the server so the store wording is in the first
// paint; the cookie itself is written by the browser.
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string | string[] }>
}) {
  const intent = businessTypeFromIntent((await searchParams).intent)

  return (
    <div className="flex flex-col gap-8">
      {intent && <BusinessIntentCookie businessType={intent} />}
      <div>
        <Eyebrow>Start free · 14 days</Eyebrow>
        <h1 className="mt-4 font-heading font-title text-[30px] leading-[36px] tracking-[-0.025em] text-balance text-foreground md:text-[36px] md:leading-[42px]">
          Create your account
        </h1>
        <p className="mt-2 text-[15px] leading-[22px] text-muted-foreground">
          {intent === 'ecommerce' ? REGISTER_INTRO.ecommerce : REGISTER_INTRO.services}
        </p>
      </div>

      <RegisterForm />
    </div>
  )
}
