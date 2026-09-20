'use client'

import { Suspense, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AuthNotice } from '@/components/auth/AuthNotice'
import { signInWithEmail, signInWithGoogle } from '@/lib/auth/actions'
import { AUTH_MESSAGES } from '@/lib/auth/errors'
import { formResolver, signInSchema, type SignInInput } from '@/lib/auth/schemas'
import { cn } from '@/lib/utils'

// ─── Component ────────────────────────────────────────────────────────────────
export function LoginForm() {
  const [isPending, startTransition] = useTransition()
  const [isGooglePending, startGoogleTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<SignInInput>({
    resolver: formResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  function onSubmit(values: SignInInput) {
    setError(null)
    // Where the proxy sent us from, e.g. /login?next=/calls. The server
    // action only follows same-site paths.
    const next = new URLSearchParams(window.location.search).get('next')
    startTransition(async () => {
      try {
        const result = await signInWithEmail({ ...values, next })
        if (result && 'error' in result) setError(result.error)
      } catch (err) {
        // A successful sign-in ends in a redirect, which Next delivers as a
        // rejection it must handle itself. Anything else never reached us.
        unstable_rethrow(err)
        setError(AUTH_MESSAGES.connectionFailed)
      }
    })
  }

  function handleGoogle() {
    setError(null)
    startGoogleTransition(async () => {
      try {
        const result = await signInWithGoogle()
        if (result && 'error' in result) setError(result.error)
      } catch (err) {
        unstable_rethrow(err)
        setError(AUTH_MESSAGES.connectionFailed)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Google sign-in */}
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full border-border transition-all duration-150 hover:border-primary hover:bg-purple-50"
        onClick={handleGoogle}
        disabled={isGooglePending || isPending}
      >
        {isGooglePending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        Continue with Google
      </Button>

      {/* Divider */}
      <div className="relative flex items-center">
        <div className="flex-1 border-t border-border" />
        <span className="mx-3 text-xs uppercase tracking-wider text-muted-foreground">
          or continue with email
        </span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Server error, or the one the OAuth callback redirected back with */}
      {error ? (
        <Alert variant="destructive" className="py-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <Suspense fallback={null}>
          <AuthNotice />
        </Suspense>
      )}

      {/* Form */}
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            disabled={isPending}
            aria-invalid={!!form.formState.errors.email}
            aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
            {...form.register('email')}
            className={cn(
              'h-11',
              form.formState.errors.email &&
                'border-destructive focus-visible:ring-destructive/30'
            )}
          />
          {form.formState.errors.email && (
            <p id="email-error" className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary transition-colors hover:text-primary/80"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              disabled={isPending}
              aria-invalid={!!form.formState.errors.password}
              aria-describedby={form.formState.errors.password ? 'password-error' : undefined}
              {...form.register('password')}
              className={cn(
                'h-11 pr-10',
                form.formState.errors.password &&
                  'border-destructive focus-visible:ring-destructive/30'
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {form.formState.errors.password && (
            <p id="password-error" className="text-xs text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="h-11 w-full purple-glow"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in&hellip;
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-medium text-primary transition-colors hover:text-primary/80"
        >
          Sign up
        </Link>
      </p>
    </div>
  )
}

// ─── Google SVG icon ──────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg
      className="mr-2 flex-shrink-0"
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
