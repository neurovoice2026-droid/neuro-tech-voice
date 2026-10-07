'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  BookOpen, Bot, Clock, Loader2, MessageSquare, Phone, PhoneForwarded, Settings2, Volume2,
} from 'lucide-react'
import { toast } from 'sonner'
import { TabGeneral } from './tabs/TabGeneral'
import { TabConversation } from './tabs/TabConversation'
import { TabVoice } from './tabs/TabVoice'
import { TabKnowledge } from './tabs/TabKnowledge'
import { TabAvailability } from './tabs/TabAvailability'
import { TabCallHandling } from './tabs/TabCallHandling'
import { ProviderStatusCard } from './ProviderStatusCard'
import { TestAgentPanel } from './TestAgentPanel'
import { useAgent } from '@/hooks/useAgent'
import { useAgentStatus } from '@/hooks/useAgentStatus'
import { useKnowledge } from '@/hooks/useKnowledge'
import { createClient } from '@/lib/supabase/client'
import type { Agent, PhoneNumber } from '@/types'

interface AgentPageClientProps {
  initialAgent: Agent | null
  phoneNumbers: PhoneNumber[]
  /**
   * The organization's IANA time zone (working hours). When the page does not
   * pass it, it is read once on the client (RLS-scoped to the user's org).
   */
  orgTimezone?: string | null
}

const TABS = [
  { value: 'general', label: 'General', icon: Settings2 },
  { value: 'conversation', label: 'Conversation', icon: MessageSquare },
  { value: 'voice', label: 'Voice', icon: Volume2 },
  { value: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { value: 'availability', label: 'Availability', icon: Clock },
  { value: 'call-handling', label: 'Call handling', icon: PhoneForwarded },
] as const

/** Reads the org's time zone when the server page did not provide it. */
function useOrgTimezone(provided: string | null | undefined) {
  const [loaded, setLoaded] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const needsLoad = provided === undefined

  useEffect(() => {
    if (!needsLoad) return
    let cancelled = false
    void (async () => {
      const { data, error } = await createClient().from('organizations').select('timezone').limit(1).maybeSingle()
      if (cancelled) return
      if (error) {
        setFailed(true)
        toast.error('Could not load your time zone', { description: 'Working hours cannot be edited until the page is reloaded.' })
        return
      }
      const tz = data && typeof data.timezone === 'string' && data.timezone ? data.timezone : 'UTC'
      setLoaded(tz)
    })()
    return () => {
      cancelled = true
    }
  }, [needsLoad])

  const [saved, setSaved] = useState<string | null>(null)
  const timezone = saved ?? (needsLoad ? loaded : (provided ?? 'UTC'))
  return { timezone, failed, setTimezone: setSaved }
}

export function AgentPageClient({ initialAgent, phoneNumbers, orgTimezone }: AgentPageClientProps) {
  const [activeTab, setActiveTab] = useState<string>('general')
  const statusHook = useAgentStatus()
  const { refetch: refreshStatus, retry: retrySync } = statusHook
  const onSaved = useCallback(() => void refreshStatus(), [refreshStatus])
  const agentHook = useAgent(initialAgent, { onSaved, retrySync })
  const knowledgeHook = useKnowledge()
  const { timezone, failed: timezoneFailed, setTimezone } = useOrgTimezone(orgTimezone)
  const { agent, isSaving, isTogglingActive, toggleActive, updateWithToast, replaceAgent } = agentHook

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center p-6">
        <div className="rounded-full bg-muted p-5 mb-4">
          <Bot className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold">No agent found</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Complete the onboarding to set up your AI voice agent.
        </p>
        <Link href="/onboarding" className="mt-4 text-sm text-primary hover:underline">
          Go to onboarding →
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="border-b bg-card px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 border shrink-0">
              <Bot className="size-6 text-primary" aria-hidden="true" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold truncate">{agent.name}</h1>
                <Badge
                  variant={agent.is_active ? 'default' : 'secondary'}
                  className={agent.is_active ? 'bg-green-500/15 text-green-600 border-green-500/30' : ''}
                >
                  {agent.is_active ? 'Active' : 'Inactive'}
                </Badge>
                {agent.voice_name && (
                  <Badge variant="outline" className="text-xs">
                    <Volume2 className="size-3 mr-1" aria-hidden="true" />
                    {agent.voice_name}
                  </Badge>
                )}
                {agent.language && (
                  <Badge variant="outline" className="text-xs uppercase">
                    {agent.language}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                <Phone className="size-3.5" aria-hidden="true" />
                <span>
                  {phoneNumbers.length > 0
                    ? `${phoneNumbers.length} phone number${phoneNumbers.length > 1 ? 's' : ''}`
                    : 'No phone numbers linked'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {isTogglingActive && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
              <label htmlFor="agent-active" className="text-sm text-muted-foreground">
                {agent.is_active ? 'Online' : 'Offline'}
                <span className="sr-only"> (agent answers calls)</span>
              </label>
              <Switch
                id="agent-active"
                checked={agent.is_active}
                onCheckedChange={() => void toggleActive()}
                disabled={isTogglingActive}
              />
            </div>
            {isSaving && (
              <Badge variant="secondary" className="text-xs gap-1" aria-live="polite">
                <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Saving
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
          <ProviderStatusCard
            status={statusHook.status}
            isLoading={statusHook.isLoading}
            error={statusHook.error}
            isRetrying={statusHook.isRetrying}
            onRetry={() => void retrySync()}
            onRefresh={() => void refreshStatus()}
          />
          <TestAgentPanel
            className="mt-4"
            agentName={agent.name}
            refreshKey={`${agent.is_active}:${statusHook.status?.providers.find((p) => p.provider === 'elevenlabs')?.status ?? ''}`}
          />
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(String(v))} className="mt-4">
          <div className="border-y bg-card px-2 sm:px-6">
            <TabsList
              variant="line"
              aria-label="Agent settings"
              className="h-11 w-full justify-start gap-0 rounded-none bg-transparent p-0 overflow-x-auto"
            >
              {TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="relative h-full flex-none rounded-none px-3 text-sm data-active:font-medium sm:px-4"
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{label}</span>
                  {value === 'knowledge' && knowledgeHook.docs.length > 0 && (
                    <span className="ml-1 flex size-4 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                      {knowledgeHook.docs.length}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
            <TabsContent value="general">
              <TabGeneral
                agent={agent}
                phoneNumbers={phoneNumbers}
                onUpdate={updateWithToast}
                isSaving={isSaving}
              />
            </TabsContent>

            <TabsContent value="conversation">
              <TabConversation agent={agent} onUpdate={updateWithToast} isSaving={isSaving} />
            </TabsContent>

            <TabsContent value="voice">
              <TabVoice agent={agent} onAgentUpdated={replaceAgent} onUpdate={updateWithToast} isSaving={isSaving} />
            </TabsContent>

            <TabsContent value="knowledge">
              <TabKnowledge hook={knowledgeHook} />
            </TabsContent>

            <TabsContent value="availability">
              <TabAvailability
                agent={agent}
                timezone={timezone}
                timezoneUnavailable={timezoneFailed}
                onUpdate={updateWithToast}
                onTimezoneSaved={setTimezone}
                isSaving={isSaving}
              />
            </TabsContent>

            <TabsContent value="call-handling">
              <TabCallHandling
                agent={agent}
                status={statusHook.status}
                onUpdate={updateWithToast}
                isSaving={isSaving}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
