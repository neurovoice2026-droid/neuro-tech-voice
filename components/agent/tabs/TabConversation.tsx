'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, ChevronDown, ChevronUp, Info, Loader2, Play, Sparkles, Square } from 'lucide-react'
import { AdditionalLanguagesField, AsrKeywordsField } from '@/components/agent/ConversationBehaviourFields'
import { useAudioPreview } from '@/hooks/useAudioPreview'
import { readAgentSettings, type AgentHook } from '@/hooks/useAgent'
import { ConversationSettingsSchema } from '@/lib/voice-providers/settings'
import { defaultFallbackMessage } from '@/lib/voice-providers/prompt'
import type { ConversationSettings } from '@/lib/voice-providers/types'
import { cn } from '@/lib/utils'
import type { Agent } from '@/types'

// ─── Shared form primitives (also used by the Availability and Call handling tabs) ──

export function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {children}
    </p>
  )
}

interface SettingSwitchProps {
  id: string
  label: string
  description: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  children?: React.ReactNode
}

/** A labelled switch with its description; `children` render below (e.g. the value it enables). */
export function SettingSwitch({ id, label, description, checked, onCheckedChange, disabled, children }: SettingSwitchProps) {
  const descriptionId = `${id}-description`
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
          <p id={descriptionId} className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value)}
          disabled={disabled}
          aria-describedby={descriptionId}
          className="mt-0.5"
        />
      </div>
      {children}
    </div>
  )
}

interface SaveBarProps {
  dirty: boolean
  saving: boolean
  onSave: () => void
  onDiscard: () => void
  label?: string
  /** Disables saving (e.g. invalid fields) without hiding the bar. */
  blocked?: boolean
}

export function SaveBar({ dirty, saving, onSave, onDiscard, label = 'Save changes', blocked = false }: SaveBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={onSave} disabled={!dirty || saving || blocked} className="purple-glow">
        {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
        {saving ? 'Saving…' : label}
      </Button>
      {dirty && !saving && (
        <Button variant="ghost" onClick={onDiscard}>
          Discard
        </Button>
      )}
      {dirty && (
        <Badge variant="secondary" className="text-xs">Unsaved changes</Badge>
      )}
    </div>
  )
}

/** Parses an integer typed into a text/number input; null when it is not one. */
export function parseInteger(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^-?\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return Number.isSafeInteger(value) ? value : null
}

// ─── Prompt templates ────────────────────────────────────────────────────────

const PROMPT_TEMPLATES = [
  {
    id: 'customer-support',
    label: 'Customer Support',
    prompt: `You are a helpful customer support agent. Your goal is to assist callers with their questions and issues professionally and empathetically. Always listen carefully, acknowledge the caller's concern, and provide clear, actionable solutions. If you cannot resolve an issue, offer to escalate it appropriately.`,
  },
  {
    id: 'appointment-booking',
    label: 'Appointment Booking',
    prompt: `You are an appointment scheduling assistant. Your role is to help callers book, reschedule, or cancel appointments. Be efficient and friendly. Collect the necessary information (name, preferred date/time, reason for visit) and confirm all details before ending the call.`,
  },
  {
    id: 'sales-outreach',
    label: 'Sales Outreach',
    prompt: `You are a professional sales representative. Your goal is to introduce our product/service, understand the caller's needs, and guide them toward a solution that fits. Be consultative rather than pushy. Listen actively, ask qualifying questions, and highlight relevant benefits.`,
  },
  {
    id: 'lead-qualification',
    label: 'Lead Qualification',
    prompt: `You are a lead qualification specialist. Your role is to understand the caller's needs, timeline, and budget to determine if they are a good fit for our services. Ask targeted questions, capture key information, and schedule a follow-up with the appropriate team member if qualified.`,
  },
]

// Same limits as PATCH /api/agent.
const FIRST_MESSAGE_MAX = 1_000
const SYSTEM_PROMPT_MAX = 20_000
const FALLBACK_MESSAGE_MAX = 500
const VOICEMAIL_MESSAGE_MAX = 500
/** Callers cannot interrupt the first message (it carries the AI disclosure): warn above ~20 s of speech. */
const PROTECTED_GREETING_WARN = 300

