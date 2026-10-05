'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Phone, Smile, Briefcase, HeartHandshake, Zap, BookOpen, Loader2 } from 'lucide-react'
import type { Agent, PhoneNumber } from '@/types'
import type { AgentHook } from '@/hooks/useAgent'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { formatPhoneNumber } from '@/lib/utils'
import { FlagIcon } from '@/components/shared/FlagIcon'
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
    <div className="space-y-6">
      {/* Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent Name</CardTitle>
          <CardDescription>This is displayed to callers and in your dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="agent-name">Name</Label>
            <div className="flex gap-3">
              <Input
                id="agent-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Aria, Support Agent"
                className="max-w-sm"
                maxLength={100}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? 'agent-name-error' : undefined}
              />
            </div>
            {nameError && (
              <p id="agent-name-error" role="alert" className="text-xs text-destructive">{nameError}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Personality */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personality</CardTitle>
          <CardDescription>Sets the overall tone and style of your agent&apos;s conversations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PERSONALITIES.map(p => {
              const Icon = p.icon
              const active = personality === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersonality(p.id)}
                  aria-pressed={active}
                  className={[
                    'rounded-xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-muted-foreground/40',
                  ].join(' ')}
                >
                  <Icon className={['size-5 mb-2', active ? 'text-primary' : 'text-muted-foreground'].join(' ')} aria-hidden="true" />
                  <p className="font-medium text-sm">{p.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Language</CardTitle>
          <CardDescription>Primary language your agent will speak and understand.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={language} onValueChange={v => v && setLanguage(v)}>
            <SelectTrigger className="w-[220px]" aria-label="Agent language">
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
        </CardContent>
      </Card>

      {/* Phone Numbers */}
      {phoneNumbers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linked Phone Numbers</CardTitle>
            <CardDescription>
              Phone numbers routed to this agent. Change how each number is routed on the{' '}
              <Link href="/phone" className="text-primary underline-offset-4 hover:underline">Phone Numbers</Link> page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {phoneNumbers.map(pn => (
                <li key={pn.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <Phone className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="font-mono">{formatPhoneNumber(pn.number)}</span>
                  {pn.friendly_name && (
                    <span className="text-muted-foreground">{pn.friendly_name}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {ROUTING_MODE_SHORT[pn.routing_mode === 'native_elevenlabs' ? 'native_elevenlabs' : 'app_routed']}
                  </span>
                  <span className="ml-auto flex items-center gap-1.5">
                    {pn.routing_status && <StatusPill copy={routingStatusCopy(pn.routing_status)} />}
                    <Badge variant={pn.is_active ? 'default' : 'secondary'} className="text-xs">
                      {pn.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Save bar */}
      <div className="flex items-center gap-3">
        <Button onClick={() => void handleSave()} disabled={!isDirty || isSaving || !!nameError} className="purple-glow">
          {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSaving ? 'Saving…' : 'Save Changes'}
        </Button>
        {isDirty && (
          <span className="text-xs text-muted-foreground">You have unsaved changes</span>
        )}
      </div>
    </div>
  )
}
