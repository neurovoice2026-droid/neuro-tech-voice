'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Play, Square, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import type { Agent, BehaviorSettings } from '@/types'
import type { useAgent } from '@/hooks/useAgent'
import { defaultFallbackMessage } from '@/lib/elevenlabs/prompt'

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

const DEFAULT_BEHAVIOR: BehaviorSettings = {
  allow_interruptions: true,
  auto_end_call: true,
  auto_end_silence_seconds: 10,
  max_call_duration_enabled: false,
  max_call_duration_minutes: 30,
  record_calls: true,
  voicemail_detection: true,
}

type AgentHook = ReturnType<typeof useAgent>

interface TabConversationProps {
  agent: Agent
  onUpdate: AgentHook['updateWithToast']
  isSaving: boolean
}

export function TabConversation({ agent, onUpdate, isSaving }: TabConversationProps) {
  const [firstMessage, setFirstMessage] = useState(agent.first_message ?? '')
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt ?? '')
  const [fallbackMessage, setFallbackMessage] = useState(agent.fallback_message ?? '')
  const [behavior, setBehavior] = useState<BehaviorSettings>({
    ...DEFAULT_BEHAVIOR,
    ...((agent.metadata?.behavior_settings as Partial<BehaviorSettings>) ?? {}),
  })
  const [showTemplates, setShowTemplates] = useState(false)
  const [isPreviewingTTS, setIsPreviewingTTS] = useState(false)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)

  const isDirty =
    firstMessage !== (agent.first_message ?? '') ||
    systemPrompt !== (agent.system_prompt ?? '') ||
    fallbackMessage !== (agent.fallback_message ?? '')

  const handleSave = async () => {
    await onUpdate(
      {
        first_message: firstMessage,
        system_prompt: systemPrompt,
        fallback_message: fallbackMessage,
        metadata: {
          ...agent.metadata,
          behavior_settings: behavior,
        },
      },
      'Conversation settings saved'
    )
  }

  const previewFirstMessage = async () => {
    if (!agent.voice_id || !firstMessage) return

    if (audioRef) {
      audioRef.pause()
      setAudioRef(null)
      setIsPreviewingTTS(false)
      return
    }

    setIsPreviewingTTS(true)
    try {
      const res = await fetch('/api/agent/preview-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: firstMessage, voice_id: agent.voice_id }),
      })
      if (!res.ok) {
        toast.error('Could not generate voice preview')
        setIsPreviewingTTS(false)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.addEventListener('ended', () => {
        setIsPreviewingTTS(false)
        setAudioRef(null)
        URL.revokeObjectURL(url)
      })
      setAudioRef(audio)
      await audio.play()
    } catch {
      toast.error('Could not generate voice preview')
      setIsPreviewingTTS(false)
      setAudioRef(null)
    }
  }

  const setBehaviorField = <K extends keyof BehaviorSettings>(key: K, val: BehaviorSettings[K]) => {
    setBehavior(prev => ({ ...prev, [key]: val }))
  }

  return (
    <div className="space-y-6">
      {/* First Message */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">First Message</CardTitle>
          <CardDescription>
            What your agent says when a call connects. Keep it under 30 words.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={firstMessage}
            onChange={e => setFirstMessage(e.target.value)}
            placeholder="Hello! Thank you for calling. How can I assist you today?"
            rows={3}
            className="resize-none"
          />
          {agent.voice_id && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={previewFirstMessage}
              disabled={!firstMessage || isPreviewingTTS}
            >
              {isPreviewingTTS ? (
                <><Square className="size-3 mr-1.5" /> Stop preview</>
              ) : (
                <><Play className="size-3 mr-1.5" /> Preview with voice</>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* System Prompt */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">System Prompt</CardTitle>
            <CardDescription className="mt-1">
              Instructions that define your agent&apos;s role, goals, and constraints.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowTemplates(v => !v)}
          >
            <Sparkles className="size-3.5 mr-1.5" />
            Templates
            {showTemplates ? <ChevronUp className="size-3.5 ml-1" /> : <ChevronDown className="size-3.5 ml-1" />}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showTemplates && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg bg-muted/50 border">
              {PROMPT_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSystemPrompt(t.prompt)
                    setShowTemplates(false)
                  }}
                  className="text-left px-3 py-2 rounded-md hover:bg-accent text-sm border border-transparent hover:border-border transition-colors"
                >
                  <span className="font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          )}
          <Textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            placeholder="You are a helpful AI assistant for Acme Corp. Your role is to..."
            rows={10}
            className="font-mono text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">
            {systemPrompt.length.toLocaleString()} characters
          </p>
        </CardContent>
      </Card>

      {/* Behavior Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Behavior Settings</CardTitle>
          <CardDescription>Fine-tune how your agent handles conversations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BehaviorRow
            label="Allow Interruptions"
            description="Caller can interrupt the agent mid-sentence"
            checked={behavior.allow_interruptions}
            onCheckedChange={v => setBehaviorField('allow_interruptions', v)}
          />
          <BehaviorRow
            label="Auto-end Call on Silence"
            description={`End call after ${behavior.auto_end_silence_seconds}s of silence`}
            checked={behavior.auto_end_call}
            onCheckedChange={v => setBehaviorField('auto_end_call', v)}
          >
            {behavior.auto_end_call && (
              <div className="flex items-center gap-2 mt-2">
                <Label className="text-xs text-muted-foreground">Seconds:</Label>
                <Input
                  type="number"
                  min={3}
                  max={60}
                  value={behavior.auto_end_silence_seconds}
                  onChange={e => setBehaviorField('auto_end_silence_seconds', Number(e.target.value))}
                  className="w-20 h-7 text-sm"
                />
              </div>
            )}
          </BehaviorRow>
          <BehaviorRow
            label="Maximum Call Duration"
            description="Automatically end calls after a set time"
            checked={behavior.max_call_duration_enabled}
            onCheckedChange={v => setBehaviorField('max_call_duration_enabled', v)}
          >
            {behavior.max_call_duration_enabled && (
              <div className="flex items-center gap-2 mt-2">
                <Label className="text-xs text-muted-foreground">Minutes:</Label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={behavior.max_call_duration_minutes}
                  onChange={e => setBehaviorField('max_call_duration_minutes', Number(e.target.value))}
                  className="w-20 h-7 text-sm"
                />
              </div>
            )}
          </BehaviorRow>
          <BehaviorRow
            label="Record Calls"
            description="Store call recordings (subject to your plan)"
            checked={behavior.record_calls}
            onCheckedChange={v => setBehaviorField('record_calls', v)}
          />
          <BehaviorRow
            label="Voicemail Detection"
            description="Detect and handle voicemail greetings automatically"
            checked={behavior.voicemail_detection}
            onCheckedChange={v => setBehaviorField('voicemail_detection', v)}
          />
        </CardContent>
      </Card>

      {/* Fallback */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fallback Message</CardTitle>
          <CardDescription>
            Spoken when the agent doesn&apos;t understand or can&apos;t handle the request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={fallbackMessage}
            onChange={e => setFallbackMessage(e.target.value)}
            placeholder={defaultFallbackMessage(agent.language)}
            rows={3}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to use the default fallback phrase in your agent&apos;s language.
          </p>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!isDirty || isSaving} className="purple-glow">
          {isSaving ? 'Saving…' : 'Save Changes'}
        </Button>
        {isDirty && (
          <Badge variant="secondary" className="text-xs">Unsaved changes</Badge>
        )}
      </div>
    </div>
  )
}

function BehaviorRow({
  label,
  description,
  checked,
  onCheckedChange,
  children,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      {children}
    </div>
  )
}
