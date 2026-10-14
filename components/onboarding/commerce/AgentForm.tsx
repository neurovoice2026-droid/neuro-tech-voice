'use client'

// Step 5, first part: the store agent's name, tone, language, transfer
// number, return policy and the editable prompt / first message. The prompt
// is pre-filled from GET /api/commerce/agent-prompt (the baseline, written in
// the language the agent calls in, for the current form values) and saved
// with POST /api/commerce/onboarding/agent.

import { useEffect, useRef, useState } from 'react'
import { useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, Award, Heart, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/shared/FormSection'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { OptionCard } from '@/components/shared/OptionCard'
import { OrbInline } from '@/components/shared/OrbLoader'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { normalizeE164 } from '@/lib/phone/e164'
import type { CommerceTone } from '@/lib/commerce/profile'
import { cn } from '@/lib/utils'
import { useCommerceOnboardingStore, type CommerceOnboardingAgent } from '@/store/useCommerceOnboardingStore'
import { StepActions, StepBody } from '../StepIndicator'
import { commerceErrorMessage, isAbort, requestJson } from './api'
import { FormSelect } from './fields'

const SYSTEM_PROMPT_MAX = 20_000
const FIRST_MESSAGE_MAX = 1_000

const GENERATE_FAILED = 'The instructions could not be generated.'
const SAVE_FAILED = 'The agent could not be saved.'

function isHttpsUrl(value: string): boolean {
  return URL.canParse(value) && /^https?:$/.test(new URL(value).protocol)
}

const schema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters').max(60, 'Use at most 60 characters'),
  tone: z.enum(['formal', 'friendly']),
  language: z.string().min(1, 'Choose a language'),
  transfer_number: z
    .string()
    .trim()
    .refine((v) => v === '' || normalizeE164(v) !== null, 'Use the international format, e.g. +40 712 345 678'),
  return_policy_url: z.string().trim().refine((v) => v === '' || isHttpsUrl(v), 'The address must start with https://'),
  first_message: z
    .string()
    .trim()
    .min(10, 'Use at least 10 characters')
    .max(FIRST_MESSAGE_MAX, `Use at most ${FIRST_MESSAGE_MAX.toLocaleString('en-US')} characters`),
  system_prompt: z.string().max(SYSTEM_PROMPT_MAX, `Use at most ${SYSTEM_PROMPT_MAX.toLocaleString('en-US')} characters`),
})

type FormValues = z.infer<typeof schema>

const TONES: ReadonlyArray<{ id: CommerceTone; icon: typeof Award; name: string; desc: string }> = [
  { id: 'friendly', icon: Heart, name: 'Friendly', desc: 'Warm and natural, short sentences' },
  { id: 'formal', icon: Award, name: 'Formal', desc: 'Polite and professional' },
]

const LANGUAGE_OPTIONS = AGENT_LANGUAGES.map((l) => ({
  value: l.value,
  label: l.label,
  icon: <FlagIcon country={l.country} className="h-3 w-[18px]" />,
}))

interface GeneratedPrompt {
  system_prompt: string
  first_message: string
}

/** The last generated text of each editor, to tell an untouched baseline from the merchant's own. */
interface GeneratedText {
  system_prompt: string | null
  first_message: string | null
}

interface AgentFormProps {
  onBack: () => void
  onSaved: () => void
}

