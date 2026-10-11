'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/shared/FormSection'
import { signUpWithEmail, signInWithGoogle } from '@/lib/auth/actions'
import { emailSchema, fullNameSchema, newPasswordSchema, type AuthFormField } from '@/lib/auth/password-policy'
import { PasswordStrengthMeter, PasswordToggle } from './password-fields'

// ─── Schema ───────────────────────────────────────────────────────────────────
const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
    terms: z
      .boolean()
      .refine((v) => v === true, 'You must accept the terms to continue'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

type RegisterValues = z.infer<typeof registerSchema>

const inkLink =
  'rounded-sm font-medium text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

// ─── Component ────────────────────────────────────────────────────────────────
export function RegisterForm() {
  const [isPending, startTransition] = useTransition()
  const [isGooglePending, startGoogleTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // A field the server refused: focused once the inputs are enabled again
  // (focus() on a disabled input does nothing, and they stay disabled until
  // the transition ends).
  const focusAfterPending = useRef<AuthFormField | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      terms: false,
    },
  })
  const { errors } = form.formState
  // One auth flow at a time: the email form waits while Google hands off.
  const fieldsDisabled = isPending || isGooglePending
  const { setFocus } = form
  useEffect(() => {
    if (fieldsDisabled || !focusAfterPending.current) return
    setFocus(focusAfterPending.current)
    focusAfterPending.current = null
  }, [fieldsDisabled, setFocus])

  const passwordVal = form.watch('password')
  const confirmVal = form.watch('confirmPassword')
  const passwordsMatch =
    passwordVal.length > 0 && confirmVal.length > 0 && passwordVal === confirmVal

  function onSubmit(values: RegisterValues) {
    setError(null)
    startTransition(async () => {
      const result = await signUpWithEmail(
        values.fullName,
        values.email,
        values.password
      )
      // A field problem (e.g. a password found in a data breach) shows under that field; anything else above the form.
      if (result?.field) {
        form.setError(result.field, { type: result.reason ?? 'server', message: result.error })
        focusAfterPending.current = result.field
      } else if (result?.error) setError(result.error)
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
      {/* Google */}
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
        Sign up with Google
      </Button>

      <OrDivider />

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message}>
          <Input
            id="fullName"
            type="text"
            placeholder="John Smith"
            autoComplete="name"
            disabled={fieldsDisabled}
            {...form.register('fullName')}
            className="h-11"
          />
        </Field>

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

        {/* Password + strength */}
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          {/* Fragments, not the bare wrappers: Field wires aria-* onto a direct
              element child, which would be a <div>; the Inputs have their own. */}
          <>
            <div className="space-y-2">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  disabled={fieldsDisabled}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...form.register('password')}
                  className="h-11 pr-12"
                />
                <PasswordToggle
                  controls="password"
                  shown={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                />
              </div>

              <PasswordStrengthMeter password={passwordVal} rejected={errors.password?.type === 'pwned' || errors.password?.type === 'weak'} />
            </div>
          </>
        </Field>

        {/* Confirm password */}
        <Field
          label="Confirm password"
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
        >
          <>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                disabled={fieldsDisabled}
                aria-invalid={errors.confirmPassword ? true : undefined}
                aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                {...form.register('confirmPassword')}
                className="h-11 pr-20"
              />
              {/* Match check */}
              {passwordsMatch && (
                <span className="pointer-events-none absolute top-1/2 right-11 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-success-soft">
                  <Check className="size-3 text-success" strokeWidth={3} />
                </span>
              )}
              <PasswordToggle
                controls="confirmPassword"
                shown={showConfirm}
                onToggle={() => setShowConfirm((v) => !v)}
              />
            </div>
          </>
        </Field>

        {/* Terms checkbox */}
        <div className="space-y-2 pt-1">
          <Controller
            control={form.control}
            name="terms"
            render={({ field }) => (
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="terms"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={fieldsDisabled}
                  aria-invalid={errors.terms ? true : undefined}
                  aria-describedby={errors.terms ? 'terms-error' : undefined}
                  className="mt-px"
                />
                <label
                  htmlFor="terms"
                  className="cursor-pointer text-[13px] leading-[19px] text-muted-foreground"
                >
                  I agree to the{' '}
                  <Link href="/terms" className={inkLink} target="_blank">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className={inkLink} target="_blank">
                    Privacy Policy
                  </Link>
                </label>
              </div>
            )}
          />
          {errors.terms && (
            <p
              id="terms-error"
              role="alert"
              className="flex items-start gap-1.5 pl-7 text-xs leading-4 text-destructive"
            >
              <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>{errors.terms.message}</span>
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={isPending}
          loadingText="Creating account…"
          disabled={isGooglePending}
        >
          Create account
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
