'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Briefcase, Coffee, Globe2, HeartHandshake, Landmark, Moon, Phone, PhoneCall, Smile, Zap,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { TONE_PROFILES } from '@/lib/voice/tone'
import { cn } from '@/lib/utils'
import { isAlwaysOpen, normalizeWorkingHours, validateWorkingHours } from '@/app/api/scheduling/hours'
import { timeZoneOffsetLabel } from '@/app/api/settings/timezone'
import { WorkingHoursEditor } from '@/components/agent/WorkingHoursEditor'
import { SaveBar } from '@/components/agent/SaveBar'
import { isAutomaticGreeting } from '@/components/agent/greeting'
import type { AgentOrgSummary, AgentPatch, AgentUpdate, LinkedPhoneNumber } from '@/components/agent/types'
import { AGENT_LIMITS } from '@/lib/voice/sync/limits'
import { AGENT_TONES, type Agent, type AgentTone, type OutsideHoursConfig, type WorkingHours } from '@/types'

const TONE_ICONS: Record<AgentTone, LucideIcon> = {
  formal: Landmark,
  professional: Briefcase,
  empathetic: HeartHandshake,
  casual: Coffee,
  friendly: Smile,
  energetic: Zap,
}

const NAME_MAX = AGENT_LIMITS.name
const OUTSIDE_MESSAGE_MAX = AGENT_LIMITS.scheduleMessage

type OutsideType = 'always_answer' | 'message'

interface OutsideHoursDraft {
  type: OutsideType
  message: string
  notify_email: string
}

function readOutsideHours(metadata: Agent['metadata']): OutsideHoursDraft {
  const raw = (metadata?.outside_hours ?? {}) as Partial<OutsideHoursConfig>
  return {
    // Only "play a message" is honoured by the call router; anything else answers.
    type: raw.type === 'message' ? 'message' : 'always_answer',
    message: typeof raw.message === 'string' ? raw.message : '',
    notify_email: typeof raw.notify_email === 'string' ? raw.notify_email : '',
  }
}

interface TabGeneralProps {
  agent: Agent
  org: AgentOrgSummary
  phoneNumbers: LinkedPhoneNumber[]
  onUpdate: AgentUpdate
  isSaving: boolean
  onDirtyChange?: (dirty: boolean) => void
}