export function AgentForm({ onBack, onSaved }: AgentFormProps) {
  const agent = useCommerceOnboardingStore((s) => s.agent)
  const profile = useCommerceOnboardingStore((s) => s.profile)
  const setAgent = useCommerceOnboardingStore((s) => s.setAgent)
  const setProfile = useCommerceOnboardingStore((s) => s.setProfile)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState<'prompt' | 'greeting' | 'initial' | null>(null)
  const generateRef = useRef<AbortController | null>(null)
  const generatedRef = useRef<GeneratedText>({ system_prompt: null, first_message: null })

  // The agent row exists since step 1 as a placeholder ("<Store> Agent" with the table's default
  // language, no prompt): only a saved prompt means this form was filled once. Until then the
  // store profile (the language picked at step 1) gives the defaults, not the placeholder.
  const savedBefore = !!agent?.system_prompt
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: savedBefore ? (agent?.name ?? '') : '',
      tone: profile.tone,
      language: (savedBefore && agent?.language) || profile.language,
      transfer_number: profile.transfer_number ?? '',
      return_policy_url: profile.return_policy_url ?? '',
      first_message: agent?.first_message ?? '',
      system_prompt: agent?.system_prompt ?? '',
    },
  })
  const nameField = form.register('name')
  const { field: language } = useController({ control: form.control, name: 'language' })
  const tone = form.watch('tone')
  const systemPrompt = form.watch('system_prompt') ?? ''
  const { errors } = form.formState

  /** GET /api/commerce/agent-prompt for what the form currently holds. */
  async function generate(kind: 'prompt' | 'greeting' | 'initial'): Promise<GeneratedPrompt | null> {
    generateRef.current?.abort()
    const ctrl = new AbortController()
    generateRef.current = ctrl
    setGenerating(kind)
    const values = form.getValues()
    const params = new URLSearchParams({ tone: values.tone })
    if (values.name.trim()) params.set('agent_name', values.name.trim())
    const transfer = values.transfer_number.trim() ? normalizeE164(values.transfer_number) : ''
    if (transfer !== null) params.set('transfer_number', transfer)
    const policy = values.return_policy_url.trim()
    if (policy === '' || isHttpsUrl(policy)) params.set('return_policy_url', policy)
    try {
      return await requestJson<GeneratedPrompt>(`/api/commerce/agent-prompt?${params}`, {
        signal: ctrl.signal,
        fallback: GENERATE_FAILED,
      })
    } catch (err) {
      if (ctrl.signal.aborted || isAbort(err)) return null
      toast.error(commerceErrorMessage(err, GENERATE_FAILED), {
        description: 'You can write the instructions yourself or try again with "Regenerate".',
      })
      return null
    } finally {
      if (generateRef.current === ctrl) {
        generateRef.current = null
        setGenerating(null)
      }
    }
  }

  // First visit: empty prompt / greeting get the baseline so the agent is usable without edits.
  useEffect(() => {
    const values = form.getValues()
    if (values.system_prompt.trim() && values.first_message.trim()) return
    void generate('initial').then((generated) => {
      if (!generated) return
      if (!form.getValues('system_prompt').trim()) {
        form.setValue('system_prompt', generated.system_prompt, { shouldValidate: true })
        generatedRef.current.system_prompt = generated.system_prompt
      }
      if (!form.getValues('first_message').trim()) {
        form.setValue('first_message', generated.first_message, { shouldValidate: true })
        generatedRef.current.first_message = generated.first_message
      }
    })
    return () => generateRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function regeneratePrompt() {
    const generated = await generate('prompt')
    if (!generated) return
    form.setValue('system_prompt', generated.system_prompt, { shouldValidate: true, shouldDirty: true })
    generatedRef.current.system_prompt = generated.system_prompt
  }

  async function generateGreeting() {
    const generated = await generate('greeting')
    if (!generated) return
    form.setValue('first_message', generated.first_message, { shouldValidate: true, shouldDirty: true })
    generatedRef.current.first_message = generated.first_message
  }

  async function onSubmit(values: FormValues) {
    if (saving) return
    setSaving(true)
    const transfer = values.transfer_number ? (normalizeE164(values.transfer_number) ?? '') : ''
    // A baseline the merchant left as generated is sent blank: the route then builds it again
    // from the values saved in this very request, so the stored prompt and greeting carry the
    // final name, tone, transfer number and return policy (the generation here ran with the
    // values of that moment, possibly the placeholder agent name). Edited text is kept as is.
    const generated = generatedRef.current
    const untouchedPrompt = generated.system_prompt !== null && values.system_prompt === generated.system_prompt
    const untouchedGreeting = generated.first_message !== null && values.first_message === generated.first_message
    try {
      const data = await requestJson<{ agent_id: string; system_prompt: string; first_message?: string }>('/api/commerce/onboarding/agent', {
        method: 'POST',
        body: {
          name: values.name,
          language: values.language,
          tone: values.tone,
          transfer_number: transfer,
          return_policy_url: values.return_policy_url,
          system_prompt: untouchedPrompt ? '' : values.system_prompt,
          first_message: untouchedGreeting ? '' : values.first_message,
        },
        fallback: SAVE_FAILED,
      })
      const next: CommerceOnboardingAgent = {
        id: data.agent_id,
        name: values.name,
        language: values.language,
        system_prompt: data.system_prompt,
        first_message: data.first_message ?? values.first_message,
        voice_id: agent?.voice_id ?? null,
        voice_name: agent?.voice_name ?? null,
        is_active: agent?.is_active ?? false,
      }
      setAgent(next)
      setProfile({ tone: values.tone, transfer_number: transfer || null, return_policy_url: values.return_policy_url || null })
      onSaved()
    } catch (err) {
      toast.error(commerceErrorMessage(err, SAVE_FAILED))
    } finally {
      setSaving(false)
    }
  }

  const busy = saving || generating !== null

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <StepBody className="space-y-8">
        <Field label="Agent name" htmlFor="agent_name" hint="How the agent introduces itself on the phone." error={errors.name?.message}>
          <Input id="agent_name" placeholder="e.g. Maria, Alex" maxLength={60} autoComplete="off" {...nameField} className="h-11" />
        </Field>

        <div className="grid gap-2">
          <Label id="tone-label">Agent tone</Label>
          <div role="radiogroup" aria-labelledby="tone-label" className="grid grid-cols-2 gap-2">
            {TONES.map((t) => (
              <OptionCard
                key={t.id}
                selected={tone === t.id}
                onSelect={() => form.setValue('tone', t.id, { shouldDirty: true })}
                icon={t.icon}
                title={t.name}
                description={t.desc}
                disabled={saving}
                className="h-full"
              />
            ))}
          </div>
        </div>

        <Field label="Agent language" htmlFor="agent_language" error={errors.language?.message}>
          <FormSelect
            id="agent_language"
            value={language.value}
            onChange={language.onChange}
            options={LANGUAGE_OPTIONS}
            invalid={!!errors.language}
            describedBy={errors.language ? 'agent_language-error' : undefined}
            disabled={saving}
            triggerRef={language.ref}
          />
        </Field>

        <div className="grid gap-8 sm:grid-cols-2">
          {/* Field wires aria-describedby / aria-invalid on a direct Input child. */}
          <Field
            label="Transfer number"
            htmlFor="transfer_number"
            optional
            hint="Where customers who ask for a person are sent. Without a number, the agent takes a note of the request."
            error={errors.transfer_number?.message}
          >
            <Input
              id="transfer_number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+40 712 345 678"
              {...form.register('transfer_number')}
              className="h-11"
            />
          </Field>
          <Field label="Return policy" htmlFor="return_policy_url" optional hint="The agent points customers to this address." error={errors.return_policy_url?.message}>
            <Input
              id="return_policy_url"
              type="url"
              inputMode="url"
              placeholder="https://your-store.com/returns"
              {...form.register('return_policy_url')}
              className="h-11"
            />
          </Field>
        </div>

        <Field
          label="Opening message"
          htmlFor="first_message"
          hint="The first thing the agent says when it calls a customer."
          error={errors.first_message?.message}
          labelAction={
            <Button type="button" variant="ghost" size="xs" onClick={generateGreeting} loading={generating === 'greeting'} loadingText="Generating…" disabled={busy} className="-my-1.5 -mr-2.5">
              <Sparkles aria-hidden="true" />
              Generate
            </Button>
          }
        >
          <Textarea id="first_message" rows={3} {...form.register('first_message')} className="resize-none" />
        </Field>

        <Field
          label="Agent instructions"
          htmlFor="system_prompt"
          hint="Generated from your store profile, in the agent's language; edit anything you like. The {{…}} variables are filled in on every call."
          error={errors.system_prompt?.message}
          labelAction={
            <span className="flex items-center gap-2">
              <span className={cn('text-xs leading-4 tabular-nums', systemPrompt.length > SYSTEM_PROMPT_MAX * 0.9 ? 'text-warning' : 'text-muted-foreground')}>
                {systemPrompt.length.toLocaleString('en-US')}/{SYSTEM_PROMPT_MAX.toLocaleString('en-US')}
              </span>
              <Button type="button" variant="ghost" size="xs" onClick={regeneratePrompt} loading={generating === 'prompt'} loadingText="Generating…" disabled={busy} className="-my-1.5 -mr-2.5">
                <RefreshCw aria-hidden="true" />
                Regenerate
              </Button>
            </span>
          }
        >
          <div className="relative">
            <Textarea id="system_prompt" rows={14} {...form.register('system_prompt')} className="max-h-[480px] resize-none text-[13px] leading-5" />
            {generating === 'initial' && (
              <span className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-xs text-muted-foreground shadow-pill" role="status">
                <OrbInline state="composing" /> Generating…
              </span>
            )}
          </div>
        </Field>
      </StepBody>

      <StepActions>
        <Button type="button" variant="ghost" size="lg" onClick={onBack} disabled={saving}>
          <ArrowLeft aria-hidden="true" />
          Back
        </Button>
        <Button type="submit" size="lg" loading={saving} loadingText="Saving…" disabled={generating === 'initial'} className="ml-auto max-md:flex-1">
          Continue
          <ArrowRight aria-hidden="true" />
        </Button>
      </StepActions>
    </form>
  )
}
