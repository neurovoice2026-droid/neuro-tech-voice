'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/shared/Logo'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
})

type Values = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  function onSubmit(values: Values) {
    startTransition(async () => {
      const supabase = createClient()
      await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      // Always show success regardless of whether email exists (security)
      setSubmittedEmail(values.email)
      setSent(true)
    })
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex justify-center mb-6">
          <Logo size="sm" showText />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Reset your password
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      {sent ? (
        /* ── Success state ── */
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4 rounded-xl border border-green-200 bg-green-50 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Check your inbox</p>
              <p className="text-sm text-muted-foreground">
                We sent a reset link to{' '}
                <span className="font-medium text-foreground">{submittedEmail}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Didn&apos;t receive it? Check your spam folder.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => { setSent(false); form.reset() }}
          >
            Try a different email
          </Button>
        </div>
      ) : (
        /* ── Form state ── */
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">
              Email address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                disabled={isPending}
                {...form.register('email')}
                className={cn(
                  'h-11 pl-9',
                  form.formState.errors.email &&
                    'border-destructive focus-visible:ring-destructive/30'
                )}
              />
            </div>
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">
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
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
