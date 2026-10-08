'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Field } from '@/components/shared/FormSection'
import { signInWithEmail, signInWithGoogle } from '@/lib/auth/actions'

// ─── Schema ───────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

// ─── Component ────────────────────────────────────────────────────────────────
export function LoginForm() {
  const [isPending, startTransition] = useTransition()
  const [isGooglePending, startGoogleTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const { errors } = form.formState
  // One auth flow at a time: the email form waits while Google hands off.
  const fieldsDisabled = isPending || isGooglePending

  function onSubmit(values: LoginValues) {
    setError(null)
    startTransition(async () => {
      const result = await signInWithEmail(values.email, values.password)
      if (result?.error) setError(result.error)
    })
  }

  function handleGoogle() {
    setError(null)
    startGoogleTransition(async () => {
      const result = await signInWithGoogle()
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="space-y-6">
      {/* Google sign-in */}
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={handleGoogle}
        loading={isGooglePending}
        loadingText="Connecting to Google…"
        disabled={isPending}
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      <OrDivider />

      {/* Server error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label="Email address" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            disabled={fieldsDisabled}
            {...form.register('email')}
            className="h-11"
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          labelAction={
            <Link
              href="/forgot-password"
              className="rounded-sm text-[13px] leading-4 font-medium text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Forgot password?
            </Link>
          }
        >
          {/* Fragment, not the bare wrapper: Field wires aria-* onto a direct
              element child, which would be the <div>; the Input has its own. */}
          <>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={fieldsDisabled}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...form.register('password')}
                className="h-11 pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowPassword((v) => !v)}
                className="tap-44 absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-controls="password"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </>
        </Field>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={isPending}
          loadingText="Signing in…"
          disabled={isGooglePending}
        >
          Sign in
        </Button>
      </form>
    </div>
  )
}

// ─── "or" divider ─────────────────────────────────────────────────────────────
function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="h-px flex-1 bg-rule" />
      <span className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">
        or
      </span>
      <span aria-hidden className="h-px flex-1 bg-rule" />
    </div>
  )
}

// ─── Google SVG icon (third-party mark, kept in Google's colours) ─────────────
function GoogleIcon() {
  return (
    <svg
      className="size-[18px] shrink-0"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  )
}
