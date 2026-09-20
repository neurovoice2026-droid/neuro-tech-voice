'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Globe, ArrowRight, CheckCircle2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { cn } from '@/lib/utils'
import { INDUSTRY_OPTIONS } from '@/lib/agent-prompts'
import { LIMITS, companySchema, normalizeWebsite, type OnboardingCompany } from '@/app/onboarding/_lib/onboarding-state'
import { industryIcon } from '../industry-icons'
import { TimezoneSelect } from '../TimezoneSelect'
import { StepHeader } from '../StepHeader'
import { useRovingRadio } from '../useRovingRadio'

type FormValues = OnboardingCompany

const INDUSTRIES: readonly { value: string; label: string }[] = INDUSTRY_OPTIONS

export function Step1Company() {
  const company = useOnboardingStore((s) => s.company)
  const setCompany = useOnboardingStore((s) => s.setCompany)
  const setStep = useOnboardingStore((s) => s.setStep)

  const industryLabelId = useId()
  const timezoneId = useId()
  const timezoneHintId = useId()
  const [query, setQuery] = useState('')

  const form = useForm<FormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: company,
    mode: 'onTouched',
  })
  const { errors } = form.formState

  // Every keystroke lands in the tab's draft, so a refresh or a step back loses nothing.
  useEffect(() => {
    return form.subscribe({
      formState: { values: true },
      callback: ({ values }) => setCompany(values),
    })
  }, [form, setCompany])

  const description = useWatch({ control: form.control, name: 'description' }) ?? ''

  const visibleIndustries = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return INDUSTRIES
    return INDUSTRIES.filter((i) => i.label.toLowerCase().includes(q) || i.value.replace(/_/g, ' ').includes(q))
  }, [query])

  function onSubmit(values: FormValues) {
    setCompany({
      name: values.name.trim(),
      industry: values.industry,
      website: normalizeWebsite(values.website),
      description: values.description.trim(),
      timezone: values.timezone,
    })
    setStep(2)
  }

  return (
    <div className="space-y-8">
      <StepHeader
        icon={Building2}
        title="Tell us about your company"
        description="Your agent introduces itself with this and uses it to answer callers"
      />

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* Company Name */}
        <div className="space-y-1.5">
          <Label htmlFor="company-name" className="text-sm font-medium">
            Company name <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Input
            id="company-name"
            placeholder="Acme Dental Clinic"
            autoComplete="organization"
            maxLength={LIMITS.companyName.max}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'company-name-error' : undefined}
            {...form.register('name')}
            className={cn('h-11', errors.name && 'border-destructive')}
          />
          {errors.name && (
            <p id="company-name-error" className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* Industry */}
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <Label id={industryLabelId} className="text-sm font-medium">
              Industry <span className="text-destructive" aria-hidden="true">*</span>
            </Label>
            <span className="text-xs text-muted-foreground">Pick the closest match</span>
          </div>

          {/* On a phone 18 cards are a long scroll: a filter gets there faster. */}
          <div className="relative sm:hidden">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search industries"
              aria-label="Search industries"
              className="h-10 pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Controller
            control={form.control}
            name="industry"
            render={({ field }) => (
              <IndustryGrid
                labelledBy={industryLabelId}
                options={visibleIndustries}
                value={field.value}
                invalid={!!errors.industry}
                onChange={(value) => {
                  field.onChange(value)
                  field.onBlur()
                }}
                onShowAll={() => {
                  setQuery('')
                  field.onChange('other')
                }}
                query={query}
              />
            )}
          />
          {errors.industry && (
            <p className="text-xs text-destructive" role="alert">{errors.industry.message}</p>
          )}
        </div>

        {/* Website */}
        <div className="space-y-1.5">
          <Label htmlFor="company-website" className="text-sm font-medium">
            Website <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
          </Label>
          <div className="relative">
            <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="company-website"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="www.yourcompany.com"
              maxLength={LIMITS.website.max}
              aria-invalid={errors.website ? true : undefined}
              aria-describedby={errors.website ? 'company-website-error' : undefined}
              {...form.register('website')}
              className={cn('h-11 pl-9', errors.website && 'border-destructive')}
            />
          </div>
          {errors.website && (
            <p id="company-website-error" className="text-xs text-destructive">{errors.website.message}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="company-description" className="text-sm font-medium">
            What does your company do? <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Textarea
            id="company-description"
            rows={4}
            maxLength={LIMITS.description.max}
            placeholder="We are a family dental clinic. We offer check-ups, cleaning and whitening, and we're open Monday to Saturday."
            aria-invalid={errors.description ? true : undefined}
            aria-describedby="company-description-meta"
            {...form.register('description')}
            className={cn('resize-none', errors.description && 'border-destructive')}
          />
          <div id="company-description-meta" className="flex items-start justify-between gap-3">
            {errors.description ? (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Services, opening days, what callers usually ask about.</p>
            )}
            <span
              className={cn(
                'shrink-0 text-xs tabular-nums',
                description.length > 450 ? 'text-orange-500' : 'text-muted-foreground'
              )}
            >
              {description.length}/{LIMITS.description.max}
            </span>
          </div>
        </div>

        {/* Time zone */}
        <div className="space-y-1.5">
          <Label htmlFor={timezoneId} className="text-sm font-medium">
            Time zone <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Controller
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <TimezoneSelect
                id={timezoneId}
                value={field.value}
                onChange={field.onChange}
                invalid={!!errors.timezone}
                describedBy={timezoneHintId}
              />
            )}
          />
          <p id={timezoneHintId} className={cn('text-xs', errors.timezone ? 'text-destructive' : 'text-muted-foreground')}>
            {errors.timezone?.message ?? 'Sets your business hours, bookings and call times. Change it if your business is in another time zone.'}
          </p>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <Button type="submit" className="purple-glow h-10 w-full px-6 sm:w-auto">
            Continue <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </form>
    </div>
  )
}

function IndustryGrid({
  labelledBy, options, value, invalid, onChange, onShowAll, query,
}: {
  labelledBy: string
  options: readonly { value: string; label: string }[]
  value: string
  invalid: boolean
  onChange: (value: string) => void
  onShowAll: () => void
  query: string
}) {
  const values = useMemo(() => options.map((o) => o.value), [options])
  const itemProps = useRovingRadio({ values, value, onChange })

  if (options.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        No industry matches “{query.trim()}”.{' '}
        <button type="button" onClick={onShowAll} className="font-medium text-primary underline-offset-4 hover:underline">
          Choose Other
        </button>{' '}
        and describe your business below.
      </div>
    )
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-invalid={invalid || undefined}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3"
    >
      {options.map((option) => {
        const Icon = industryIcon(option.value)
        const selected = value === option.value
        return (
          <button
            key={option.value}
            {...itemProps(option.value)}
            className={cn(
              'relative flex min-h-12 items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50',
              'sm:flex-col sm:items-center sm:gap-2 sm:px-3 sm:py-4 sm:text-center',
              selected
                ? 'border-primary bg-purple-50'
                : 'border-border hover:border-purple-200 hover:bg-purple-50/30',
              invalid && !selected && 'border-destructive/40'
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors sm:h-10 sm:w-10 sm:rounded-xl',
                selected ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
              )}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <span className={cn('min-w-0 text-xs font-semibold leading-tight', selected ? 'text-foreground' : 'text-muted-foreground')}>
              {option.label}
            </span>
            {selected && (
              <CheckCircle2 className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-primary" aria-hidden="true" />
            )}
          </button>
        )
      })}
    </div>
  )
}
