'use client'

import { useEffect, useState } from 'react'
import { useForm, useController, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowRight, ArrowLeft, Sparkles, RefreshCw,
  Briefcase, Heart, Award, Coffee, Zap, HeartHandshake,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Field } from '@/components/shared/FormSection'
import { Chip, OptionCard } from '@/components/shared/OptionCard'
import { useOnboardingStore, type Personality } from '@/store/useOnboardingStore'
import { cn } from '@/lib/utils'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { buildIndustrySystemPrompt } from '@/lib/agent-prompts'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { StepActions, StepBody, StepHeader } from '../StepIndicator'

const schema = z.object({
  personality:   z.string().min(1),
  name:          z.string().min(2, 'Name must be at least 2 characters').max(30, 'Max 30 characters'),
  language:      z.string().min(1, 'Please select a language'),
  first_message: z.string().min(10, 'Greeting must be at least 10 characters'),
  system_prompt: z.string().max(4000, 'Max 4000 characters').optional(),
})

type FormValues = z.infer<typeof schema>

const PERSONALITIES = [
  { id: 'professional' as Personality, icon: Briefcase,      name: 'Professional', desc: 'Formal, precise, business-focused' },
  { id: 'friendly'     as Personality, icon: Heart,          name: 'Friendly',     desc: 'Warm, approachable, conversational' },
  { id: 'formal'       as Personality, icon: Award,          name: 'Formal',       desc: 'Structured, authoritative, serious' },
  { id: 'casual'       as Personality, icon: Coffee,         name: 'Casual',       desc: 'Relaxed, natural, easy-going' },
  { id: 'energetic'    as Personality, icon: Zap,            name: 'Energetic',    desc: 'Enthusiastic, upbeat, dynamic' },
  { id: 'empathetic'   as Personality, icon: HeartHandshake, name: 'Empathetic',   desc: 'Compassionate, patient, supportive' },
]


// Localized greeting templates, keyed by language code, so "Auto-generate"
// respects the selected language.
const GREETINGS: Record<string, (company: string, agent: string) => string> = {
  en: (c, a) => `Hello! Thank you for calling ${c}. I'm ${a}, your virtual assistant. How can I help you today?`,
  ro: (c, a) => `Bună ziua! Vă mulțumim că ați sunat la ${c}. Sunt ${a}, asistentul dumneavoastră virtual. Cu ce vă pot ajuta astăzi?`,
  es: (c, a) => `¡Hola! Gracias por llamar a ${c}. Soy ${a}, su asistente virtual. ¿En qué puedo ayudarle hoy?`,
  fr: (c, a) => `Bonjour ! Merci d'appeler ${c}. Je suis ${a}, votre assistant virtuel. Comment puis-je vous aider aujourd'hui ?`,
  de: (c, a) => `Hallo! Vielen Dank für Ihren Anruf bei ${c}. Ich bin ${a}, Ihr virtueller Assistent. Wie kann ich Ihnen heute helfen?`,
  it: (c, a) => `Buongiorno! Grazie per aver chiamato ${c}. Sono ${a}, il suo assistente virtuale. Come posso aiutarla oggi?`,
  pt: (c, a) => `Olá! Obrigado por ligar para ${c}. Sou ${a}, o seu assistente virtual. Como posso ajudá-lo hoje?`,
  ja: (c, a) => `もしもし、${c}にお電話いただきありがとうございます。バーチャルアシスタントの${a}です。本日はどのようなご用件でしょうか？`,
  ko: (c, a) => `안녕하세요! ${c}에 전화해 주셔서 감사합니다. 저는 가상 비서 ${a}입니다. 오늘 무엇을 도와드릴까요?`,
  ar: (c, a) => `مرحباً! شكراً لاتصالك بـ ${c}. أنا ${a}، مساعدك الافتراضي. كيف يمكنني مساعدتك اليوم؟`,
  pl: (c, a) => `Dzień dobry! Dziękujemy za telefon do ${c}. Nazywam się ${a} i jestem Twoim wirtualnym asystentem. W czym mogę pomóc?`,
  nl: (c, a) => `Hallo! Bedankt voor het bellen naar ${c}. Ik ben ${a}, uw virtuele assistent. Hoe kan ik u vandaag helpen?`,
}

