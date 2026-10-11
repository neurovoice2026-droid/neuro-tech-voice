'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Field } from '@/components/shared/FormSection'
import { updatePassword } from '@/lib/auth/actions'
import { newPasswordSchema } from '@/lib/auth/password-policy'
import { PasswordStrengthMeter, PasswordToggle } from './password-fields'

const resetSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

type ResetValues = z.infer<typeof resetSchema>

/** Sets the new password on the session the reset link opened (see /auth/callback). */
export function ResetPasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // A field the server refused: focused once the inputs are enabled again
  // (focus() on a disabled input does nothing).
  const focusAfterPending = useRef<'password' | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })
  const { errors } = form.formState
  const passwordVal = form.watch('password')
  const { setFocus } = form
  useEffect(() => {
    if (isPending || !focusAfterPending.current) return
    setFocus('password')
    focusAfterPending.current = null
  }, [isPending, setFocus])

  function onSubmit(values: ResetValues) {
    setError(null)
    startTransition(async () => {
      const result = await updatePassword(values.password)
      // A field problem (e.g. a password found in a data breach) shows under that field; anything else above the form.
      if (result?.field === 'password') {
        form.setError('password', { type: result.reason ?? 'server', message: result.error })
        focusAfterPending.current = 'password'
      } else if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label="New password" htmlFor="password" error={errors.password?.message}>
          {/* Fragments, not the bare wrappers: Field wires aria-* onto a direct
              element child, which would be a <div>; the Inputs have their own. */}
          <>
            <div className="space-y-2">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  disabled={isPending}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...form.register('password')}
                  className="h-11 pr-12"
                />
                <PasswordToggle controls="password" shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
              </div>
              <PasswordStrengthMeter password={passwordVal} rejected={errors.password?.type === 'pwned' || errors.password?.type === 'weak'} />
            </div>
          </>
        </Field>

        <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                disabled={isPending}
                aria-invalid={errors.confirmPassword ? true : undefined}
                aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                {...form.register('confirmPassword')}
                className="h-11 pr-12"
              />
              <PasswordToggle controls="confirmPassword" shown={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
            </div>
          </>
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={isPending} loadingText="Updating password…">
          Update password
        </Button>
      </form>
    </div>
  )
}
