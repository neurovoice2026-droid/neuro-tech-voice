'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { UpgradeNotice } from '@/components/shared/UpgradeNotice'
import { buildIndustrySystemPrompt } from '@/lib/agent-prompts'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { defaultFallbackMessage, defaultNotInDocumentsMessage } from '@/lib/voice/prompt'
import { baseLanguage } from '@/lib/voice/languages'
import { requiredPlanFor } from '@/lib/billing/entitlements'
import { cn } from '@/lib/utils'
import { GreetingCard, GREETING_MAX, type GreetingMode } from '@/components/agent/GreetingCard'
import { KeytermsInput } from '@/components/agent/KeytermsInput'
import { SaveBar } from '@/components/agent/SaveBar'
import { isAutomaticGreeting } from '@/components/agent/greeting'
import type { AgentPatch, AgentSettingsContext, AgentUpdate } from '@/components/agent/types'
import type { Agent, BehaviorSettings } from '@/types'

const PROMPT_MAX = 8000
const LINE_MAX = 300

// Same defaults the call pipeline applies (lib/voice/session.ts behaviorFor).
const DEFAULT_BEHAVIOR: BehaviorSettings = {
  allow_interruptions: true,
  auto_end_call: true,
  auto_end_silence_seconds: 10,
  max_call_duration_enabled: false,
  max_call_duration_minutes: 30,
  record_calls: true,
  voicemail_detection: true,
}
const SILENCE_MIN = 5
const SILENCE_MAX = 120
const DURATION_MIN = 1
const DURATION_MAX = 60

// Keyterms bias recognition only on the Ink models that accept them.
const KEYTERM_LANGUAGES = new Set(['en', 'es', 'fr', 'hi', 'ja'])

