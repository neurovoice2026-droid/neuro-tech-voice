import type { Metadata } from 'next'
import { Logo } from '@/components/shared/Logo'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata: Metadata = {
  title: 'Create account — Neuro Tech Voice',
}

export default function RegisterPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex justify-center mb-6">
          <Logo size="sm" showText />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          Start your free 14-day trial — no credit card required
        </p>
      </div>

      {/* Form */}
      <RegisterForm />
    </div>
  )
}
