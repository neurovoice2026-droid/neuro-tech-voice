'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Phone, Smile, Briefcase, HeartHandshake, Zap, BookOpen } from 'lucide-react'
import type { Agent, PhoneNumber } from '@/types'
import type { AgentHook } from '@/hooks/useAgent'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { formatPhoneNumber } from '@/lib/utils'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { Field, FormSection } from '@/components/shared/FormSection'
import { OptionCard } from '@/components/shared/OptionCard'
import { ROUTING_MODE_SHORT, StatusPill, routingStatusCopy } from '@/components/agent/ProviderStatusCard'

const PERSONALITIES = [
  { id: 'professional', label: 'Professional', icon: Briefcase, description: 'Formal, precise, business-focused' },
  { id: 'friendly', label: 'Friendly', icon: Smile, description: 'Warm, approachable, conversational' },
  { id: 'empathetic', label: 'Empathetic', icon: HeartHandshake, description: 'Caring, patient, understanding' },
  { id: 'energetic', label: 'Energetic', icon: Zap, description: 'Enthusiastic, upbeat, motivating' },
  { id: 'educational', label: 'Educational', icon: BookOpen, description: 'Clear, informative, instructive' },
]

interface TabGeneralProps {
  agent: Agent
  phoneNumbers: PhoneNumber[]
  onUpdate: AgentHook['updateWithToast']
  isSaving: boolean
}

function personalityOf(agent: Agent): string {
  const value = agent.metadata?.personality
  return typeof value === 'string' && value ? value : 'professional'
}

export function TabGeneral({ agent, phoneNumbers, onUpdate, isSaving }: TabGeneralProps) {
  const [name, setName] = useState(agent.name)
  const [personality, setPersonality] = useState<string>(personalityOf(agent))
  const [language, setLanguage] = useState(agent.language)

  const trimmedName = name.trim()
  const nameError = trimmedName ? (trimmedName.length > 100 ? 'Keep the name under 100 characters.' : null) : 'Enter a name.'
  const isDirty = trimmedName !== agent.name || personality !== personalityOf(agent) || language !== agent.language

  const handleSave = async () => {
    if (nameError) return
    const saved = await onUpdate(
      {
        name: trimmedName,
        language,
        // Only the personality is editable here; the server merges it into metadata.
        metadata: { personality },
      },
      'General settings saved'
    )
    if (saved) {
      setName(saved.name)
      setPersonality(personalityOf(saved))
      setLanguage(saved.language)
    }
  }

  return (
    <div>
      <FormSection title="Agent name" description="This is displayed to callers and in your dashboard.">
        <Field label="Name" htmlFor="agent-name" error={nameError}>
          <Input
            id="agent-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Aria, Support Agent"
            className="max-w-sm"
            maxLength={100}
          />
        </Field>
      </FormSection>

      <FormSection title="Personality" description="Sets the overall tone and style of your agent's conversations.">
        <div role="radiogroup" aria-label="Personality" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PERSONALITIES.map(p => (
            <OptionCard
              key={p.id}
              selected={personality === p.id}
              onSelect={() => setPersonality(p.id)}
              icon={p.icon}
              title={p.label}
              description={p.description}
            />
          ))}
        </div>
      </FormSection>

      <FormSection title="Language" description="Primary language your agent will speak and understand.">
        <Select value={language} onValueChange={v => v && setLanguage(v)}>
          <SelectTrigger className="w-full max-w-[280px]" aria-label="Agent language">
            <SelectValue>
              {(value: string) => {
                const l = AGENT_LANGUAGES.find(o => o.value === value)
                return l ? (
                  <span className="flex items-center gap-2">
                    <FlagIcon country={l.country} />
                    {l.label}
                  </span>
                ) : value
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {AGENT_LANGUAGES.map(l => (
              <SelectItem key={l.value} value={l.value}>
                <span className="flex items-center gap-2">
                  <FlagIcon country={l.country} />
                  {l.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormSection>

      {phoneNumbers.length > 0 && (
        <FormSection
          title="Linked phone numbers"
          description={
            <>
              Phone numbers routed to this agent. Change how each number is routed on the{' '}
              <Link
                href="/phone"
                className="rounded-sm font-medium text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Phone Numbers
              </Link>{' '}
              page.
            </>
          }
        >
          <ul className="overflow-hidden rounded-2xl bg-card shadow-hair">
            {phoneNumbers.map(pn => (
              <li key={pn.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-4 py-3 last:border-b-0">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary" aria-hidden="true">
                  <Phone className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm leading-5">
                    <span className="font-medium whitespace-nowrap tabular-nums">{formatPhoneNumber(pn.number)}</span>
                    {pn.friendly_name && <span className="text-muted-foreground">{pn.friendly_name}</span>}
                  </p>
                  <p className="text-xs leading-4 text-muted-foreground">
                    {ROUTING_MODE_SHORT[pn.routing_mode === 'native_elevenlabs' ? 'native_elevenlabs' : 'app_routed']}
                  </p>
                </div>
                {/* Chips wrap under the number on phones, aligned with the text. */}
                <span className="flex w-full items-center gap-1.5 pl-11 sm:w-auto sm:pl-0">
                  {pn.routing_status && <StatusPill copy={routingStatusCopy(pn.routing_status)} />}
                  <Badge variant={pn.is_active ? 'secondary' : 'muted'}>
                    {pn.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </FormSection>
      )}

      {/* Save row */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-rule pt-5">
        {isDirty && (
          <span className="mr-auto text-xs text-muted-foreground sm:mr-0">You have unsaved changes</span>
        )}
        <Button
          onClick={() => void handleSave()}
          disabled={!isDirty || !!nameError}
          loading={isSaving}
          loadingText="Saving…"
        >
          Save changes
        </Button>
      </div>
    </div>
  )
}
