'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Bot, ArrowRight, ArrowLeft, Sparkles, FileText, CheckCircle2, X,
  Briefcase, Heart, Award, Coffee, Zap, HeartHandshake,
  Stethoscope, Home, Headphones, UtensilsCrossed, Scale, ShoppingCart, Hotel, Code2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useOnboardingStore, type Personality } from '@/store/useOnboardingStore'
import { cn } from '@/lib/utils'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'

const schema = z.object({
  personality:   z.string().min(1),
  name:          z.string().min(2, 'Name must be at least 2 characters').max(30, 'Max 30 characters'),
  language:      z.string().min(1, 'Please select a language'),
  first_message: z.string().min(10, 'Greeting must be at least 10 characters'),
  system_prompt: z.string().max(2000, 'Max 2000 characters').optional(),
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


const TEMPLATES = [
  {
    id: 'healthcare',
    name: 'Healthcare Receptionist',
    icon: Stethoscope,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    category: 'Healthcare',
    desc: 'Appointment scheduling, patient info, office hours',
    prompt: (c: string) => `You are a professional medical receptionist for ${c}. Your responsibilities include scheduling appointments, answering questions about office hours and services, collecting basic patient information, and directing urgent matters appropriately. Always be empathetic and professional. Never provide medical advice or diagnose conditions. If a caller describes a medical emergency, instruct them to call emergency services immediately.`,
  },
  {
    id: 'real_estate',
    name: 'Real Estate Agent',
    icon: Home,
    color: 'text-green-600',
    bg: 'bg-green-50',
    category: 'Real Estate',
    desc: 'Property inquiries, viewings, agent scheduling',
    prompt: (c: string) => `You are a real estate assistant for ${c}. Help callers with property inquiries, scheduling viewings, providing basic property information, and connecting them with agents. Be knowledgeable, helpful, and professional. Collect caller details for follow-up and always confirm next steps clearly.`,
  },
  {
    id: 'customer_service',
    name: 'Customer Support',
    icon: Headphones,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    category: 'General',
    desc: 'Product support, FAQs, ticket creation',
    prompt: (c: string) => `You are a customer service representative for ${c}. Your goal is to resolve customer issues efficiently and professionally. Answer questions about products and services, assist with troubleshooting, escalate complex issues to human agents when needed, and always leave the customer feeling heard and valued.`,
  },
  {
    id: 'restaurant',
    name: 'Restaurant Booking',
    icon: UtensilsCrossed,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    category: 'Hospitality',
    desc: 'Reservations, menu info, special requests',
    prompt: (c: string) => `You are a reservation agent for ${c}. Help guests make table reservations, answer questions about the menu, operating hours, and accommodate special dietary requirements or occasions. Confirm bookings clearly, including date, time, party size, and any special notes. Always be warm and welcoming.`,
  },
  {
    id: 'legal',
    name: 'Legal Office',
    icon: Scale,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    category: 'Legal',
    desc: 'Appointment booking, case intake, consultations',
    prompt: (c: string) => `You are an intake assistant for ${c}. Help callers schedule consultations with attorneys, collect basic case information, and answer general questions about the firm's practice areas. Do not provide legal advice. Always maintain confidentiality and treat every caller's situation with sensitivity and respect.`,
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce Support',
    icon: ShoppingCart,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    category: 'Retail',
    desc: 'Orders, returns, product info, tracking',
    prompt: (c: string) => `You are a customer support agent for ${c}'s online store. Help customers track orders, process returns or exchanges, answer product questions, and resolve purchase issues. Be efficient, friendly, and solution-focused. Always verify the customer's order details before making any changes.`,
  },
  {
    id: 'hotel',
    name: 'Hotel Concierge',
    icon: Hotel,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    category: 'Hospitality',
    desc: 'Reservations, amenities, local recommendations',
    prompt: (c: string) => `You are a concierge for ${c}. Assist guests with room reservations, check-in and check-out inquiries, information about hotel amenities, and local recommendations. Provide a personalized, premium experience. Handle special requests graciously and ensure every guest feels welcome and well taken care of.`,
  },
  {
    id: 'tech_support',
    name: 'Tech Support',
    icon: Code2,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    category: 'Technology',
    desc: 'Troubleshooting, onboarding, feature guidance',
    prompt: (c: string) => `You are a technical support specialist for ${c}. Help users troubleshoot issues, guide them through product features, and answer technical questions. Break down complex solutions into clear, simple steps. If a problem cannot be resolved on the call, create a detailed support ticket and set clear expectations for follow-up.`,
  },
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
  const [templateOpen, setTemplateOpen] = useState(false)

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

  function autoGenerateGreeting() {
    const companyName = company.name || 'our company'
    const an = agentName || 'your assistant'
    const lang = form.getValues('language') || 'en'
    const build = GREETINGS[lang] ?? GREETINGS.en
    form.setValue('first_message', build(companyName, an), { shouldValidate: true })
  }

  function applyTemplate(templateFn: (c: string) => string) {
    form.setValue('system_prompt', templateFn(company.name || 'our company'), { shouldValidate: true })
    setTemplateOpen(false)
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
                      <span className="text-lg leading-none">{lang.flag}</span>
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
              Agent instructions{' '}
              <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTemplateOpen(true)}
              className="h-7 gap-1.5 text-xs text-primary hover:bg-purple-50"
            >
              <FileText className="h-3.5 w-3.5" />
              Use template
            </Button>
          </div>
          <Textarea
            id="system_prompt"
            rows={5}
            placeholder={`You are a helpful assistant for ${company.name || '[Company]'}. Your main tasks are: answering questions about our services, scheduling appointments, and handling customer inquiries...`}
            {...form.register('system_prompt')}
            className="resize-none"
          />
          <div className="flex justify-between">
            <p className="text-xs text-muted-foreground">Advanced: define exactly how your agent should behave</p>
            <span
              className={cn(
                'text-xs tabular-nums',
                systemPrompt.length > 1800 ? 'text-orange-500' : 'text-muted-foreground'
              )}
            >
              {systemPrompt.length}/2000
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

      {/* Template picker dialog */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold">Choose a template</DialogTitle>
              <button
                onClick={() => setTemplateOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-gray-100 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Select an industry template as a starting point — you can customize it after.
            </p>
          </DialogHeader>

          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 max-h-[60vh] overflow-y-auto pr-1">
            {TEMPLATES.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.prompt)}
                  className="flex items-start gap-3 rounded-xl border p-4 text-left transition-all hover:border-primary hover:bg-purple-50/50 hover:shadow-sm group"
                >
                  <div className={cn('mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', t.bg)}>
                    <Icon className={cn('h-4.5 w-4.5', t.color)} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {t.category}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
