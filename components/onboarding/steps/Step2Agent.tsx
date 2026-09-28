'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { useForm, useWatch, Controller, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Bot, ArrowRight, ArrowLeft, RotateCcw, CheckCircle2, ShieldCheck,
  Briefcase, Heart, Award, Coffee, Zap, HeartHandshake, type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { cn } from '@/lib/utils'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { INDUSTRY_OPTIONS } from '@/lib/agent-prompts'
import { AI_DISCLOSURE, localized, mentionsAiDisclosure } from '@/lib/voice/greetings'
import { TONE_PROFILES } from '@/lib/voice/tone'
import { AGENT_TONES, type AgentTone } from '@/types'
import {
  LIMITS, agentSchema, isGreetingCustomized, isSystemPromptCustomized, resolveGreeting,
  resolveSystemPrompt, suggestedGreeting, suggestedSystemPrompt, type OnboardingAgent,
} from '@/app/onboarding/_lib/onboarding-state'
import { StepHeader } from '../StepHeader'
import { useRovingRadio } from '../useRovingRadio'

type FormValues = OnboardingAgent

const TONE_ICONS: Record<AgentTone, LucideIcon> = {
  formal: Award,
  professional: Briefcase,
  empathetic: HeartHandshake,
  casual: Coffee,
  friendly: Heart,
  energetic: Zap,
}

const LANGUAGE_VALUES = AGENT_LANGUAGES.map((l) => l.value as string)