const EAGERNESS_OPTIONS: Array<{ value: ConversationSettings['turn_eagerness']; label: string; description: string }> = [
  { value: 'patient', label: 'Patient', description: 'Waits a little longer before replying. Good for callers who pause while thinking.' },
  { value: 'normal', label: 'Normal', description: 'Balanced for most conversations.' },
  { value: 'eager', label: 'Eager', description: 'Replies as soon as the caller stops. Snappier, but may cut in.' },
]

// ─── Draft ───────────────────────────────────────────────────────────────────

interface Draft {
  first_message: string
  system_prompt: string
  fallback_message: string
  allow_interruptions: boolean
  turn_timeout: string
  turn_eagerness: ConversationSettings['turn_eagerness']
  silence_enabled: boolean
  silence_seconds: string
  max_duration: string
  allow_end_call: boolean
  voicemail_detection: boolean
  voicemail_message: string
  temperature_enabled: boolean
  temperature: string
  additional_languages: string[]
  asr_keywords: string[]
  soft_timeout_fillers: boolean
  ignore_backchannels: boolean
  skip_turn: boolean
  background_voice_detection: boolean
}

type FieldKey =
  | 'first_message'
  | 'system_prompt'
  | 'fallback_message'
  | 'turn_timeout'
  | 'silence_seconds'
  | 'max_duration'
  | 'voicemail_message'
  | 'temperature'
  | 'additional_languages'
  | 'asr_keywords'
type FieldErrors = Partial<Record<FieldKey, string>>

function draftFrom(agent: Agent): Draft {
  const c = readAgentSettings(agent).conversation
  return {
    first_message: agent.first_message ?? '',
    system_prompt: agent.system_prompt ?? '',
    fallback_message: agent.fallback_message ?? '',
    allow_interruptions: c.allow_interruptions,
    turn_timeout: String(c.turn_timeout_seconds),
    turn_eagerness: c.turn_eagerness,
    silence_enabled: c.silence_end_call_seconds !== null,
    silence_seconds: String(c.silence_end_call_seconds ?? 30),
    max_duration: String(c.max_call_duration_minutes),
    allow_end_call: c.allow_end_call,
    voicemail_detection: c.voicemail_detection,
    voicemail_message: c.voicemail_message ?? '',
    temperature_enabled: c.temperature !== null,
    temperature: String(c.temperature ?? 0.5),
    additional_languages: c.additional_languages.filter((l) => l !== agent.language),
    asr_keywords: c.asr_keywords,
    soft_timeout_fillers: c.soft_timeout_fillers,
    ignore_backchannels: c.ignore_backchannels,
    skip_turn: c.skip_turn,
    background_voice_detection: c.background_voice_detection,
  }
}

const SCHEMA_FIELD: Partial<Record<keyof ConversationSettings, FieldKey>> = {
  turn_timeout_seconds: 'turn_timeout',
  silence_end_call_seconds: 'silence_seconds',
  max_call_duration_minutes: 'max_duration',
  voicemail_message: 'voicemail_message',
  temperature: 'temperature',
  additional_languages: 'additional_languages',
  asr_keywords: 'asr_keywords',
}

