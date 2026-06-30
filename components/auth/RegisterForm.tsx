'use client'

import { useState, useTransition } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { signUpWithEmail, signInWithGoogle } from '@/lib/auth/actions'
import { cn } from '@/lib/utils'

// ─── Schema ───────────────────────────────────────────────────────────────────
const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
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

// ─── Password strength helpers ────────────────────────────────────────────────
function getPasswordStrength(password: string): number {
  if (!password) return 0
  const has8 = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  if (has8 && hasUpper && hasNumber && hasSpecial) return 4
  if (has8 && hasUpper && hasNumber) return 3
  if (has8 && (hasUpper || hasNumber)) return 2
  if (has8 || hasUpper || hasNumber) return 1
  return 0
}

const STRENGTH_META = [
  { label: '',       bar: '' },
  { label: 'Weak',   bar: 'bg-red-500' },
  { label: 'Fair',   bar: 'bg-orange-500' },
  { label: 'Good',   bar: 'bg-yellow-500' },
  { label: 'Strong', bar: 'bg-green-500' },
]

const STRENGTH_TEXT = [
  '',
  'text-red-600',
  'text-orange-600',
  'text-yellow-600',
  'text-green-600',
]

// ─── Component ────────────────────────────────────────────────────────────────
export function RegisterForm() {
  const [isPending, startTransition] = useTransition()
  const [isGooglePending, startGoogleTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
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

  const passwordVal = form.watch('password')
  const confirmVal = form.watch('confirmPassword')
  const strength = getPasswordStrength(passwordVal)
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
      {/* Google */}
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
        Sign up with Google
      </Button>

      {/* Divider */}
      <div className="relative flex items-center">
        <div className="flex-1 border-t border-border" />
        <span className="mx-3 text-xs uppercase tracking-wider text-muted-foreground">
          or continue with email
        </span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive" className="py-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Full name */}
        <div className="space-y-1.5">
          <Label htmlFor="fullName" className="text-sm font-medium">
            Full name
          </Label>
          <Input
            id="fullName"
            type="text"
            placeholder="John Smith"
            autoComplete="name"
            disabled={isPending}
            {...form.register('fullName')}
            className={cn(
              'h-11',
              form.formState.errors.fullName &&
                'border-destructive focus-visible:ring-destructive/30'
            )}
          />
          {form.formState.errors.fullName && (
            <p className="text-xs text-destructive">
              {form.formState.errors.fullName.message}
            </p>
          )}
        </div>

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
            {...form.register('email')}
            className={cn(
              'h-11',
              form.formState.errors.email &&
                'border-destructive focus-visible:ring-destructive/30'
            )}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        {/* Password + strength */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              disabled={isPending}
              {...form.register('password')}
              className={cn(
                'h-11 pr-10',
                form.formState.errors.password &&
                  'border-destructive focus-visible:ring-destructive/30'
              )}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Strength bars */}
          {passwordVal && (
            <div className="space-y-1 pt-0.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-all duration-300',
                      i <= strength ? STRENGTH_META[strength].bar : 'bg-gray-200'
                    )}
                  />
                ))}
              </div>
              {strength > 0 && (
                <p className={cn('text-xs font-medium', STRENGTH_TEXT[strength])}>
                  {STRENGTH_META[strength].label}
                </p>
              )}
            </div>
          )}

          {form.formState.errors.password && (
            <p className="text-xs text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm password
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              disabled={isPending}
              {...form.register('confirmPassword')}
              className={cn(
                'h-11 pr-16',
                form.formState.errors.confirmPassword &&
                  'border-destructive focus-visible:ring-destructive/30',
                passwordsMatch && 'border-green-500 focus-visible:ring-green-500/30'
              )}
            />
            {/* Match checkmark */}
            {passwordsMatch && (
              <CheckCircle2 className="absolute right-10 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
            )}
            {/* Show/hide toggle */}
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {form.formState.errors.confirmPassword && (
            <p className="text-xs text-destructive">
              {form.formState.errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Terms checkbox */}
        <div className="space-y-1">
          <Controller
            control={form.control}
            name="terms"
            render={({ field }) => (
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="terms"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isPending}
                  className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <label
                  htmlFor="terms"
                  className="cursor-pointer text-sm leading-relaxed text-muted-foreground"
                >
                  I agree to the{' '}
                  <Link
                    href="/terms"
                    className="text-primary transition-colors hover:text-primary/80"
                    target="_blank"
                  >
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link
                    href="/privacy"
                    className="text-primary transition-colors hover:text-primary/80"
                    target="_blank"
                  >
                    Privacy Policy
                  </Link>
                </label>
              </div>
            )}
          />
          {form.formState.errors.terms && (
            <p className="text-xs text-destructive pl-6">
              {form.formState.errors.terms.message}
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
              Creating account&hellip;
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-primary transition-colors hover:text-primary/80"
        >
          Sign in
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