export function Step2Agent() {
  const { agent, company, setAgent, setStep } = useOnboardingStore()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      personality:   agent.personality,
      name:          agent.name,
      language:      agent.language,
      first_message: agent.first_message,
      system_prompt: agent.system_prompt,
    },
  })

  // Registered in page order (name, language, then the fields below them): a failed submit
  // focuses the first invalid field in registration order, so this keeps it the top-most one.
  const nameField = form.register('name')
  const { field: language } = useController({ control: form.control, name: 'language' })

  const systemPrompt = form.watch('system_prompt') ?? ''
  const agentName    = form.watch('name')
  const personality  = form.watch('personality')

  // Auto-fill a detailed, industry-specific system prompt the first time this
  // step is reached (empty field only) - the agent should already be well
  // configured without the user having to write or pick anything themselves.
  useEffect(() => {
    if (!form.getValues('system_prompt')?.trim()) {
      form.setValue(
        'system_prompt',
        buildIndustrySystemPrompt({ name: company.name, description: company.description, industry: company.industry }),
        { shouldValidate: true }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function autoGenerateGreeting() {
    const companyName = company.name || 'our company'
    const an = agentName || 'your assistant'
    const lang = form.getValues('language') || 'en'
    const build = GREETINGS[lang] ?? GREETINGS.en
    form.setValue('first_message', build(companyName, an), { shouldValidate: true })
  }

  function regenerateSystemPrompt() {
    form.setValue(
      'system_prompt',
      buildIndustrySystemPrompt({ name: company.name, description: company.description, industry: company.industry }),
      { shouldValidate: true }
    )
  }

  function onSubmit(values: FormValues) {
    setAgent(values as typeof agent)
    setStep(3)
  }

  const { errors } = form.formState
  // The instructions sit in a collapsed "Advanced" section. A submit that fails on them opens it
  // (before the form focuses the field); the owner can still close it afterwards.
  const [advancedOpen, setAdvancedOpen] = useState<string[]>([])
  function onInvalid(invalid: FieldErrors<FormValues>) {
    if (invalid.system_prompt) setAdvancedOpen(['instructions'])
  }

  return (
    <div>
      <StepHeader
        step={2}
        title="Configure your AI agent"
        description="Define how your agent thinks and speaks"
      />

      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} noValidate>
        <StepBody className="space-y-8">
          {/* Personality */}
          <div className="grid gap-2">
            <Label id="personality-label">Agent personality</Label>
            <div role="radiogroup" aria-labelledby="personality-label" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PERSONALITIES.map((p) => (
                <OptionCard
                  key={p.id}
                  selected={personality === p.id}
                  onSelect={() => form.setValue('personality', p.id)}
                  icon={p.icon}
                  title={p.name}
                  description={p.desc}
                  className="h-full"
                />
              ))}
            </div>
          </div>

          {/* Agent name */}
          <Field
            label="Agent name"
            htmlFor="agentName"
            hint="This is what your agent will call itself on calls"
            error={errors.name?.message}
          >
            <Input
              id="agentName"
              placeholder="e.g. Sarah, Alex, Max"
              maxLength={30}
              autoComplete="off"
              {...nameField}
              className="h-11"
            />
          </Field>

          {/* Language. With htmlFor, Field ids the error (language-error) and wires the group's
              aria-describedby / aria-invalid (it is Field's single native child). */}
          <Field label={<span id="language-label">Primary language</span>} htmlFor="language" error={errors.language?.message}>
            <div
              id="language"
              // A failed submit focuses the group's tab stop (the checked or first chip).
              ref={(el) => {
                if (el) language.ref({ focus: () => el.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus() })
              }}
              role="radiogroup"
              aria-labelledby="language-label"
              className="flex flex-wrap gap-2"
            >
              {AGENT_LANGUAGES.map((lang) => (
                <Chip
                  key={lang.value}
                  role="radio"
                  pressed={language.value === lang.value}
                  onClick={() => language.onChange(lang.value)}
                  className="pl-2"
                >
                  <FlagIcon country={lang.country} className="h-3 w-[18px]" />
                  {lang.label}
                </Chip>
              ))}
            </div>
          </Field>

          {/* Greeting */}
          <Field
            label="Greeting message"
            htmlFor="first_message"
            hint="This is the first thing your agent says when answering a call"
            error={errors.first_message?.message}
            labelAction={
              <Button type="button" variant="ghost" size="xs" onClick={autoGenerateGreeting} className="-my-1.5 -mr-2.5">
                <Sparkles aria-hidden="true" />
                Auto-generate
              </Button>
            }
          >
            <Textarea
              id="first_message"
              rows={3}
              placeholder={`Hello! Thank you for calling ${company.name || '[Company Name]'}. I'm Sarah, your virtual assistant. How can I help you today?`}
              {...form.register('first_message')}
              className="resize-none"
            />
          </Field>

          {/* Instructions (advanced). Top rule only: the action row below brings its own hairline from md. */}
          <Accordion
            value={advancedOpen}
            onValueChange={(value: string[]) => setAdvancedOpen(value)}
            className="border-t border-rule"
          >
            <AccordionItem value="instructions">
              <AccordionTrigger>
                <span className="grid gap-0.5">
                  <span>Agent instructions</span>
                  <span className="text-[13px] leading-[19px] font-normal text-muted-foreground">
                    Advanced: define exactly how your agent should behave
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-foreground">
                <Field
                  label={<span className="sr-only">Agent instructions</span>}
                  htmlFor="system_prompt"
                  hint="Pre-filled based on your industry, edit anything you'd like to change."
                  error={errors.system_prompt?.message}
                  labelAction={
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-xs leading-4 tabular-nums',
                          systemPrompt.length > 3600 ? 'text-warning' : 'text-muted-foreground'
                        )}
                      >
                        {systemPrompt.length}/4000
                      </span>
                      <Button type="button" variant="ghost" size="xs" onClick={regenerateSystemPrompt} className="-my-1.5 -mr-2.5">
                        <RefreshCw aria-hidden="true" />
                        Regenerate
                      </Button>
                    </span>
                  }
                  className="px-px pt-1"
                >
                  <Textarea
                    id="system_prompt"
                    rows={10}
                    {...form.register('system_prompt')}
                    className="max-h-[420px] resize-none text-[13px] leading-5"
                  />
                </Field>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </StepBody>

        <StepActions>
          <Button type="button" variant="ghost" size="lg" onClick={() => setStep(1)}>
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
          <Button type="submit" size="lg" className="ml-auto max-md:flex-1">
            Continue
            <ArrowRight aria-hidden="true" />
          </Button>
        </StepActions>
      </form>
    </div>
  )
}
