'use client'

import { useForm, useController } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Globe, ArrowRight,
  Cpu, Heart, Home, TrendingUp, ShoppingBag,
  Plane, GraduationCap, Scale, Car, Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/shared/FormSection'
import { OptionCard } from '@/components/shared/OptionCard'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { cn } from '@/lib/utils'
import { StepActions, StepBody, StepHeader } from '../StepIndicator'

// Accepts "www.site.com" or "site.com" as well as fully-qualified URLs by
// checking validity against the https://-prefixed form, without changing the
// field's input/output type (a z.preprocess here breaks zodResolver's type
// inference for an optional field). The actual normalization happens in
// onSubmit, once the value is known to be valid.
function normalizeUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function isValidWebsite(value: string): boolean {
  try {
    new URL(normalizeUrl(value))
    return true
  } catch {
    return false
  }
}

const schema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  industry: z.string().min(1, 'Please select an industry'),
  website: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || isValidWebsite(val), {
      message: 'Please enter a valid URL (e.g. www.yoursite.com)',
    }),
  description: z
    .string()
    .min(20, 'Please add at least 20 characters')
    .max(500, 'Maximum 500 characters'),
})

type FormValues = z.infer<typeof schema>

// Ink icons on neutral tiles: no per-industry colours (the selection is the ink ring).
const INDUSTRIES = [
  { value: 'technology',  label: 'Technology',  icon: Cpu },
  { value: 'healthcare',  label: 'Healthcare',  icon: Heart },
  { value: 'real_estate', label: 'Real Estate', icon: Home },
  { value: 'finance',     label: 'Finance',     icon: TrendingUp },
  { value: 'retail',      label: 'Retail',      icon: ShoppingBag },
  { value: 'hospitality', label: 'Hospitality', icon: Plane },
  { value: 'education',   label: 'Education',   icon: GraduationCap },
  { value: 'legal',       label: 'Legal',       icon: Scale },
  { value: 'automotive',  label: 'Automotive',  icon: Car },
  { value: 'other',       label: 'Other',       icon: Plus },
]

const DESCRIPTION_MAX = 500

export function Step1Company() {
  const { company, setCompany, setStep } = useOnboardingStore()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:        company.name,
      industry:    company.industry,
      website:     company.website,
      description: company.description,
    },
  })

  // Registered in page order (name, industry, then the fields below them): a failed submit
  // focuses the first invalid field in registration order, so this keeps it the top-most one.
  const nameField = form.register('name')
  const { field: industry } = useController({ control: form.control, name: 'industry' })

  const description = form.watch('description') ?? ''
  const { errors } = form.formState

  function onSubmit(values: FormValues) {
    setCompany({
      ...values,
      website: values.website ? normalizeUrl(values.website) : values.website,
    })
    setStep(2)
  }

  return (
    <div>
      <StepHeader
        step={1}
        title="Tell us about your company"
        description="This helps us personalize your AI agent"
      />

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <StepBody className="space-y-8">
          {/* Company name */}
          <Field label="Company name" htmlFor="name" error={errors.name?.message}>
            <Input
              id="name"
              placeholder="Acme Corporation"
              autoComplete="organization"
              {...nameField}
              className="h-11"
            />
          </Field>

          {/* Industry. With htmlFor, Field ids the error (industry-error) and wires the group's
              aria-describedby / aria-invalid (it is Field's single native child). */}
          <Field
            label={<span id="industry-label">Industry</span>}
            htmlFor="industry"
            error={errors.industry?.message}
          >
            <div
              id="industry"
              // A failed submit focuses the group's tab stop (the checked or first card).
              ref={(el) => {
                if (el) industry.ref({ focus: () => el.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus() })
              }}
              role="radiogroup"
              aria-labelledby="industry-label"
              className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
            >
              {INDUSTRIES.map((ind) => (
                <OptionCard
                  key={ind.value}
                  selected={industry.value === ind.value}
                  onSelect={() => industry.onChange(ind.value)}
                  icon={ind.icon}
                  // nowrap: the label may use the corner dot's gutter (the dot sits at the top).
                  title={<span className="whitespace-nowrap">{ind.label}</span>}
                  className="min-h-[88px] justify-between gap-3"
                />
              ))}
            </div>
          </Field>

          {/* Website */}
          <Field label="Website" htmlFor="website" optional error={errors.website?.message}>
            <div className="relative">
              <Globe
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="website"
                type="text"
                inputMode="url"
                autoComplete="url"
                placeholder="www.yourcompany.com"
                aria-invalid={errors.website ? true : undefined}
                aria-describedby={errors.website ? 'website-error' : undefined}
                {...form.register('website')}
                className="h-11 pl-10"
              />
            </div>
          </Field>

          {/* Description */}
          <Field
            label="What does your company do?"
            htmlFor="description"
            error={errors.description?.message}
            labelAction={
              <span
                className={cn(
                  'text-xs leading-4 tabular-nums',
                  description.length > 450 ? 'text-warning' : 'text-muted-foreground'
                )}
              >
                {description.length}/{DESCRIPTION_MAX}
              </span>
            }
          >
            <Textarea
              id="description"
              rows={4}
              placeholder="We help customers with... Our main services are..."
              {...form.register('description')}
              className="min-h-28 resize-none"
            />
          </Field>
        </StepBody>

        <StepActions>
          <Button type="submit" size="lg" className="ml-auto max-md:flex-1">
            Continue
            <ArrowRight aria-hidden="true" />
          </Button>
        </StepActions>
      </form>
    </div>
  )
}