export function Step2Agent() {
  const agent = useOnboardingStore((s) => s.agent)
  const company = useOnboardingStore((s) => s.company)
  const edited = useOnboardingStore((s) => s.edited)
  const setAgent = useOnboardingStore((s) => s.setAgent)
  const setEdited = useOnboardingStore((s) => s.setEdited)
  const setStep = useOnboardingStore((s) => s.setStep)
  const dropVoiceForOtherLanguage = useOnboardingStore((s) => s.dropVoiceForOtherLanguage)

  const toneLabelId = useId()
  const languageLabelId = useId()
  const promptRegionId = useId()

  // Generated text follows the company as it is now (the owner may have
  // changed industry or name since the last visit); edited text stays.
  const [initial] = useState(() => {
    const greeting = resolveGreeting({
      language: agent.language, tone: agent.tone, company: company.name, agentName: agent.name,
      current: agent.first_message, edited: edited.first_message,
    })
    const prompt = resolveSystemPrompt({
      name: company.name, description: company.description, industry: company.industry,
      current: agent.system_prompt, edited: edited.system_prompt,
    })
    return {
      values: { ...agent, first_message: greeting.text, system_prompt: prompt.text },
      greetingEdited: greeting.edited,
      promptEdited: prompt.edited,
    }
  })
  const [showPrompt, setShowPrompt] = useState(initial.promptEdited)

  const form = useForm<FormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: initial.values,
    mode: 'onTouched',
  })
  const { errors } = form.formState

  useEffect(() => {
    setEdited({ first_message: initial.greetingEdited, system_prompt: initial.promptEdited })
    return form.subscribe({
      formState: { values: true },
      callback: ({ values }) => setAgent(values),
    })
  }, [form, initial, setAgent, setEdited])

  // Voices are picked per language: however the owner leaves this step
  // (Continue, Back, the step list), a voice picked for another language goes.
  useEffect(() => () => {
    dropVoiceForOtherLanguage()
  }, [dropVoiceForOtherLanguage])

  const tone = useWatch({ control: form.control, name: 'tone' })
  const language = useWatch({ control: form.control, name: 'language' })
  const agentName = useWatch({ control: form.control, name: 'name' }) ?? ''
  const greeting = useWatch({ control: form.control, name: 'first_message' }) ?? ''
  const systemPrompt = useWatch({ control: form.control, name: 'system_prompt' }) ?? ''

  const greetingContext = useMemo(
    () => ({ language, tone, company: company.name, agentName }),
    [language, tone, company.name, agentName]
  )
  const promptContext = useMemo(
    () => ({ name: company.name, description: company.description, industry: company.industry }),
    [company.name, company.description, company.industry]
  )

  // Regenerate the greeting when tone, language or name change, unless the
  // owner wrote their own. Only a context change regenerates: an owner who
  // clears the field to write from scratch doesn't get the suggestion back
  // mid-typing ("Use suggested greeting" brings it back on request).
  useEffect(() => {
    if (useOnboardingStore.getState().edited.first_message) return
    const next = suggestedGreeting(greetingContext)
    if (form.getValues('first_message') !== next) {
      form.setValue('first_message', next, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
    }
  }, [greetingContext, form])

  const industryLabel = INDUSTRY_OPTIONS.find((o) => o.value === company.industry)?.label ?? 'your industry'
  const disclosesAi = mentionsAiDisclosure(greeting, company.name)
  const languageLabel = AGENT_LANGUAGES.find((l) => l.value === language)?.label ?? 'this language'

  const greetingField = form.register('first_message', {
    onChange: (event: { target: { value: string } }) => {
      setEdited({ first_message: isGreetingCustomized(event.target.value, greetingContext) })
    },
  })
  const promptField = form.register('system_prompt', {
    onChange: (event: { target: { value: string } }) => {
      setEdited({ system_prompt: isSystemPromptCustomized(event.target.value, promptContext) })
    },
  })

  function applySuggestedGreeting() {
    form.setValue('first_message', suggestedGreeting(greetingContext), { shouldDirty: true, shouldValidate: true })
    setEdited({ first_message: false })
  }

  function resetInstructions() {
    const apply = () => {
      form.setValue('system_prompt', suggestedSystemPrompt(promptContext), { shouldDirty: true, shouldValidate: true })
      setEdited({ system_prompt: false })
    }
    if (!edited.system_prompt) {
      apply()
      return
    }
    toast('Replace your instructions with the template?', {
      description: `Your edits will be replaced with the ${industryLabel} template.`,
      action: { label: 'Replace', onClick: apply },
    })
  }

  function onSubmit(values: FormValues) {
    setAgent({ ...values, name: values.name.trim(), first_message: values.first_message.trim() })
    // An English voice reading Romanian sounds wrong.
    if (dropVoiceForOtherLanguage()) {
      toast.info(`Voice reset for ${languageLabel}`, {
        description: 'You changed the language, so the next step starts with a voice that speaks it natively.',
      })
    }
    setStep(3)
  }

  function onInvalid(invalid: FieldErrors<FormValues>) {
    // The instructions may be collapsed; open them so the error is visible.
    if (invalid.system_prompt) setShowPrompt(true)
  }

  return (
    <div className="space-y-8">
      <StepHeader icon={Bot} title="Set up your AI agent" description="Choose how it sounds, what it's called and how it answers" />

      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-7">
        {/* Tone */}
        <div className="space-y-2">
          <Label id={toneLabelId} className="text-sm font-medium">Tone of voice</Label>
          <Controller
            control={form.control}
            name="tone"
            render={({ field }) => (
              <ToneGrid labelledBy={toneLabelId} value={field.value} onChange={field.onChange} />
            )}
          />
        </div>

        {/* Agent Name */}
        <div className="space-y-1.5">
          <Label htmlFor="agent-name" className="text-sm font-medium">
            Agent name <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Input
            id="agent-name"
            placeholder="e.g. Sarah, Alex, Max"
            maxLength={LIMITS.agentName.max}
            autoComplete="off"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby="agent-name-hint"
            {...form.register('name')}
            className={cn('h-11', errors.name && 'border-destructive')}
          />
          <p id="agent-name-hint" className={cn('text-xs', errors.name ? 'text-destructive' : 'text-muted-foreground')}>
            {errors.name?.message ?? 'What your agent calls itself on calls'}
          </p>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <Label id={languageLabelId} className="text-sm font-medium">
            Language it speaks <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Controller
            control={form.control}
            name="language"
            render={({ field }) => (
              <LanguageGrid labelledBy={languageLabelId} value={field.value} onChange={field.onChange} />
            )}
          />
          {errors.language && <p className="text-xs text-destructive">{errors.language.message}</p>}
        </div>

        {/* Greeting */}
        <div className="space-y-1.5">
          <div className="flex min-h-7 items-center justify-between gap-3">
            <Label htmlFor="agent-greeting" className="text-sm font-medium">
              Greeting <span className="text-destructive" aria-hidden="true">*</span>
            </Label>
            {(edited.first_message || !greeting.trim()) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={applySuggestedGreeting}
                className="h-7 gap-1.5 text-xs text-primary hover:bg-purple-50"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Use suggested greeting
              </Button>
            )}
          </div>
          <Textarea
            id="agent-greeting"
            rows={3}
            maxLength={LIMITS.firstMessage.max}
            aria-invalid={errors.first_message ? true : undefined}
            aria-describedby="agent-greeting-hint agent-greeting-disclosure"
            {...greetingField}
            className={cn('resize-none', errors.first_message && 'border-destructive')}
          />
          <p id="agent-greeting-hint" className={cn('text-xs', errors.first_message ? 'text-destructive' : 'text-muted-foreground')}>
            {errors.first_message?.message ??
              (edited.first_message
                ? 'Your own words. They stay as written if you change the tone or language.'
                : 'The first thing callers hear. It follows the tone and language you pick until you edit it.')}
          </p>
          <div
            id="agent-greeting-disclosure"
            className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground"
          >
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>
              {disclosesAi ? (
                'Callers are told they’re speaking with an AI assistant, as the law requires in the EU and many other places.'
              ) : (
                <>
                  Your greeting doesn’t say it’s an AI, so your agent adds “{localized(AI_DISCLOSURE, language)}” to it
                  (before any closing question). Callers must be told they’re speaking with an AI.
                </>
              )}
            </span>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Agent instructions</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {edited.system_prompt
                  ? 'Your own instructions for how the agent handles calls.'
                  : `Written for ${industryLabel}: what the agent handles, what it never promises, and how it speaks.`}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={showPrompt}
              aria-controls={promptRegionId}
              onClick={() => setShowPrompt((v) => !v)}
              className="h-8 shrink-0 self-start"
            >
              {showPrompt ? 'Hide instructions' : 'Review and edit'}
            </Button>
          </div>

          <div id={promptRegionId} hidden={!showPrompt} className="space-y-1.5">
            <Label htmlFor="agent-instructions" className="sr-only">Agent instructions</Label>
            <Textarea
              id="agent-instructions"
              rows={12}
              maxLength={LIMITS.systemPrompt.max}
              aria-invalid={errors.system_prompt ? true : undefined}
              aria-describedby="agent-instructions-meta"
              {...promptField}
              className={cn('max-h-[28rem] resize-y text-sm leading-relaxed', errors.system_prompt && 'border-destructive')}
            />
            <div id="agent-instructions-meta" className="flex items-center justify-between gap-3">
              {errors.system_prompt ? (
                <p className="text-xs text-destructive">{errors.system_prompt.message}</p>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetInstructions}
                  disabled={!edited.system_prompt && systemPrompt === suggestedSystemPrompt(promptContext)}
                  className="h-7 gap-1.5 px-2 text-xs text-primary hover:bg-purple-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Reset to the {industryLabel} template
                </Button>
              )}
              <span
                className={cn(
                  'shrink-0 text-xs tabular-nums',
                  systemPrompt.length > LIMITS.systemPrompt.max * 0.9 ? 'text-orange-500' : 'text-muted-foreground'
                )}
              >
                {systemPrompt.length}/{LIMITS.systemPrompt.max}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => setStep(1)} className="h-10 gap-2">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
          </Button>
          <Button type="submit" className="purple-glow h-10 px-6">
            Continue <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </form>
    </div>
  )
}

