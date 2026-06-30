import type { Metadata } from 'next'
import { Logo } from '@/components/shared/Logo'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Sign in — Neuro Tech Voice',
}

export default function LoginPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex justify-center mb-6">
          <Logo size="sm" showText />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your account to continue
        </p>
      </div>

      {/* Form */}
      <LoginForm />
    </div>
  )
}
