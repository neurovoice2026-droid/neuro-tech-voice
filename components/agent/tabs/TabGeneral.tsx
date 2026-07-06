'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Phone, Smile, Briefcase, HeartHandshake, Zap, BookOpen } from 'lucide-react'
import type { Agent, PhoneNumber } from '@/types'
import type { useAgent } from '@/hooks/useAgent'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'

const PERSONALITIES = [
  { id: 'professional', label: 'Professional', icon: Briefcase, description: 'Formal, precise, business-focused' },
  { id: 'friendly', label: 'Friendly', icon: Smile, description: 'Warm, approachable, conversational' },
  { id: 'empathetic', label: 'Empathetic', icon: HeartHandshake, description: 'Caring, patient, understanding' },
  { id: 'energetic', label: 'Energetic', icon: Zap, description: 'Enthusiastic, upbeat, motivating' },
  { id: 'educational', label: 'Educational', icon: BookOpen, description: 'Clear, informative, instructive' },
]

type AgentHook = ReturnType<typeof useAgent>

interface TabGeneralProps {
  agent: Agent
  phoneNumbers: PhoneNumber[]
  onUpdate: AgentHook['updateWithToast']
  isSaving: boolean
}

export function TabGeneral({ agent, phoneNumbers, onUpdate, isSaving }: TabGeneralProps) {
  const [name, setName] = useState(agent.name)
  const [personality, setPersonality] = useState<string>(
    (agent.metadata?.personality as string) ?? 'professional'
  )
  const [language, setLanguage] = useState(agent.language)

  const isDirty = name !== agent.name || personality !== (agent.metadata?.personality ?? 'professional') || language !== agent.language

  const handleSave = async () => {
    await onUpdate(
      {
        name,
        language,
        metadata: { ...agent.metadata, personality },
      },
      'General settings saved'
    )
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
              />
            </div>
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
                  className={[
                    'rounded-xl border-2 p-4 text-left transition-all',
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-muted-foreground/40',
                  ].join(' ')}
                >
                  <Icon className={['size-5 mb-2', active ? 'text-primary' : 'text-muted-foreground'].join(' ')} />
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
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGENT_LANGUAGES.map(l => (
                <SelectItem key={l.value} value={l.value}>{l.flag} {l.label}</SelectItem>
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
            <CardDescription>Phone numbers routed to this agent.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {phoneNumbers.map(pn => (
                <div key={pn.id} className="flex items-center gap-3 text-sm">
                  <Phone className="size-4 text-muted-foreground shrink-0" />
                  <span className="font-mono">{pn.number}</span>
                  {pn.friendly_name && (
                    <span className="text-muted-foreground">{pn.friendly_name}</span>
                  )}
                  <Badge variant={pn.is_active ? 'default' : 'secondary'} className="ml-auto text-xs">
                    {pn.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Save bar */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!isDirty || isSaving} className="purple-glow">
          {isSaving ? 'Saving…' : 'Save Changes'}
        </Button>
        {isDirty && (
          <span className="text-xs text-muted-foreground">You have unsaved changes</span>
        )}
      </div>
    </div>
  )
}