function ToneGrid({ labelledBy, value, onChange }: { labelledBy: string; value: AgentTone; onChange: (tone: AgentTone) => void }) {
  const itemProps = useRovingRadio({ values: AGENT_TONES, value, onChange })
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
      {AGENT_TONES.map((id) => {
        const profile = TONE_PROFILES[id]
        const Icon = TONE_ICONS[id]
        const selected = value === id
        return (
          <button
            key={id}
            {...itemProps(id)}
            className={cn(
              'relative rounded-xl border p-3 text-left outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-4',
              selected ? 'border-primary bg-purple-50 ring-1 ring-primary' : 'border-border hover:border-purple-300 hover:bg-purple-50/50'
            )}
          >
            <Icon className={cn('mb-2 h-5 w-5', selected ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
            <span className="block text-sm font-semibold">{profile.label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{profile.blurb}</span>
            {selected && <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-primary" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}

function LanguageGrid({ labelledBy, value, onChange }: { labelledBy: string; value: string; onChange: (language: string) => void }) {
  const itemProps = useRovingRadio({ values: LANGUAGE_VALUES, value, onChange })
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {AGENT_LANGUAGES.map((lang) => {
        const selected = value === lang.value
        return (
          <button
            key={lang.value}
            {...itemProps(lang.value)}
            className={cn(
              'flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-left outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50',
              selected ? 'border-primary bg-purple-50 ring-1 ring-primary' : 'border-border hover:border-purple-200 hover:bg-purple-50/30'
            )}
          >
            <FlagIcon country={lang.country} className="h-4 w-6" />
            <span className={cn('min-w-0 text-xs font-medium', selected ? 'text-foreground' : 'text-muted-foreground')}>
              {lang.label}
            </span>
            {selected && <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
