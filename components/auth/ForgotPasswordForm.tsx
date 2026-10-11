'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, ArrowLeft, MailCheck, Clock, AlertCircle } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { Field } from '@/components/shared/FormSection'
import { emailSchema } from '@/lib/auth/password-policy'
import { requestPasswordReset } from '@/lib/auth/actions'

const schema = z.object({
  email: emailSchema,
})

type Values = z.infer<typeof schema>

/**
 * Why the user was sent back here from a reset link. Each has its own static
 * page (/forgot-password/expired, /forgot-password/unusable), so the notice is
 * in the first HTML and the form does not move when it appears.
 */
export type ResetLinkNotice = 'expired' | 'unusable'

const NOTICE_COPY: Record<ResetLinkNotice, { title: string; body: string }> = {
  expired: {
    title: 'That reset link has expired',
    body: 'Reset links work once and for a limited time. Enter your email to get a new one.',
  },
  unusable: {
    title: "We couldn't use that reset link here",
    body: 'A reset link only works once, in the browser it was requested from. Request a new link here and open it in this browser.',
  },
}

export function ForgotPasswordForm({ notice }: { notice?: ResetLinkNotice }) {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  // Once a new link has been requested, the notice about the old one is stale.
  const [linkRequested, setLinkRequested] = useState(false)

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
    setSendError(null)
    startTransition(async () => {
      // The server sends the email (or falls back to the auth server's own); the answer is the
      // same whether or not the address has an account.
      let result: Awaited<ReturnType<typeof requestPasswordReset>>
      try {
        result = await requestPasswordReset(values.email)
      } catch (err) {
        // The request itself failed (offline, server error, a deploy in between): keep the form.
        console.error('[forgot-password] reset request failed', err instanceof Error ? err.name : err)
        setSendError("We couldn't send the reset link. Please check your connection and try again.")
        return
      }
      setLinkRequested(true)
      if (result?.error) {
        setSendError(result.error)
        return
      }
      setSubmittedEmail(values.email)
      setSent(true)
    })
  }

  const noticeCopy = notice && !linkRequested ? NOTICE_COPY[notice] : null

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
          {noticeCopy && (
            <Alert role="status" variant="warning">
              <Clock aria-hidden="true" />
              <AlertTitle>{noticeCopy.title}</AlertTitle>
              <AlertDescription>{noticeCopy.body}</AlertDescription>
            </Alert>
          )}
          {sendError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription className="text-destructive">{sendError}</AlertDescription>
            </Alert>
          )}
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