const GENERIC_TEMPLATES = [
  {
    id: 'customer-support',
    label: 'Customer support',
    prompt:
      'You help callers with questions about our products and services. Listen carefully, acknowledge the caller’s concern, and give clear, practical answers. If you can’t resolve something, take a message so the right person can follow up.',
  },
  {
    id: 'appointment-booking',
    label: 'Appointment booking',
    prompt:
      'You help callers book, move and cancel appointments. Ask which service they need and when suits them, offer the available times, and confirm the date, time and their name before booking. Keep it quick and friendly.',
  },
  {
    id: 'sales',
    label: 'Sales enquiries',
    prompt:
      'You answer enquiries from potential customers. Find out what they need, explain how we can help in plain words, and offer a next step: a booking, a callback or more information by message. Be helpful, never pushy.',
  },
  {
    id: 'lead-qualification',
    label: 'Lead qualification',
    prompt:
      'You speak with new enquiries. Understand what they are looking for, their timing and budget, and whether we are a good fit. Capture their details and let them know when and how the team will follow up.',
  },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * Exactly the seven stored fields with defaults filled in and numbers brought
 * into today's range (the old editor allowed 3 s silence and 120-minute calls),
 * matching what the call pipeline applies.
 */
function readBehavior(agent: Agent): BehaviorSettings {
  const raw = agent.metadata?.behavior_settings
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof BehaviorSettings, unknown>>
  const silence = Number(s.auto_end_silence_seconds)
  const minutes = Number(s.max_call_duration_minutes)
  return {
    allow_interruptions: bool(s.allow_interruptions, DEFAULT_BEHAVIOR.allow_interruptions),
    auto_end_call: bool(s.auto_end_call, DEFAULT_BEHAVIOR.auto_end_call),
    auto_end_silence_seconds: Number.isFinite(silence) ? clamp(silence, SILENCE_MIN, SILENCE_MAX) : DEFAULT_BEHAVIOR.auto_end_silence_seconds,
    max_call_duration_enabled: bool(s.max_call_duration_enabled, DEFAULT_BEHAVIOR.max_call_duration_enabled),
    max_call_duration_minutes: Number.isFinite(minutes) ? clamp(minutes, DURATION_MIN, DURATION_MAX) : DEFAULT_BEHAVIOR.max_call_duration_minutes,
    record_calls: bool(s.record_calls, DEFAULT_BEHAVIOR.record_calls),
    voicemail_detection: bool(s.voicemail_detection, DEFAULT_BEHAVIOR.voicemail_detection),
  }
}

function readNotInDocs(agent: Agent): string {
  const value = agent.metadata?.not_in_documents_message
  return typeof value === 'string' ? value : ''
}

function industryLabel(industry: string | null): string | null {
  if (!industry || industry === 'other') return null
  return industry.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

interface TabConversationProps extends AgentSettingsContext {
  agent: Agent
  onUpdate: AgentUpdate
  isSaving: boolean
  onDirtyChange?: (dirty: boolean) => void
}

export function TabConversation({ agent, org, entitlements, onUpdate, isSaving, onDirtyChange }: TabConversationProps) {
  const saved = useMemo(
    () => ({
      greetingMode: (isAutomaticGreeting(agent, org.name) ? 'auto' : 'custom') as GreetingMode,
      greetingText: agent.first_message ?? '',
      recordingNotice: agent.recording_notice,
      fallback: agent.fallback_message ?? '',
      notInDocs: readNotInDocs(agent),
      prompt: agent.system_prompt ?? '',
      behavior: readBehavior(agent),
      keyterms: agent.keyterms ?? [],
    }),
    [agent, org.name]
  )

  const [greetingMode, setGreetingMode] = useState<GreetingMode>(saved.greetingMode)
  const [greetingText, setGreetingText] = useState(saved.greetingMode === 'custom' ? saved.greetingText : '')
  const [recordingNotice, setRecordingNotice] = useState(saved.recordingNotice)
  const [fallback, setFallback] = useState(saved.fallback)
  const [notInDocs, setNotInDocs] = useState(saved.notInDocs)
  const [prompt, setPrompt] = useState(saved.prompt)
  const [behavior, setBehavior] = useState<BehaviorSettings>(saved.behavior)
  // Number fields keep what is typed; validated below.
  const [silenceInput, setSilenceInput] = useState(String(saved.behavior.auto_end_silence_seconds))
  const [durationInput, setDurationInput] = useState(String(saved.behavior.max_call_duration_minutes))
  const [keyterms, setKeyterms] = useState<string[]>(saved.keyterms)
  const [showTemplates, setShowTemplates] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState<{ label: string; prompt: string } | null>(null)

  const recordsCalls = entitlements.recordings && behavior.record_calls
  const language = baseLanguage(agent.language)
  const languageLabel = AGENT_LANGUAGES.find((l) => l.value === language)?.label ?? language

  const silence = Number(silenceInput)
  const duration = Number(durationInput)
  const silenceError =
    behavior.auto_end_call && (!Number.isInteger(silence) || silence < SILENCE_MIN || silence > SILENCE_MAX)
      ? `Use a whole number of seconds from ${SILENCE_MIN} to ${SILENCE_MAX}.`
      : null
  const durationError =
    behavior.max_call_duration_enabled && (!Number.isInteger(duration) || duration < DURATION_MIN || duration > DURATION_MAX)
      ? `Use a whole number of minutes from ${DURATION_MIN} to ${DURATION_MAX}.`
      : null

  // A number that is switched off or not valid yet keeps its saved value.
  const effectiveBehavior: BehaviorSettings = {
    ...behavior,
    auto_end_silence_seconds: silenceError || !Number.isInteger(silence) ? saved.behavior.auto_end_silence_seconds : silence,
    max_call_duration_minutes: durationError || !Number.isInteger(duration) ? saved.behavior.max_call_duration_minutes : duration,
  }

  // A "custom" greeting that is word for word the generated one is stored and
  // read back as automatic (it follows tone and language changes), so compare
  // and save it as automatic too; otherwise the tab would stay unsaved forever.
  const effectiveGreetingMode: GreetingMode =
    greetingMode === 'custom' && greetingText.trim() && isAutomaticGreeting({ ...agent, first_message: greetingText }, org.name)
      ? 'auto'
      : greetingMode
  const greetingDirty =
    effectiveGreetingMode !== saved.greetingMode ||
    (effectiveGreetingMode === 'custom' && greetingText.trim() !== saved.greetingText.trim())

  const dirty =
    greetingDirty ||
    recordingNotice !== saved.recordingNotice ||
    fallback.trim() !== saved.fallback.trim() ||
    notInDocs.trim() !== saved.notInDocs.trim() ||
    prompt !== saved.prompt ||
    JSON.stringify(effectiveBehavior) !== JSON.stringify(saved.behavior) ||
    silenceInput !== String(saved.behavior.auto_end_silence_seconds) ||
    durationInput !== String(saved.behavior.max_call_duration_minutes) ||
    JSON.stringify(keyterms) !== JSON.stringify(saved.keyterms)

  const invalidMessage =
    (greetingMode === 'custom' && !greetingText.trim()
      ? 'Write your greeting or switch back to Automatic.'
      : greetingMode === 'custom' && greetingText.length > GREETING_MAX
        ? `Keep the greeting under ${GREETING_MAX} characters.`
        : null) ??
    (fallback.length > LINE_MAX || notInDocs.length > LINE_MAX ? `Keep each fallback line under ${LINE_MAX} characters.` : null) ??
    (prompt.length > PROMPT_MAX ? `Keep the instructions under ${PROMPT_MAX.toLocaleString()} characters.` : null) ??
    silenceError ??
    durationError

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const discard = () => {
    setGreetingMode(saved.greetingMode)
    setGreetingText(saved.greetingMode === 'custom' ? saved.greetingText : '')
    setRecordingNotice(saved.recordingNotice)
    setFallback(saved.fallback)
    setNotInDocs(saved.notInDocs)
    setPrompt(saved.prompt)
    setBehavior(saved.behavior)
    setSilenceInput(String(saved.behavior.auto_end_silence_seconds))
    setDurationInput(String(saved.behavior.max_call_duration_minutes))
    setKeyterms(saved.keyterms)
  }

  const save = async () => {
    if (invalidMessage) return
    const payload: AgentPatch = {
      recording_notice: recordingNotice,
      fallback_message: fallback.trim(),
      system_prompt: prompt,
      keyterms,
      // Only the keys this tab owns; the server merges metadata per key.
      metadata: {
        behavior_settings: effectiveBehavior,
        not_in_documents_message: notInDocs.trim(),
      },
    }
    if (greetingDirty) payload.first_message = effectiveGreetingMode === 'auto' ? '' : greetingText.trim()
    const ok = await onUpdate(payload, 'Conversation settings saved')
    if (ok) {
      setFallback((v) => v.trim())
      setNotInDocs((v) => v.trim())
      setGreetingText((v) => v.trim())
      setSilenceInput(String(effectiveBehavior.auto_end_silence_seconds))
      setDurationInput(String(effectiveBehavior.max_call_duration_minutes))
    }
  }

  const templates = [
    ...(industryLabel(org.industry)
      ? [
          {
            id: 'industry',
            label: `${industryLabel(org.industry)} (your industry)`,
            prompt: buildIndustrySystemPrompt({ name: org.name ?? '', description: org.description, industry: org.industry }),
          },
        ]
      : []),
    ...GENERIC_TEMPLATES,
  ]

  const chooseTemplate = (template: { label: string; prompt: string }) => {
    if (prompt.trim() && prompt.trim() !== template.prompt.trim()) {
      setPendingTemplate(template)
      return
    }
    setPrompt(template.prompt)
    setShowTemplates(false)
  }

  const setBehaviorField = <K extends keyof BehaviorSettings>(key: K, value: BehaviorSettings[K]) =>
    setBehavior((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="space-y-6">
      <GreetingCard
        agent={agent}
        org={org}
        mode={greetingMode}
        onModeChange={setGreetingMode}
        customText={greetingText}
        onCustomTextChange={setGreetingText}
        recordingNotice={recordingNotice}
        onRecordingNoticeChange={setRecordingNotice}
        recordsCalls={recordsCalls}
        onUpdate={onUpdate}
        isSaving={isSaving}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">When your agent can’t help</CardTitle>
          <CardDescription>
            The exact words your agent uses. Leave a line empty to use the default in {languageLabel}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="fallback-message">When it doesn’t understand the caller</Label>
            <Textarea
              id="fallback-message"
              value={fallback}
              onChange={(e) => setFallback(e.target.value)}
              placeholder={defaultFallbackMessage(language)}
              rows={2}
              className="resize-none"
              aria-describedby="fallback-message-count"
            />
            <p id="fallback-message-count" className={cn('text-right text-xs', fallback.length > LINE_MAX ? 'text-destructive' : 'text-muted-foreground')}>
              {fallback.length}/{LINE_MAX}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="not-in-docs-message">When the answer isn’t in your documents</Label>
            <Textarea
              id="not-in-docs-message"
              value={notInDocs}
              onChange={(e) => setNotInDocs(e.target.value)}
              placeholder={defaultNotInDocumentsMessage(language)}
              rows={2}
              className="resize-none"
              aria-describedby="not-in-docs-help"
            />
            <p id="not-in-docs-help" className={cn('flex justify-between gap-2 text-xs', notInDocs.length > LINE_MAX ? 'text-destructive' : 'text-muted-foreground')}>
              <span>Your agent never guesses: if your documents don’t cover a question, it says this.</span>
              <span className="shrink-0">
                {notInDocs.length}/{LINE_MAX}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Instructions</CardTitle>
            <CardDescription className="mt-1">
              What your agent should know and do for your business. Safety rules, the AI disclosure and language rules are
              added for you.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowTemplates((v) => !v)}
            aria-expanded={showTemplates}
            aria-controls="prompt-templates"
          >
            <Sparkles aria-hidden="true" />
            Templates
            {showTemplates ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showTemplates && (
            <div id="prompt-templates" className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/50 p-2 sm:grid-cols-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => chooseTemplate(t)}
                  className="rounded-md border border-transparent px-3 py-2 text-left text-sm outline-none transition-colors hover:border-border hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          )}
          <Label htmlFor="system-prompt" className="sr-only">
            Instructions
          </Label>
          <Textarea
            id="system-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. We are a family dental clinic in Cluj. Check-ups take 30 minutes. We don't do orthodontics..."
            rows={10}
            className="resize-y text-sm leading-relaxed"
            aria-describedby="system-prompt-count"
          />
          <p id="system-prompt-count" className={cn('text-right text-xs', prompt.length > PROMPT_MAX ? 'text-destructive' : 'text-muted-foreground')}>
            {prompt.length.toLocaleString()}/{PROMPT_MAX.toLocaleString()} characters
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Call behaviour</CardTitle>
          <CardDescription>How your agent handles the flow of a call.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <BehaviorRow
            id="allow-interruptions"
            label="Let callers interrupt"
            description="Your agent stops talking as soon as the caller speaks."
            checked={behavior.allow_interruptions}
            onCheckedChange={(v) => setBehaviorField('allow_interruptions', v)}
          />
          <BehaviorRow
            id="auto-end-call"
            label="End the call after silence"
            description="If the caller goes quiet, your agent checks in once, then says goodbye."
            checked={behavior.auto_end_call}
            onCheckedChange={(v) => setBehaviorField('auto_end_call', v)}
          >
            {behavior.auto_end_call && (
              <NumberField
                id="silence-seconds"
                label="Seconds of silence"
                value={silenceInput}
                onChange={setSilenceInput}
                min={SILENCE_MIN}
                max={SILENCE_MAX}
                error={silenceError}
              />
            )}
          </BehaviorRow>
          <BehaviorRow
            id="max-duration"
            label="Limit call length"
            description="Your agent wraps up politely shortly before the limit. Calls never run longer than 60 minutes."
            checked={behavior.max_call_duration_enabled}
            onCheckedChange={(v) => setBehaviorField('max_call_duration_enabled', v)}
          >
            {behavior.max_call_duration_enabled && (
              <NumberField
                id="max-duration-minutes"
                label="Minutes"
                value={durationInput}
                onChange={setDurationInput}
                min={DURATION_MIN}
                max={DURATION_MAX}
                error={durationError}
              />
            )}
          </BehaviorRow>
          <BehaviorRow
            id="record-calls"
            label="Record calls"
            description="Recordings appear on each call so you can listen back. Callers hear a recording notice."
            checked={entitlements.recordings && behavior.record_calls}
            onCheckedChange={(v) => setBehaviorField('record_calls', v)}
            disabled={!entitlements.recordings}
          >
            {!entitlements.recordings && (
              <UpgradeNotice compact feature="Call recordings" requiredPlan={requiredPlanFor('recordings')} className="mt-2" />
            )}
          </BehaviorRow>
          <BehaviorRow
            id="voicemail-detection"
            label="Detect voicemail on calls your agent makes"
            description="When an outgoing call reaches voicemail, your agent hangs up instead of talking to the machine."
            checked={behavior.voicemail_detection}
            onCheckedChange={(v) => setBehaviorField('voicemail_detection', v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Words to recognise</CardTitle>
          <CardDescription>
            Names callers might say that are easy to mishear: your business, products, services, staff or street names.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <KeytermsInput value={keyterms} onChange={setKeyterms} describedBy="keyterms-help" />
          <p id="keyterms-help" className="text-xs text-muted-foreground">
            {KEYTERM_LANGUAGES.has(language)
              ? 'Your agent listens for these words during calls.'
              : `Used for English, Spanish, French, Hindi and Japanese calls. ${languageLabel} calls don’t use this list yet, but it’s kept for when they do.`}
          </p>
        </CardContent>
      </Card>

      <SaveBar dirty={dirty} saving={isSaving} invalidMessage={invalidMessage} onSave={save} onDiscard={discard} />

      <Dialog open={pendingTemplate !== null} onOpenChange={(open) => !open && setPendingTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace your instructions?</DialogTitle>
            <DialogDescription>
              The “{pendingTemplate?.label}” template will replace what you’ve written. You can still discard before saving.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingTemplate(null)}>
              Keep mine
            </Button>
            <Button
              onClick={() => {
                if (pendingTemplate) setPrompt(pendingTemplate.prompt)
                setPendingTemplate(null)
                setShowTemplates(false)
              }}
            >
              Use template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BehaviorRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  children,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
  disabled?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor={id} className="text-sm font-medium">
            {label}
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="mt-0.5" />
      </div>
      {children}
    </div>
  )
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  min: number
  max: number
  error: string | null
}) {
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </Label>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-8 w-20"
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
