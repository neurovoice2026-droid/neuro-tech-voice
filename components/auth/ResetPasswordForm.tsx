'use client'

import { useState, useTransition } from 'react'
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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })
  const { errors } = form.formState
  const passwordVal = form.watch('password')

  function onSubmit(values: ResetValues) {
    setError(null)
    startTransition(async () => {
      const result = await updatePassword(values.password)
      // A password problem (e.g. found in a data breach) shows under the field; anything else above the form.
      if (result?.field) form.setError(result.field, { type: 'server', message: result.error }, { shouldFocus: true })
      else if (result?.error) setError(result.error)
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
              <PasswordStrengthMeter password={passwordVal} />
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