/** Builds the full conversation_settings object (keeping fields other tabs own) and validates it. */
function buildSettings(draft: Draft, base: ConversationSettings): { value: ConversationSettings | null; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const range = (raw: string, min: number, max: number, unit: string, key: FieldKey): number => {
    const n = parseInteger(raw)
    if (n === null || n < min || n > max) errors[key] = `Enter a whole number of ${unit} between ${min} and ${max}.`
    return n ?? min
  }

  const turnTimeout = range(draft.turn_timeout, 1, 30, 'seconds', 'turn_timeout')
  const silence = draft.silence_enabled ? range(draft.silence_seconds, 10, 600, 'seconds', 'silence_seconds') : null
  const maxDuration = range(draft.max_duration, 1, 120, 'minutes', 'max_duration')
  let temperature: number | null = null
  if (draft.temperature_enabled) {
    const t = Number(draft.temperature.trim())
    if (!draft.temperature.trim() || !Number.isFinite(t) || t < 0 || t > 1) errors.temperature = 'Enter a value between 0 and 1.'
    else temperature = Math.round(t * 100) / 100
  }
  const voicemailMessage = draft.voicemail_message.trim()
  if (voicemailMessage.length > VOICEMAIL_MESSAGE_MAX) errors.voicemail_message = `Keep it under ${VOICEMAIL_MESSAGE_MAX} characters.`

  if (draft.first_message.length > FIRST_MESSAGE_MAX) errors.first_message = `Keep it under ${FIRST_MESSAGE_MAX.toLocaleString()} characters.`
  if (draft.system_prompt.length > SYSTEM_PROMPT_MAX) errors.system_prompt = `Keep it under ${SYSTEM_PROMPT_MAX.toLocaleString()} characters.`
  if (draft.fallback_message.trim().length > FALLBACK_MESSAGE_MAX) errors.fallback_message = `Keep it under ${FALLBACK_MESSAGE_MAX} characters.`

  const candidate: ConversationSettings = {
    ...base,
    allow_interruptions: draft.allow_interruptions,
    turn_timeout_seconds: turnTimeout,
    turn_eagerness: draft.turn_eagerness,
    silence_end_call_seconds: silence,
    max_call_duration_minutes: maxDuration,
    allow_end_call: draft.allow_end_call,
    voicemail_detection: draft.voicemail_detection,
    voicemail_message: voicemailMessage || null,
    temperature,
    ai_disclosure: true,
    additional_languages: draft.additional_languages,
    asr_keywords: draft.asr_keywords,
    soft_timeout_fillers: draft.soft_timeout_fillers,
    ignore_backchannels: draft.ignore_backchannels,
    skip_turn: draft.skip_turn,
    background_voice_detection: draft.background_voice_detection,
  }
  const parsed = ConversationSettingsSchema.safeParse(candidate)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = SCHEMA_FIELD[issue.path[0] as keyof ConversationSettings]
      if (key && !errors[key]) errors[key] = issue.message
    }
    if (Object.keys(errors).length === 0) errors.max_duration = 'Some settings are invalid.'
  }
  return { value: Object.keys(errors).length === 0 && parsed.success ? (parsed.data as ConversationSettings) : null, errors }
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

interface TabConversationProps {
  agent: Agent
  onUpdate: AgentHook['updateWithToast']
  isSaving: boolean
}

const PREVIEW_ID = 'first-message'

