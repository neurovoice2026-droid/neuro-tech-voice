import type { Metadata } from 'next'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata: Metadata = {
  title: 'Create account',
}

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow>Start free · 14 days</Eyebrow>
        <h1 className="mt-4 font-heading font-title text-[30px] leading-[36px] tracking-[-0.025em] text-balance text-foreground md:text-[36px] md:leading-[42px]">
          Create your account
        </h1>
        <p className="mt-2 text-[15px] leading-[22px] text-muted-foreground">
          Start your free 14-day trial — no credit card required
        </p>
      </div>

      <RegisterForm />
    </div>
  )
}