export function TabGeneral({ agent, org, phoneNumbers, onUpdate, isSaving, onDirtyChange }: TabGeneralProps) {
  const saved = useMemo(
    () => ({
      name: agent.name ?? '',
      language: agent.language,
      tone: agent.tone,
      hours: normalizeWorkingHours(agent.working_hours),
      outside: readOutsideHours(agent.metadata),
    }),
    [agent.name, agent.language, agent.tone, agent.working_hours, agent.metadata]
  )

  const [name, setName] = useState(saved.name)
  const [language, setLanguage] = useState(saved.language)
  const [tone, setTone] = useState<AgentTone>(saved.tone)
  const [hours, setHours] = useState<WorkingHours>(saved.hours)
  const [outside, setOutside] = useState<OutsideHoursDraft>(saved.outside)
  const toneRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const hoursErrors = validateWorkingHours(hours)
  const nameError = !name.trim() ? 'Give your agent a name.' : name.trim().length > NAME_MAX ? `Keep the name under ${NAME_MAX} characters.` : null
  const outsideError =
    outside.type === 'message' && !outside.message.trim()
      ? 'Write the message callers hear outside your hours.'
      : outside.message.length > OUTSIDE_MESSAGE_MAX
        ? `Keep the message under ${OUTSIDE_MESSAGE_MAX} characters.`
        : null

  const dirty =
    name.trim() !== saved.name ||
    language !== saved.language ||
    tone !== saved.tone ||
    JSON.stringify(hours) !== JSON.stringify(saved.hours) ||
    outside.type !== saved.outside.type ||
    outside.message.trim() !== saved.outside.message.trim()

  const invalidMessage =
    nameError ?? (Object.keys(hoursErrors).length > 0 ? 'Fix the opening hours marked in red.' : null) ?? outsideError

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const discard = () => {
    setName(saved.name)
    setLanguage(saved.language)
    setTone(saved.tone)
    setHours(saved.hours)
    setOutside(saved.outside)
  }

  const save = async () => {
    if (invalidMessage) return
    const trimmedName = name.trim()
    const payload: AgentPatch = {
      name: trimmedName,
      language,
      tone,
      working_hours: hours,
      // Only the key this tab owns; the server merges metadata per key.
      metadata: {
        outside_hours: {
          type: outside.type,
          message: outside.message.trim(),
          // Kept from older settings only when it is a usable address.
          notify_email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(outside.notify_email) ? outside.notify_email : '',
        },
      },
    }
    // A greeting that was generated for the old tone, language or name follows
    // the new ones (empty = generated at call time); a custom one is kept.
    const greetingInputsChanged = language !== saved.language || tone !== saved.tone || trimmedName !== saved.name
    const greetingFollows = greetingInputsChanged && Boolean(agent.first_message?.trim()) && isAutomaticGreeting(agent, org.name)
    if (greetingFollows) payload.first_message = ''

    setName(trimmedName)
    const ok = await onUpdate(payload, greetingFollows ? 'Saved. Your greeting now matches the new settings.' : 'General settings saved')
    if (ok) setOutside((o) => ({ ...o, message: o.message.trim() }))
  }

  const onToneKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
    const next = AGENT_TONES[(index + step + AGENT_TONES.length) % AGENT_TONES.length]
    setTone(next)
    toneRefs.current[next]?.focus()
  }

  const languageLabel = AGENT_LANGUAGES.find((l) => l.value === language)?.label ?? language

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Name and language</CardTitle>
          <CardDescription>How your agent introduces itself, and the language it speaks with callers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="agent-name">Agent name</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aria"
              maxLength={NAME_MAX + 20}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? 'agent-name-error' : undefined}
              className="max-w-sm"
            />
            {nameError && (
              <p id="agent-name-error" className="text-xs text-destructive">
                {nameError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-language">Language</Label>
            <Select value={language} onValueChange={(v) => v && setLanguage(v)}>
              <SelectTrigger id="agent-language" className="w-full max-w-sm">
                <SelectValue>
                  {(value: string) => {
                    const l = AGENT_LANGUAGES.find((o) => o.value === value)
                    return l ? (
                      <span className="flex items-center gap-2">
                        <FlagIcon country={l.country} />
                        {l.label}
                      </span>
                    ) : (
                      value
                    )
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {AGENT_LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    <span className="flex items-center gap-2">
                      <FlagIcon country={l.country} />
                      {l.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {language !== saved.language && (
              <p className="text-xs text-muted-foreground">
                After saving, check the Voice tab and pick a voice that speaks {languageLabel} naturally.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tone</CardTitle>
          <CardDescription>
            Sets how your agent speaks: its wording, pace and warmth. The greeting on the Conversation tab follows it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label="Tone" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AGENT_TONES.map((id, index) => {
              const profile = TONE_PROFILES[id]
              const Icon = TONE_ICONS[id]
              const checked = tone === id
              return (
                <button
                  key={id}
                  ref={(el) => {
                    toneRefs.current[id] = el
                  }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  onClick={() => setTone(id)}
                  onKeyDown={(e) => onToneKeyDown(e, index)}
                  className={cn(
                    'rounded-xl border-2 p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    checked ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-muted-foreground/40'
                  )}
                >
                  <Icon className={cn('mb-2 size-5', checked ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                  <p className="text-sm font-medium">{profile.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{profile.blurb}</p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Working hours</CardTitle>
          <CardDescription>
            When your business is open. Your agent tells callers these hours and uses them to decide what happens after hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <Globe2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>
              Time zone: <span className="font-medium">{org.timezone}</span>{' '}
              <span className="text-muted-foreground">({timeZoneOffsetLabel(org.timezone)})</span>
            </span>
            <Link href="/settings" className="text-primary underline-offset-4 hover:underline sm:ml-auto">
              Change in Settings
            </Link>
          </div>
          <WorkingHoursEditor value={hours} onChange={setHours} errors={hoursErrors} idPrefix="agent-hours" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outside working hours</CardTitle>
          <CardDescription>What callers get when they ring while you’re closed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div role="radiogroup" aria-label="Outside working hours" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                { type: 'always_answer', icon: PhoneCall, title: 'Always answer', text: 'Your agent picks up day and night, takes messages and books appointments.' },
                { type: 'message', icon: Moon, title: 'Play a message, then hang up', text: 'Callers hear your message and the call ends. Your agent doesn’t pick up for a conversation.' },
              ] as const
            ).map((option) => {
              const checked = outside.type === option.type
              const Icon = option.icon
              return (
                <button
                  key={option.type}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setOutside((o) => ({ ...o, type: option.type }))}
                  className={cn(
                    'flex gap-3 rounded-xl border-2 p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    checked ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-muted-foreground/40'
                  )}
                >
                  <Icon className={cn('mt-0.5 size-5 shrink-0', checked ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-medium">{option.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{option.text}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {outside.type === 'message' && isAlwaysOpen(hours) && (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Your working hours are set to 24/7, so callers always reach your agent. This message is only used if you
              change your hours.
            </p>
          )}
          {outside.type === 'message' && (
            <div className="space-y-2">
              <Label htmlFor="outside-message">Message callers hear</Label>
              <Textarea
                id="outside-message"
                value={outside.message}
                onChange={(e) => setOutside((o) => ({ ...o, message: e.target.value }))}
                rows={3}
                maxLength={OUTSIDE_MESSAGE_MAX + 50}
                placeholder={`Thanks for calling${org.name ? ` ${org.name}` : ''}. We’re closed right now. Please call again during our opening hours.`}
                aria-invalid={Boolean(outsideError)}
                aria-describedby="outside-message-help"
                className="resize-none"
              />
              <p id="outside-message-help" className={cn('text-xs', outsideError ? 'text-destructive' : 'text-muted-foreground')}>
                {outsideError ?? `Write it in ${languageLabel}, exactly as callers should hear it. ${outside.message.length}/${OUTSIDE_MESSAGE_MAX}`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phone numbers</CardTitle>
          <CardDescription>Numbers that ring this agent.</CardDescription>
        </CardHeader>
        <CardContent>
          {phoneNumbers.length === 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">No number yet. Your agent needs one to take real calls.</p>
              <Link href="/phone" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                Get a phone number
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {phoneNumbers.map((pn) => (
                <li key={pn.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="font-mono">{pn.number}</span>
                  {pn.friendly_name && <span className="text-muted-foreground">{pn.friendly_name}</span>}
                  <Badge variant={pn.is_active ? 'default' : 'secondary'} className="ml-auto">
                    {pn.is_active ? 'Active' : 'Paused'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <SaveBar dirty={dirty} saving={isSaving} invalidMessage={invalidMessage} onSave={save} onDiscard={discard} />
    </div>
  )
}
