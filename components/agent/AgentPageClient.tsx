'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/EmptyState'
import { OrbInline } from '@/components/shared/OrbLoader'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusChip } from '@/components/shared/StatusChip'
import {
  ArrowRight, BookOpen, Bot, Clock, MessageSquare, Phone, PhoneForwarded, Settings2, Volume2,
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

/** `?tab=` of a known tab (e.g. the Google Calendar connect flow returns to call-handling). */
function initialTab(requested: string | null): string {
  return TABS.some((t) => t.value === requested) ? (requested as string) : 'general'
}

const GOOGLE_OAUTH_ERRORS: Record<string, string> = {
  oauth_denied: 'Access to Google was not granted.',
  invalid_state: 'The connection link expired. Please connect again.',
  token_exchange: 'Google did not complete the connection. Please try again.',
}

/** Nearest scrolling ancestor (the dashboard shell's <main>), or the document. */
function scrollParent(el: HTMLElement): Element | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node
  }
  return document.scrollingElement
}

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
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<string>(() => initialTab(searchParams.get('tab')))

  // Back from the Google OAuth flow (?connected= / ?error=): say how it went once, then clean the URL.
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    if (!connected && !error) return
    if (connected === 'google_calendar') {
      toast.success('Google Calendar connected', { id: 'google-oauth-result', description: 'Your agent can now check your free times and book appointments.' })
    } else if (error) {
      toast.error('Google Calendar was not connected', { id: 'google-oauth-result', description: GOOGLE_OAUTH_ERRORS[error] ?? 'Please try again.' })
    }
    const url = new URL(window.location.href)
    url.searchParams.delete('connected')
    url.searchParams.delete('error')
    window.history.replaceState(null, '', url.toString())
  }, [searchParams])
  const statusHook = useAgentStatus()
  const { refetch: refreshStatus, retry: retrySync } = statusHook
  const onSaved = useCallback(() => void refreshStatus(), [refreshStatus])
  const agentHook = useAgent(initialAgent, { onSaved, retrySync })
  const knowledgeHook = useKnowledge()
  const { timezone, failed: timezoneFailed, setTimezone } = useOrgTimezone(orgTimezone)
  const { agent, isSaving, isTogglingActive, toggleActive, updateWithToast, replaceAgent } = agentHook

  // Focus that lands under the sticky tab bar (e.g. Shift+Tab upwards, or a field still inside the
  // scrollport but covered by the bar) is scrolled just below it. Runs a frame later, after any
  // scrolling the browser itself does for the focus; portalled popups are not in this subtree.
  const tabBarRef = useRef<HTMLDivElement>(null)
  const keepFocusClearOfTabBar = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.target
    if (!(target instanceof HTMLElement) || !e.currentTarget.contains(target)) return
    requestAnimationFrame(() => {
      const bar = tabBarRef.current
      if (!bar || document.activeElement !== target) return
      const barBottom = bar.getBoundingClientRect().bottom
      const top = target.getBoundingClientRect().top
      if (top >= barBottom + 8) return
      scrollParent(bar)?.scrollBy({ top: top - barBottom - 16 })
    })
  }, [])

  if (!agent) {
    return (
      <PageContainer width="narrow">
        <h1 className="sr-only">Agent</h1>
        <EmptyState
          icon={Bot}
          title="No agent found"
          description="Complete the onboarding to set up your AI voice agent."
          action={
            <Link href="/onboarding" className={buttonVariants()}>
              Go to onboarding <ArrowRight aria-hidden="true" />
            </Link>
          }
          className="mt-10"
        />
      </PageContainer>
    )
  }

  const numbersText =
    phoneNumbers.length > 0
      ? `${phoneNumbers.length} phone number${phoneNumbers.length > 1 ? 's' : ''}`
      : 'No phone numbers linked'
  // The same three states as the dashboard and the shell: an active agent with no active number cannot answer calls.
  const hasActiveNumber = phoneNumbers.some((n) => n.is_active)
  const agentState = !agent.is_active ? 'paused' : hasActiveNumber ? 'live' : 'no-number'

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Agent"
        title={agent.name}
        meta={
          <>
            {agentState === 'live' ? (
              <StatusChip tone="success" dot>
                Live
              </StatusChip>
            ) : agentState === 'no-number' ? (
              <StatusChip tone="warning" dot title="Active, but it has no phone number to answer on">
                No number
              </StatusChip>
            ) : (
              <StatusChip tone="muted" dot>
                Paused
              </StatusChip>
            )}
            {agent.voice_name && (
              <Badge variant="outline">
                <Volume2 aria-hidden="true" />
                {agent.voice_name}
              </Badge>
            )}
            {agent.language && (
              <Badge variant="outline" className="uppercase">
                {agent.language}
              </Badge>
            )}
            <span className="ml-1 flex items-center gap-1.5 text-[13px] leading-[19px] text-muted-foreground">
              <Phone className="size-3.5" aria-hidden="true" />
              {numbersText}
            </span>
          </>
        }
        actions={
          <>
            {/* The site's agent pill: label, ink switch, busy orb while the toggle is in flight.
                The label names the control and does not change (the status chip in the meta row
                says Live / No number / Paused), so the pill keeps its width when toggled.
                Busy indicators are added on the side away from the pill's anchor (right below md,
                where the row is left-aligned; left from md, where it is right-aligned), so the
                switch never moves under the pointer. */}
            <div className="flex h-10 items-center gap-2.5 rounded-full bg-white pr-2.5 pl-4 shadow-pill md:order-last">
              <label htmlFor="agent-active" className="text-[13px] leading-4 font-medium select-none">
                Answer calls
              </label>
              <Switch
                id="agent-active"
                checked={agent.is_active}
                onCheckedChange={() => void toggleActive()}
                disabled={isTogglingActive}
              />
              {isTogglingActive && <OrbInline state="working" className="md:order-first" />}
            </div>
            {isSaving && (
              <StatusChip tone="neutral" icon={<OrbInline state="working" />} aria-hidden="true" className="md:order-first">
                Saving…
              </StatusChip>
            )}
            {/* Always mounted, so the change of text is announced. */}
            <span aria-live="polite" className="sr-only">
              {isTogglingActive ? 'Updating…' : isSaving ? 'Saving…' : ''}
            </span>
          </>
        }
      />

      {/* Side by side from xl, both stretched to the taller one; stacked (provider panel, then the band) below. */}
      <div className="grid gap-6 xl:grid-cols-2">
        <ProviderStatusCard
          status={statusHook.status}
          isLoading={statusHook.isLoading}
          error={statusHook.error}
          isRetrying={statusHook.isRetrying}
          onRetry={() => void retrySync()}
          onRefresh={() => void refreshStatus()}
        />
        <TestAgentPanel
          agentName={agent.name}
          refreshKey={`${agent.is_active}:${statusHook.status?.providers.find((p) => p.provider === 'elevenlabs')?.status ?? ''}`}
        />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(String(v))} className="mt-12 gap-0">
        {/* Sticky under the shell's scroll top; full-bleed white so content scrolls beneath it. */}
        <div
          ref={tabBarRef}
          className="sticky top-0 z-20 -mx-4 bg-white/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
        >
          <TabsList variant="line" aria-label="Agent settings">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value}>
                <Icon aria-hidden="true" />
                <span>{label}</span>
                {value === 'knowledge' && knowledgeHook.docs.length > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[11px] tabular-nums">
                    {knowledgeHook.docs.length}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Left-aligned with the header, panels and tab triggers (one left edge for the page). */}
        <div className="w-full max-w-[768px] pt-8" onFocusCapture={keepFocusClearOfTabBar}>
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
    </PageContainer>
  )
}
