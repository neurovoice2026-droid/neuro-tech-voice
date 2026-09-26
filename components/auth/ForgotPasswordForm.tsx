'use client'

import { Suspense, useState, useTransition } from 'react'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Mail, Loader2, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AuthNotice } from '@/components/auth/AuthNotice'
import { requestPasswordReset } from '@/lib/auth/actions'
import { AUTH_MESSAGES } from '@/lib/auth/errors'
import { formResolver, passwordResetRequestSchema, type PasswordResetRequestInput } from '@/lib/auth/schemas'
import { cn } from '@/lib/utils'

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [sentMessage, setSentMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<PasswordResetRequestInput>({
    resolver: formResolver(passwordResetRequestSchema),
    defaultValues: { email: '' },
  })

  function onSubmit(values: PasswordResetRequestInput) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await requestPasswordReset(values)
        // The same answer whether or not the email has an account.
        if ('error' in result) setError(result.error)
        else setSentMessage(result.message)
      } catch (err) {
        unstable_rethrow(err)
        setError(AUTH_MESSAGES.connectionFailed)
      }
    })
  }

  return (
    <div className="space-y-6">
      {sentMessage ? (
        /* ── Success state ── */
        <div className="space-y-6" aria-live="polite">
          <div className="flex flex-col items-center gap-4 rounded-xl border border-green-200 bg-green-50 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-7 w-7 text-green-600" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Check your inbox</p>
              <p className="text-sm text-muted-foreground">{sentMessage}</p>
              <p className="text-xs text-muted-foreground">
                Didn&apos;t receive it? Check your spam folder, and open the link in this browser.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="h-11 w-full"
            onClick={() => {
              setSentMessage(null)
              form.reset()
            }}
          >
            Try a different email
          </Button>
        </div>
      ) : (
        /* ── Form state ── */
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
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

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">
              Email address
            </Label>
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
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
                  'h-11 pl-9',
                  form.formState.errors.email &&
                    'border-destructive focus-visible:ring-destructive/30'
                )}
              />
            </div>
            {form.formState.errors.email && (
              <p id="email-error" className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <Button type="submit" className="h-11 w-full purple-glow" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending reset link&hellip;
              </>
            ) : (
              'Send reset link'
            )}
          </Button>
        </form>
      )}

      <div className="flex justify-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
