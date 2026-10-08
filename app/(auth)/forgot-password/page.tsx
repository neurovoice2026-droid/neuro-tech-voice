'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, ArrowLeft, MailCheck } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { Field } from '@/components/shared/FormSection'
import { createClient } from '@/lib/supabase/client'

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
  const emailError = form.formState.errors.email?.message

  // Focus follows the view swap, so keyboard and screen-reader users are not
  // dropped to <body> when the focused button unmounts: the success message is
  // focused (and so read out) when it appears, and "Try a different email"
  // returns to the email field.
  const successRef = useRef<HTMLDivElement>(null)
  const refocusEmail = useRef(false)
  const { setFocus } = form
  useEffect(() => {
    if (sent) {
      successRef.current?.focus()
    } else if (refocusEmail.current) {
      refocusEmail.current = false
      setFocus('email')
    }
  }, [sent, setFocus])

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
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow>Reset password</Eyebrow>
        <h1 className="mt-4 font-heading font-title text-[30px] leading-[36px] tracking-[-0.025em] text-balance text-foreground md:text-[36px] md:leading-[42px]">
          Reset your password
        </h1>
        <p className="mt-2 text-[15px] leading-[22px] text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      {sent ? (
        /* ── Success state ── */
        <div className="space-y-6">
          <Alert ref={successRef} tabIndex={-1} role="status" variant="success" className="outline-none">
            <MailCheck aria-hidden="true" />
            <AlertTitle>Check your inbox</AlertTitle>
            <AlertDescription>
              <p>
                We sent a reset link to{' '}
                <span className="font-medium text-foreground [overflow-wrap:anywhere]">{submittedEmail}</span>
              </p>
              <p>Didn&apos;t receive it? Check your spam folder.</p>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Link
              href="/login"
              className={buttonVariants({ variant: 'outline', size: 'lg', className: 'w-full' })}
            >
              <ArrowLeft />
              Back to sign in
            </Link>
            <Button
              variant="ghost"
              size="lg"
              className="w-full"
              onClick={() => {
                refocusEmail.current = true
                setSent(false)
                form.reset()
              }}
            >
              Try a different email
            </Button>
          </div>
        </div>
      ) : (
        /* ── Form state ── */
        <div className="space-y-6">
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
            <Field label="Email address" htmlFor="email" error={emailError}>
              {/* Fragment, not the bare wrapper: Field wires aria-* onto a direct
                  element child, which would be the <div>; the Input has its own. */}
              <>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    disabled={isPending}
                    aria-invalid={emailError ? true : undefined}
                    aria-describedby={emailError ? 'email-error' : undefined}
                    {...form.register('email')}
                    className="h-11 pl-10"
                  />
                </div>
              </>
            </Field>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={isPending}
              loadingText="Sending reset link…"
            >
              Send reset link
            </Button>
          </form>

          <div className="flex justify-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-sm text-[13px] leading-[19px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ArrowLeft aria-hidden="true" className="size-3.5" />
              Back to sign in
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
