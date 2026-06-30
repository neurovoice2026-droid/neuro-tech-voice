'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Bot, Phone, Settings2, Volume2, BookOpen, Loader2 } from 'lucide-react'
import { TabGeneral } from './tabs/TabGeneral'
import { TabConversation } from './tabs/TabConversation'
import { TabVoice } from './tabs/TabVoice'
import { TabKnowledge } from './tabs/TabKnowledge'
import { useAgent } from '@/hooks/useAgent'
import { useKnowledge } from '@/hooks/useKnowledge'
import type { Agent, PhoneNumber } from '@/types'

interface AgentPageClientProps {
  initialAgent: Agent | null
  phoneNumbers: PhoneNumber[]
}

export function AgentPageClient({ initialAgent, phoneNumbers }: AgentPageClientProps) {
  const [activeTab, setActiveTab] = useState('general')
  const agentHook = useAgent(initialAgent)
  const knowledgeHook = useKnowledge()
  const { agent, isSaving, isTogglingActive, toggleActive, updateWithToast, updateVoice } = agentHook

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center p-6">
        <div className="rounded-full bg-muted p-5 mb-4">
          <Bot className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">No agent found</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Complete the onboarding to set up your AI voice agent.
        </p>
        <a href="/onboarding" className="mt-4 text-sm text-primary hover:underline">
          Go to onboarding →
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 border shrink-0">
            <Bot className="size-6 text-primary" />
          </div>

          {/* Name + status */}
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
                  <Volume2 className="size-3 mr-1" />
                  {agent.voice_name}
                </Badge>
              )}
              {agent.language && (
                <Badge variant="outline" className="text-xs uppercase">
                  {agent.language}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
              <Phone className="size-3.5" />
              <span>
                {phoneNumbers.length > 0
                  ? `${phoneNumbers.length} phone number${phoneNumbers.length > 1 ? 's' : ''}`
                  : 'No phone numbers linked'
                }
              </span>
              {agent.elevenlabs_agent_id && (
                <>
                  <span>·</span>
                  <span className="font-mono text-xs">{agent.elevenlabs_agent_id.slice(0, 12)}…</span>
                </>
              )}
            </div>
          </div>

          {/* Toggle + actions */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {isTogglingActive && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
              <span className="text-sm text-muted-foreground">
                {agent.is_active ? 'Online' : 'Offline'}
              </span>
              <Switch
                checked={agent.is_active}
                onCheckedChange={toggleActive}
                disabled={isTogglingActive}
              />
            </div>
            {isSaving && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Loader2 className="size-3 animate-spin" /> Saving
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b bg-card px-6">
            <TabsList variant="line" className="h-11 w-full justify-start gap-0 rounded-none bg-transparent p-0">
              {[
                { value: 'general', label: 'General', icon: Settings2 },
                { value: 'conversation', label: 'Conversation', icon: Bot },
                { value: 'voice', label: 'Voice', icon: Volume2 },
                { value: 'knowledge', label: 'Knowledge', icon: BookOpen },
              ].map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="relative h-full rounded-none px-4 text-sm data-active:font-medium"
                >
                  <Icon className="size-4" />
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

          <div className="p-6 max-w-3xl mx-auto">
            <TabsContent value="general">
              <TabGeneral
                agent={agent}
                phoneNumbers={phoneNumbers}
                onUpdate={updateWithToast}
                isSaving={isSaving}
              />
            </TabsContent>

            <TabsContent value="conversation">
              <TabConversation
                agent={agent}
                onUpdate={updateWithToast}
                isSaving={isSaving}
              />
            </TabsContent>

            <TabsContent value="voice">
              <TabVoice
                agent={agent}
                onUpdateVoice={updateVoice}
                isSaving={isSaving}
              />
            </TabsContent>

            <TabsContent value="knowledge">
              <TabKnowledge hook={knowledgeHook} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
