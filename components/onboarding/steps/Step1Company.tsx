'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Building2, Globe, ArrowRight, CheckCircle2,
  Cpu, Heart, Home, TrendingUp, ShoppingBag,
  Plane, GraduationCap, Scale, Car, Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { cn } from '@/lib/utils'

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

const INDUSTRIES = [
  { value: 'technology',  label: 'Technology',   icon: Cpu,           color: 'text-blue-600',    bg: 'bg-blue-50',    ring: 'ring-blue-400',    selectedBg: 'bg-blue-50',    selectedBorder: 'border-blue-400' },
  { value: 'healthcare',  label: 'Healthcare',   icon: Heart,         color: 'text-rose-600',    bg: 'bg-rose-50',    ring: 'ring-rose-400',    selectedBg: 'bg-rose-50',    selectedBorder: 'border-rose-400' },
  { value: 'real_estate', label: 'Real Estate',  icon: Home,          color: 'text-green-600',   bg: 'bg-green-50',   ring: 'ring-green-400',   selectedBg: 'bg-green-50',   selectedBorder: 'border-green-400' },
  { value: 'finance',     label: 'Finance',      icon: TrendingUp,    color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-400', selectedBg: 'bg-emerald-50', selectedBorder: 'border-emerald-400' },
  { value: 'retail',      label: 'Retail',       icon: ShoppingBag,   color: 'text-orange-600',  bg: 'bg-orange-50',  ring: 'ring-orange-400',  selectedBg: 'bg-orange-50',  selectedBorder: 'border-orange-400' },
  { value: 'hospitality', label: 'Hospitality',  icon: Plane,         color: 'text-sky-600',     bg: 'bg-sky-50',     ring: 'ring-sky-400',     selectedBg: 'bg-sky-50',     selectedBorder: 'border-sky-400' },
  { value: 'education',   label: 'Education',    icon: GraduationCap, color: 'text-purple-600',  bg: 'bg-purple-50',  ring: 'ring-purple-400',  selectedBg: 'bg-purple-50',  selectedBorder: 'border-purple-400' },
  { value: 'legal',       label: 'Legal',        icon: Scale,         color: 'text-slate-600',   bg: 'bg-slate-50',   ring: 'ring-slate-400',   selectedBg: 'bg-slate-50',   selectedBorder: 'border-slate-400' },
  { value: 'automotive',  label: 'Automotive',   icon: Car,           color: 'text-zinc-600',    bg: 'bg-zinc-50',    ring: 'ring-zinc-400',    selectedBg: 'bg-zinc-50',    selectedBorder: 'border-zinc-400' },
  { value: 'other',       label: 'Other',        icon: Plus,          color: 'text-gray-500',    bg: 'bg-gray-50',    ring: 'ring-gray-400',    selectedBg: 'bg-gray-50',    selectedBorder: 'border-gray-400' },
]

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

  const description = form.watch('description') ?? ''

  function onSubmit(values: FormValues) {
    setCompany({
      ...values,
      website: values.website ? normalizeUrl(values.website) : values.website,
    })
    setStep(2)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col items-start gap-4">
        <div className="rounded-xl bg-purple-100 p-2.5">
          <Building2 className="h-7 w-7 text-purple-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Tell us about your company</h2>
          <p className="mt-1 text-muted-foreground">This helps us personalize your AI agent</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* Company Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium">
            Company name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Acme Corporation"
            {...form.register('name')}
            className={cn('h-11', form.formState.errors.name && 'border-destructive')}
          />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        {/* Industry cards */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Industry <span className="text-destructive">*</span>
          </Label>
          <Controller
            control={form.control}
            name="industry"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {INDUSTRIES.map((ind) => {
                  const Icon = ind.icon
                  const isSelected = field.value === ind.value
                  return (
                    <button
                      key={ind.value}
                      type="button"
                      onClick={() => field.onChange(ind.value)}
                      className={cn(
                        'relative flex flex-col items-center gap-2.5 rounded-xl border-2 px-3 py-4 text-center transition-all duration-150',
                        isSelected
                          ? `${ind.selectedBorder} ${ind.selectedBg} ring-2 ${ind.ring} ring-offset-2`
                          : 'border-border hover:border-purple-200 hover:bg-purple-50/30'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                          isSelected ? ind.bg : 'bg-gray-100'
                        )}
                      >
                        <Icon className={cn('h-5 w-5', isSelected ? ind.color : 'text-gray-400')} />
                      </div>
                      <span
                        className={cn(
                          'text-xs font-semibold leading-tight',
                          isSelected ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {ind.label}
                      </span>
                      {isSelected && (
                        <div className="absolute right-1.5 top-1.5">
                          <CheckCircle2 className={cn('h-3.5 w-3.5', ind.color)} />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          />
          {form.formState.errors.industry && (
            <p className="text-xs text-destructive">{form.formState.errors.industry.message}</p>
          )}
        </div>

        {/* Website */}
        <div className="space-y-1.5">
          <Label htmlFor="website" className="text-sm font-medium">
            Website <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
          </Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="website"
              type="text"
              placeholder="www.yourcompany.com"
              {...form.register('website')}
              className={cn('h-11 pl-9', form.formState.errors.website && 'border-destructive')}
            />
          </div>
          {form.formState.errors.website && (
            <p className="text-xs text-destructive">{form.formState.errors.website.message}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-sm font-medium">
            What does your company do? <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="description"
            rows={4}
            placeholder="We help customers with... Our main services are..."
            {...form.register('description')}
            className={cn('resize-none', form.formState.errors.description && 'border-destructive')}
          />
          <div className="flex items-start justify-between">
            {form.formState.errors.description ? (
              <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
            ) : (
              <span />
            )}
            <span
              className={cn(
                'text-xs tabular-nums',
                description.length > 450 ? 'text-orange-500' : 'text-muted-foreground'
              )}
            >
              {description.length}/500
            </span>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <Button type="submit" className="purple-glow px-6">
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
