'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updatePassword } from '@/lib/auth/actions'
import { AUTH_MESSAGES } from '@/lib/auth/errors'
import { formResolver, newPasswordFormSchema, type NewPasswordInput } from '@/lib/auth/schemas'
import { cn } from '@/lib/utils'

export function ResetPasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<NewPasswordInput>({
    resolver: formResolver(newPasswordFormSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  function onSubmit(values: NewPasswordInput) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await updatePassword(values)
        if ('error' in result) setError(result.error)
        else setDone(true)
      } catch (err) {
        unstable_rethrow(err)
        setError(AUTH_MESSAGES.connectionFailed)
      }
    })
  }

  if (done) {
    return (
      <div className="space-y-6" aria-live="polite">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-7 w-7 text-green-600" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{AUTH_MESSAGES.passwordUpdated}</p>
            <p className="text-sm text-muted-foreground">
              You&apos;re signed in on this device. Any other devices were signed out for your security.
            </p>
          </div>
        </div>
        <Link href="/dashboard" className={cn(buttonVariants(), 'h-11 w-full purple-glow')}>
          Continue to your dashboard
        </Link>
      </div>
    )
  }

  const expired = error === AUTH_MESSAGES.resetLinkExpired || error === AUTH_MESSAGES.reauthenticationNeeded

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      {error && (
        <Alert variant="destructive" className="py-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            {expired && (
              <>
                {' '}
                <Link href="/forgot-password" className="font-medium underline underline-offset-2">
                  Request a new link
                </Link>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-sm font-medium">
          New password
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            disabled={isPending}
            aria-invalid={!!form.formState.errors.password}
            aria-describedby={form.formState.errors.password ? 'password-error' : 'password-hint'}
            {...form.register('password')}
            className={cn(
              'h-11 pr-10',
              form.formState.errors.password && 'border-destructive focus-visible:ring-destructive/30'
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {form.formState.errors.password ? (
          <p id="password-error" className="text-xs text-destructive">
            {form.formState.errors.password.message}
          </p>
        ) : (
          <p id="password-hint" className="text-xs text-muted-foreground">
            At least 8 characters, with an uppercase letter and a number.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirm new password
        </Label>
        <Input
          id="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          disabled={isPending}
          aria-invalid={!!form.formState.errors.confirmPassword}
          aria-describedby={form.formState.errors.confirmPassword ? 'confirmPassword-error' : undefined}
          {...form.register('confirmPassword')}
          className={cn(
            'h-11',
            form.formState.errors.confirmPassword && 'border-destructive focus-visible:ring-destructive/30'
          )}
        />
        {form.formState.errors.confirmPassword && (
          <p id="confirmPassword-error" className="text-xs text-destructive">
            {form.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button type="submit" className="h-11 w-full purple-glow" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving new password&hellip;
          </>
        ) : (
          'Save new password'
        )}
      </Button>
    </form>
  )
}
