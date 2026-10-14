'use client'

// Step 1 — About your store: the store profile. Saved through
// POST /api/commerce/onboarding/store (which also moves the resume position to 2).

import { useState } from 'react'
import { useForm, useController } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/shared/FormSection'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { useCommerceOnboardingStore } from '@/store/useCommerceOnboardingStore'
import { StepActions, StepBody } from '../../StepIndicator'
import { commerceErrorMessage, requestJson } from '../api'
import { COUNTRIES, CURRENCIES, TIMEZONES } from '../copy'
import { FormSelect } from '../fields'
import { useCommerceNavigation } from '../navigation'
import { CommerceStepHeader } from '../shared'

const SAVE_FAILED = 'Your store details could not be saved.'

// "your-store.com" and "www.your-store.com" are accepted like full URLs (as in Step1Company); the
// value is normalized once it is known to be valid.
function normalizeUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function isValidWebsite(value: string): boolean {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && !/^https?:\/\//i.test(value)) return false
  try {
    new URL(normalizeUrl(value))
    return true
  } catch {
    return false
  }
}

const schema = z.object({
  display_name: z.string().trim().min(2, 'Use at least 2 characters').max(100, 'Use at most 100 characters'),
  website: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || isValidWebsite(v), { message: 'Enter a valid address (e.g. www.your-store.com)' }),
  country: z.string().min(1, 'Choose a country'),
  timezone: z.string().min(1, 'Choose a time zone'),
  language: z.string().min(1, 'Choose the agent language'),
  currency: z.string().min(1, 'Choose a currency'),
})

type FormValues = z.infer<typeof schema>

const LANGUAGE_OPTIONS = AGENT_LANGUAGES.map((l) => ({
  value: l.value,
  label: l.label,
  icon: <FlagIcon country={l.country} className="h-3 w-[18px]" />,
}))

export function StoreStep() {
  const profile = useCommerceOnboardingStore((s) => s.profile)
  const setProfile = useCommerceOnboardingStore((s) => s.setProfile)
  const { goTo } = useCommerceNavigation()
  const [saving, setSaving] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: profile.display_name,
      website: profile.website,
      country: profile.country,
      timezone: profile.timezone,
      language: profile.language,
      currency: profile.currency,
    },
  })

  // Registered in page order, so a failed submit focuses the top-most invalid field.
  const nameField = form.register('display_name')
  const websiteField = form.register('website')
  const { field: country } = useController({ control: form.control, name: 'country' })
  const { field: timezone } = useController({ control: form.control, name: 'timezone' })
  const { field: language } = useController({ control: form.control, name: 'language' })
  const { field: currency } = useController({ control: form.control, name: 'currency' })
  const { errors } = form.formState

  async function onSubmit(values: FormValues) {
    if (saving) return
    setSaving(true)
    const website = values.website ? normalizeUrl(values.website) : ''
    try {
      await requestJson<{ ok: true }>('/api/commerce/onboarding/store', {
        method: 'POST',
        body: { ...values, website },
        fallback: SAVE_FAILED,
      })
      setProfile({ ...values, website })
      // The route stored the position (step 2) together with the profile.
      goTo(2, { persist: false })
    } catch (err) {
      toast.error(commerceErrorMessage(err, SAVE_FAILED))
    } finally {
      setSaving(false)
    }
  }

  const describedBy = (id: string, hasError: boolean) => (hasError ? `${id}-error` : undefined)

  return (
    <div>
      <CommerceStepHeader
        step={1}
        title="Tell us about your store"
        description="The name, country and currency appear in the agent's calls and in the synced orders."
      />

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <StepBody className="space-y-8">
          <Field label="Store name" htmlFor="display_name" error={errors.display_name?.message}>
            <Input id="display_name" placeholder="Example Store" autoComplete="organization" {...nameField} className="h-11" />
          </Field>

          <Field label="Store website" htmlFor="website" optional error={errors.website?.message}>
            <div className="relative">
              <Globe className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="website"
                type="text"
                inputMode="url"
                autoComplete="url"
                placeholder="www.your-store.com"
                aria-invalid={errors.website ? true : undefined}
                aria-describedby={describedBy('website', !!errors.website)}
                {...websiteField}
                className="h-11 pl-10"
              />
            </div>
          </Field>

          <div className="grid gap-8 sm:grid-cols-2">
            <Field label="Country" htmlFor="country" error={errors.country?.message}>
              <FormSelect
                id="country"
                value={country.value}
                onChange={country.onChange}
                options={COUNTRIES}
                placeholder="Choose a country"
                invalid={!!errors.country}
                describedBy={describedBy('country', !!errors.country)}
                triggerRef={country.ref}
              />
            </Field>
            <Field label="Time zone" htmlFor="timezone" error={errors.timezone?.message} hint="Sets the hours in which calls are made.">
              <FormSelect
                id="timezone"
                value={timezone.value}
                onChange={timezone.onChange}
                options={TIMEZONES}
                placeholder="Choose a time zone"
                invalid={!!errors.timezone}
                describedBy={errors.timezone ? 'timezone-error timezone-hint' : 'timezone-hint'}
                triggerRef={timezone.ref}
              />
            </Field>
            <Field label="Agent language" htmlFor="language" error={errors.language?.message}>
              <FormSelect
                id="language"
                value={language.value}
                onChange={language.onChange}
                options={LANGUAGE_OPTIONS}
                placeholder="Choose a language"
                invalid={!!errors.language}
                describedBy={describedBy('language', !!errors.language)}
                triggerRef={language.ref}
              />
            </Field>
            <Field label="Currency" htmlFor="currency" error={errors.currency?.message}>
              <FormSelect
                id="currency"
                value={currency.value}
                onChange={currency.onChange}
                options={CURRENCIES}
                placeholder="Choose a currency"
                invalid={!!errors.currency}
                describedBy={describedBy('currency', !!errors.currency)}
                triggerRef={currency.ref}
              />
            </Field>
          </div>
        </StepBody>

        <StepActions>
          <Button type="submit" size="lg" loading={saving} loadingText="Saving…" className="ml-auto max-md:flex-1">
            Continue
            <ArrowRight aria-hidden="true" />
          </Button>
        </StepActions>
      </form>
    </div>
  )
}