export function TabConversation({ agent, onUpdate, isSaving }: TabConversationProps) {
  const saved = useMemo(() => draftFrom(agent), [agent])
  const [draft, setDraft] = useState<Draft>(saved)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const preview = useAudioPreview()

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const { value, errors } = buildSettings(draft, readAgentSettings(agent).conversation)
  const visibleErrors: FieldErrors = showErrors ? errors : {}

  const set = <K extends keyof Draft>(key: K, v: Draft[K]) => setDraft((d) => ({ ...d, [key]: v }))

  const handleSave = async () => {
    if (!value) {
      setShowErrors(true)
      return
    }
    preview.stop()
    const next = await onUpdate(
      {
        first_message: draft.first_message,
        system_prompt: draft.system_prompt,
        fallback_message: draft.fallback_message.trim() || null,
        conversation_settings: value,
      },
      'Conversation settings saved',
    )
    if (next) {
      setDraft(draftFrom(next))
      setShowErrors(false)
    }
  }

  const discard = () => {
    setDraft(saved)
    setShowErrors(false)
  }

  const previewStatus = preview.statusFor(PREVIEW_ID)
  const togglePreview = () => {
    if (!agent.voice_id || !draft.first_message.trim()) return
    preview.toggle(PREVIEW_ID, {
      kind: 'request',
      url: '/api/agent/preview-voice',
      method: 'POST',
      body: { text: draft.first_message, voice_id: agent.voice_id, language: agent.language },
    })
  }

  const errorProps = (key: FieldKey) =>
    visibleErrors[key] ? { 'aria-invalid': true as const, 'aria-describedby': `conv-${key}-error` } : {}

  return (
    <div className="space-y-6">
      {/* First Message */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">First message</CardTitle>
          <CardDescription>
            What your agent says when a call connects. Keep it under 30 words.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="conv-first-message" className="sr-only">First message</Label>
          <Textarea
            id="conv-first-message"
            value={draft.first_message}
            onChange={(e) => set('first_message', e.target.value)}
            placeholder="Hello! Thank you for calling. How can I help you today?"
            rows={3}
            maxLength={FIRST_MESSAGE_MAX}
            className="resize-none"
            {...errorProps('first_message')}
          />
          {visibleErrors.first_message && <FieldError id="conv-first_message-error">{visibleErrors.first_message}</FieldError>}
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              The platform always adds a short AI disclosure to this greeting, plus a recording notice when it is
              enabled under Call handling → Privacy. Callers cannot interrupt the greeting, so the disclosure is always
              heard in full; what they say meanwhile is kept for the next turn.
            </span>
          </p>
          {draft.first_message.trim().length > PROTECTED_GREETING_WARN && (
            <p role="status" className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                This greeting is long. Callers have to listen to all of it before they can speak, so keep it under about
                {` ${PROTECTED_GREETING_WARN}`} characters.
              </span>
            </p>
          )}
          {agent.voice_id && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={togglePreview}
              disabled={!draft.first_message.trim()}
              aria-label={previewStatus === 'idle' ? 'Preview the first message with your voice' : 'Stop the preview'}
            >
              {previewStatus === 'loading' ? (
                <><Loader2 className="size-3 mr-1.5 animate-spin" aria-hidden="true" /> Loading…</>
              ) : previewStatus === 'playing' ? (
                <><Square className="size-3 mr-1.5" aria-hidden="true" /> Stop preview</>
              ) : (
                <><Play className="size-3 mr-1.5" aria-hidden="true" /> Preview with voice</>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">System prompt</CardTitle>
          <CardDescription>
            Instructions that define your agent&apos;s role, goals, and constraints.
          </CardDescription>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTemplates((v) => !v)}
              aria-expanded={showTemplates}
              aria-controls="conv-templates"
            >
              <Sparkles className="size-3.5 mr-1.5" aria-hidden="true" />
              Templates
              {showTemplates ? <ChevronUp className="size-3.5 ml-1" aria-hidden="true" /> : <ChevronDown className="size-3.5 ml-1" aria-hidden="true" />}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {showTemplates && (
            <div id="conv-templates" className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg bg-muted/50 border">
              {PROMPT_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    set('system_prompt', t.prompt)
                    setShowTemplates(false)
                  }}
                  className="text-left px-3 py-2 rounded-md hover:bg-accent text-sm border border-transparent hover:border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          )}
          <Label htmlFor="conv-system-prompt" className="sr-only">System prompt</Label>
          <Textarea
            id="conv-system-prompt"
            value={draft.system_prompt}
            onChange={(e) => set('system_prompt', e.target.value)}
            placeholder="You are a helpful AI assistant for Acme Corp. Your role is to..."
            rows={10}
            className="font-mono text-sm resize-y"
            {...errorProps('system_prompt')}
          />
          {visibleErrors.system_prompt && <FieldError id="conv-system_prompt-error">{visibleErrors.system_prompt}</FieldError>}
          <p className={cn('text-xs text-right', draft.system_prompt.length > SYSTEM_PROMPT_MAX ? 'text-destructive' : 'text-muted-foreground')}>
            {draft.system_prompt.length.toLocaleString()} / {SYSTEM_PROMPT_MAX.toLocaleString()} characters
          </p>
          <p className="text-xs text-muted-foreground">
            Safety, privacy and AI-disclosure rules are always added after your prompt and take precedence over it.
          </p>
        </CardContent>
      </Card>

      {/* Conversational fallback phrase */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fallback phrase</CardTitle>
          <CardDescription>
            Said when the agent doesn&apos;t understand or can&apos;t help. This is not the provider fallback (backup voice agent).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="conv-fallback" className="sr-only">Fallback phrase</Label>
          <Textarea
            id="conv-fallback"
            value={draft.fallback_message}
            onChange={(e) => set('fallback_message', e.target.value)}
            placeholder={defaultFallbackMessage(agent.language)}
            rows={2}
            maxLength={FALLBACK_MESSAGE_MAX}
            className="resize-none"
            {...errorProps('fallback_message')}
          />
          {visibleErrors.fallback_message && <FieldError id="conv-fallback_message-error">{visibleErrors.fallback_message}</FieldError>}
          <p className="text-xs text-muted-foreground">
            Leave blank to use the default phrase in your agent&apos;s language (shown above).
          </p>
        </CardContent>
      </Card>

      {/* Conversation settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation settings</CardTitle>
          <CardDescription>How your agent takes turns, handles silence and ends calls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SettingSwitch
            id="conv-interruptions"
            label="Allow interruptions"
            description="Callers can interrupt the agent mid-sentence."
            checked={draft.allow_interruptions}
            onCheckedChange={(v) => set('allow_interruptions', v)}
          />

          <SettingSwitch
            id="conv-backchannels"
            label="Ignore short acknowledgements"
            description={
              draft.allow_interruptions
                ? 'Words like “mhm”, “ok” or “da” said while the agent talks do not interrupt it.'
                : 'Only applies when interruptions are allowed.'
            }
            checked={draft.ignore_backchannels}
            onCheckedChange={(v) => set('ignore_backchannels', v)}
            disabled={!draft.allow_interruptions}
          />

          <SettingSwitch
            id="conv-fillers"
            label="Fill pauses while looking things up"
            description="When an answer takes more than 3 seconds, the agent says a short “One moment, please.” in the caller’s language instead of staying silent."
            checked={draft.soft_timeout_fillers}
            onCheckedChange={(v) => set('soft_timeout_fillers', v)}
          />

          <SettingSwitch
            id="conv-skip-turn"
            label="Wait when the caller asks for a moment"
            description="If the caller says “one second, let me check”, the agent waits quietly (up to 20 seconds) and then checks in, instead of talking over them or hanging up."
            checked={draft.skip_turn}
            onCheckedChange={(v) => set('skip_turn', v)}
          />

          <SettingSwitch
            id="conv-background-voices"
            label="Filter background voices"
            description="Ignore voices in the background (TV, other people) so they do not trigger the agent. Useful when callers phone from shops or cars; may miss very quiet callers."
            checked={draft.background_voice_detection}
            onCheckedChange={(v) => set('background_voice_detection', v)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="conv-eagerness">Turn eagerness</Label>
              <Select
                value={draft.turn_eagerness}
                onValueChange={(v) => v && set('turn_eagerness', v as ConversationSettings['turn_eagerness'])}
              >
                <SelectTrigger id="conv-eagerness" className="w-full">
                  <SelectValue>
                    {(v: string) => EAGERNESS_OPTIONS.find((o) => o.value === v)?.label ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EAGERNESS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {EAGERNESS_OPTIONS.find((o) => o.value === draft.turn_eagerness)?.description}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="conv-turn-timeout">Re-prompt after silence (seconds)</Label>
              <Input
                id="conv-turn-timeout"
                type="number"
                inputMode="numeric"
                min={1}
                max={30}
                step={1}
                value={draft.turn_timeout}
                onChange={(e) => set('turn_timeout', e.target.value)}
                className="w-28"
                {...errorProps('turn_timeout')}
              />
              {visibleErrors.turn_timeout ? (
                <FieldError id="conv-turn_timeout-error">{visibleErrors.turn_timeout}</FieldError>
              ) : (
                <p className="text-xs text-muted-foreground">1–30 s. How long the agent waits before checking in.</p>
              )}
            </div>
          </div>

          <SettingSwitch
            id="conv-silence"
            label="End call after silence"
            description="Hang up when the caller has said nothing for a while."
            checked={draft.silence_enabled}
            onCheckedChange={(v) => set('silence_enabled', v)}
          >
            {draft.silence_enabled && (
              <div className="flex flex-wrap items-center gap-2 pl-0.5">
                <Label htmlFor="conv-silence-seconds" className="text-xs text-muted-foreground">After</Label>
                <Input
                  id="conv-silence-seconds"
                  type="number"
                  inputMode="numeric"
                  min={10}
                  max={600}
                  step={5}
                  value={draft.silence_seconds}
                  onChange={(e) => set('silence_seconds', e.target.value)}
                  className="h-8 w-24"
                  {...errorProps('silence_seconds')}
                />
                <span className="text-xs text-muted-foreground">seconds (10–600)</span>
                {visibleErrors.silence_seconds && <FieldError id="conv-silence_seconds-error">{visibleErrors.silence_seconds}</FieldError>}
              </div>
            )}
          </SettingSwitch>

          <div className="space-y-1.5">
            <Label htmlFor="conv-max-duration">Maximum call duration (minutes)</Label>
            <Input
              id="conv-max-duration"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              step={1}
              value={draft.max_duration}
              onChange={(e) => set('max_duration', e.target.value)}
              className="w-28"
              {...errorProps('max_duration')}
            />
            {visibleErrors.max_duration ? (
              <FieldError id="conv-max_duration-error">{visibleErrors.max_duration}</FieldError>
            ) : (
              <p className="text-xs text-muted-foreground">1–120 minutes. Calls are ended politely when the limit is reached.</p>
            )}
          </div>

          <SettingSwitch
            id="conv-end-call"
            label="Let the agent end calls"
            description="The agent can hang up once the caller has said goodbye or has nothing else to ask."
            checked={draft.allow_end_call}
            onCheckedChange={(v) => set('allow_end_call', v)}
          />

          <SettingSwitch
            id="conv-voicemail"
            label="Voicemail detection (outgoing calls)"
            description="On calls your agent places, detect an answering machine and leave a message (or hang up). Never used on incoming calls."
            checked={draft.voicemail_detection}
            onCheckedChange={(v) => set('voicemail_detection', v)}
          >
            {draft.voicemail_detection && (
              <div className="space-y-1.5">
                <Label htmlFor="conv-voicemail-message" className="text-xs text-muted-foreground">
                  Voicemail message (optional)
                </Label>
                <Textarea
                  id="conv-voicemail-message"
                  value={draft.voicemail_message}
                  onChange={(e) => set('voicemail_message', e.target.value)}
                  placeholder="Hi, this is the assistant from Acme. Please call us back at your convenience."
                  rows={2}
                  maxLength={VOICEMAIL_MESSAGE_MAX}
                  className="resize-none"
                  {...errorProps('voicemail_message')}
                />
                {visibleErrors.voicemail_message ? (
                  <FieldError id="conv-voicemail_message-error">{visibleErrors.voicemail_message}</FieldError>
                ) : (
                  <p className="text-xs text-muted-foreground">Leave blank to hang up without leaving a message.</p>
                )}
              </div>
            )}
          </SettingSwitch>

          <SettingSwitch
            id="conv-temperature"
            label="Custom response creativity"
            description="Lower values give more consistent answers, higher values more varied ones. Off uses the default (0, the most consistent answers)."
            checked={draft.temperature_enabled}
            onCheckedChange={(v) => set('temperature_enabled', v)}
          >
            {draft.temperature_enabled && (
              <div className="flex flex-wrap items-center gap-3">
                <Label htmlFor="conv-temperature-value" className="text-xs text-muted-foreground">Temperature</Label>
                <input
                  aria-label="Temperature slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={Number.isFinite(Number(draft.temperature)) ? Number(draft.temperature) : 0.5}
                  onChange={(e) => set('temperature', e.target.value)}
                  className="w-40 accent-primary"
                />
                <Input
                  id="conv-temperature-value"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={1}
                  step={0.05}
                  value={draft.temperature}
                  onChange={(e) => set('temperature', e.target.value)}
                  className="h-8 w-20"
                  {...errorProps('temperature')}
                />
                {visibleErrors.temperature && <FieldError id="conv-temperature-error">{visibleErrors.temperature}</FieldError>}
              </div>
            )}
          </SettingSwitch>
        </CardContent>
      </Card>

      {/* Languages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Additional languages</CardTitle>
          <CardDescription>Let your agent switch to the caller&apos;s language. Each language gets its own greeting with the AI disclosure.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdditionalLanguagesField
            primary={agent.language}
            value={draft.additional_languages}
            onChange={(next) => set('additional_languages', next)}
            error={visibleErrors.additional_languages}
          />
        </CardContent>
      </Card>

      {/* Speech recognition */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Speech recognition</CardTitle>
          <CardDescription>Help the agent hear names correctly.</CardDescription>
        </CardHeader>
        <CardContent>
          <AsrKeywordsField value={draft.asr_keywords} onChange={(next) => set('asr_keywords', next)} error={visibleErrors.asr_keywords} />
        </CardContent>
      </Card>

      <SaveBar
        dirty={isDirty}
        saving={isSaving}
        onSave={() => void handleSave()}
        onDiscard={discard}
        blocked={showErrors && !value}
      />
      {showErrors && !value && (
        <p role="status" className="text-xs text-destructive">Fix the highlighted fields to save.</p>
      )}
    </div>
  )
}
