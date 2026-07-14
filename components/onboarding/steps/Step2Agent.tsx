'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Bot, ArrowRight, ArrowLeft, Sparkles, RefreshCw, CheckCircle2,
  Briefcase, Heart, Award, Coffee, Zap, HeartHandshake,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useOnboardingStore, type Personality } from '@/store/useOnboardingStore'
import { cn } from '@/lib/utils'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { buildIndustrySystemPrompt } from '@/lib/agent-prompts'
import { FlagIcon } from '@/components/shared/FlagIcon'

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col items-start gap-4">
        <div className="rounded-xl bg-purple-100 p-2.5">
          <Bot className="h-7 w-7 text-purple-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Configure your AI agent</h2>
          <p className="mt-1 text-muted-foreground">Define how your agent thinks and speaks</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* Personality */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Agent personality</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PERSONALITIES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => form.setValue('personality', p.id)}
                className={cn(
                  'rounded-xl border p-4 text-left transition-all duration-150',
                  personality === p.id
                    ? 'border-primary bg-purple-50 ring-2 ring-primary ring-offset-2'
                    : 'border-border hover:border-purple-300 hover:bg-purple-50/50'
                )}
              >
                <p.icon
                  className={cn('mb-2 h-5 w-5', personality === p.id ? 'text-primary' : 'text-muted-foreground')}
                />
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Agent Name */}
        <div className="space-y-1.5">
          <Label htmlFor="agentName" className="text-sm font-medium">
            Agent name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="agentName"
            placeholder="e.g. Sarah, Alex, Max"
            maxLength={30}
            {...form.register('name')}
            className={cn('h-11', form.formState.errors.name && 'border-destructive')}
          />
          <p className="text-xs text-muted-foreground">This is what your agent will call itself on calls</p>
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        {/* Language flag cards */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Primary language <span className="text-destructive">*</span>
          </Label>
          <Controller
            control={form.control}
            name="language"
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {AGENT_LANGUAGES.map((lang) => {
                  const isSelected = field.value === lang.value
                  return (
                    <button
                      key={lang.value}
                      type="button"
                      onClick={() => field.onChange(lang.value)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-all duration-150',
                        isSelected
                          ? 'border-primary bg-purple-50 ring-1 ring-primary'
                          : 'border-border hover:border-purple-200 hover:bg-purple-50/30'
                      )}
                    >
                      <FlagIcon country={lang.country} className="h-4 w-6" />
                      <span className={cn('text-xs font-medium', isSelected ? 'text-foreground' : 'text-muted-foreground')}>
                        {lang.label}
                      </span>
                      {isSelected && <CheckCircle2 className="ml-auto h-3 w-3 flex-shrink-0 text-primary" />}
                    </button>
                  )
                })}
              </div>
            )}
          />
        </div>

        {/* First Message */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="first_message" className="text-sm font-medium">
              Greeting message <span className="text-destructive">*</span>
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={autoGenerateGreeting}
              className="h-7 gap-1.5 text-xs text-primary hover:bg-purple-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Auto-generate
            </Button>
          </div>
          <Textarea
            id="first_message"
            rows={3}
            placeholder={`Hello! Thank you for calling ${company.name || '[Company Name]'}. I'm Sarah, your virtual assistant. How can I help you today?`}
            {...form.register('first_message')}
            className={cn('resize-none', form.formState.errors.first_message && 'border-destructive')}
          />
          <p className="text-xs text-muted-foreground">This is the first thing your agent says when answering a call</p>
          {form.formState.errors.first_message && (
            <p className="text-xs text-destructive">{form.formState.errors.first_message.message}</p>
          )}
        </div>

        {/* System Prompt */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="system_prompt" className="text-sm font-medium">
              Agent instructions
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={regenerateSystemPrompt}
              className="h-7 gap-1.5 text-xs text-primary hover:bg-purple-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Pre-filled based on your industry, edit anything you&apos;d like to change.
          </p>
          <Textarea
            id="system_prompt"
            rows={10}
            {...form.register('system_prompt')}
            className="resize-none font-mono text-sm"
          />
          <div className="flex justify-between">
            <p className="text-xs text-muted-foreground">Advanced: define exactly how your agent should behave</p>
            <span
              className={cn(
                'text-xs tabular-nums',
                systemPrompt.length > 3600 ? 'text-orange-500' : 'text-muted-foreground'
              )}
            >
              {systemPrompt.length}/4000
            </span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-2">
          <Button type="button" variant="ghost" onClick={() => setStep(1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button type="submit" className="purple-glow px-6">
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
