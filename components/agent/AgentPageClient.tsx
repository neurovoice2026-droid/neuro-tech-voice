'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { toast } from 'sonner'
import { BookOpen, Bot, Loader2, MessagesSquare, Phone, Settings2, Sparkles, Volume2, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { TabGeneral } from './tabs/TabGeneral'
import { ProviderSyncChip, ProviderSyncNotice } from './ProviderSyncStatus'
import { isSyncPending, syncProblems, useAgent } from '@/hooks/useAgent'
import { useKnowledge } from '@/hooks/useKnowledge'
import { errorMessage, isAbortError, requestJson } from '@/components/skills/request'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import type { Entitlements } from '@/lib/billing/entitlements'
import { AGENT_TABS, type AgentTab } from './agent-tabs'
import type { AgentOrgSummary, LinkedPhoneNumber } from './types'
import type { Agent, ProviderSyncState } from '@/types'

const FOLLOW_FIRST_POLL_MS = 1_000
const FOLLOW_INTERVAL_MS = 3_000
const FOLLOW_TIMEOUT_MS = 30_000

// Only the open tab renders, so the other four load when first opened (and
// start loading when their tab is hovered or focused): the voice recorder,
// document uploader and skills editors stay out of the first page load.
const TAB_MODULES = {
  conversation: () => import('./tabs/TabConversation'),
  voice: () => import('./tabs/TabVoice'),
  knowledge: () => import('./tabs/TabKnowledge'),
  skills: () => import('./tabs/TabSkills'),
}

function TabLoading() {
  return (
    <div role="status" className="space-y-4 pb-6">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  )
}

const TabConversation = dynamic(() => import('./tabs/TabConversation').then((m) => m.TabConversation), { loading: TabLoading })
const TabVoice = dynamic(() => import('./tabs/TabVoice').then((m) => m.TabVoice), { loading: TabLoading })
const TabKnowledge = dynamic(() => import('./tabs/TabKnowledge').then((m) => m.TabKnowledge), { loading: TabLoading })
const TabSkills = dynamic(() => import('./tabs/TabSkills').then((m) => m.TabSkills), { loading: TabLoading })

function preloadTab(tab: AgentTab): void {
  if (tab !== 'general') void TAB_MODULES[tab]().catch(() => {})
}

const TAB_META: Record<AgentTab, { label: string; icon: LucideIcon }> = {
  general: { label: 'General', icon: Settings2 },
  conversation: { label: 'Conversation', icon: MessagesSquare },
  voice: { label: 'Voice', icon: Volume2 },
  knowledge: { label: 'Knowledge', icon: BookOpen },
  skills: { label: 'Skills', icon: Sparkles },
}

/** Plain words for the ?error= codes the Google OAuth routes send back. */
function googleConnectMessage(code: string): string {
  switch (code) {
    case 'oauth_denied':
      return 'Access wasn’t allowed in Google. Try again and accept the permissions.'
    case 'missing_permissions':
      return 'Please allow every permission Google asks for, so your agent can see when you’re free and add bookings.'
    case 'upgrade_required':
      return 'Booking into Google Calendar is part of a higher plan.'
    case 'no_refresh_token':
      return 'Google didn’t give lasting access. Please try connecting again.'
    case 'google_not_configured':
    case 'encryption_not_configured':
    case 'setup_incomplete':
      return 'Google connections aren’t available right now. Please try again later.'
    default:
      return 'Something went wrong while connecting. Please try again.'
  }
}

interface AgentPageClientProps {
  initialAgent: Agent | null
  org: AgentOrgSummary
  entitlements: Entitlements
  phoneNumbers: LinkedPhoneNumber[]
  initialTab: AgentTab
}

export function AgentPageClient({ initialAgent, org, entitlements, phoneNumbers, initialTab }: AgentPageClientProps) {
  const [activeTab, setActiveTab] = useState<AgentTab>(initialTab)
  const [dirtyTabs, setDirtyTabs] = useState<Partial<Record<AgentTab, boolean>>>({})
  const [pendingTab, setPendingTab] = useState<AgentTab | null>(null)
  // Older accounts can lack an agent row; GET /api/agent creates the default one.
  const [bootAgent, setBootAgent] = useState<Agent | null>(initialAgent)
  const [bootError, setBootError] = useState<string | null>(null)
  const [bootAttempt, setBootAttempt] = useState(0)
  const agentHook = useAgent(bootAgent)
  const tabsListRef = useRef<HTMLDivElement | null>(null)
  const knowledgeHook = useKnowledge()
  const { agent, isSaving, isTogglingActive, toggleActive, update, updateWithToast, updateVoice, resync, isSyncing, isWaitingForSync } =
    agentHook

  const setDirty = useCallback((tab: AgentTab, dirty: boolean) => {
    setDirtyTabs((prev) => (Boolean(prev[tab]) === dirty ? prev : { ...prev, [tab]: dirty }))
  }, [])
  const onGeneralDirty = useCallback((d: boolean) => setDirty('general', d), [setDirty])
  const onConversationDirty = useCallback((d: boolean) => setDirty('conversation', d), [setDirty])
  const onSkillsDirty = useCallback((d: boolean) => setDirty('skills', d), [setDirty])

  // Team and booking changes are saved by their own routes, which update the
  // voice providers after responding. Follow that sync so the header chip and
  // notice stay truthful. The state is tied to the agent's provider_sync it
  // was read against, so anything newer from the agent hook wins.
  const [followedSync, setFollowedSync] = useState<{ base: ProviderSyncState | undefined; state: ProviderSyncState } | null>(null)
  const [followingSync, setFollowingSync] = useState(false)
  const followGeneration = useRef(0)
  const followTimer = useRef<number | null>(null)
  const agentSyncRef = useRef<ProviderSyncState | undefined>(agent?.provider_sync)
  useEffect(() => {
    agentSyncRef.current = agent?.provider_sync
  })

  const stopFollowingSync = useCallback(() => {
    followGeneration.current += 1
    if (followTimer.current !== null) window.clearTimeout(followTimer.current)
    followTimer.current = null
    setFollowingSync(false)
  }, [])

  const followProviderSync = useCallback(() => {
    stopFollowingSync()
    const generation = followGeneration.current
    const deadline = Date.now() + FOLLOW_TIMEOUT_MS
    setFollowingSync(true)
    const tick = async () => {
      if (generation !== followGeneration.current) return
      try {
        const res = await requestJson<{ provider_sync: ProviderSyncState }>('/api/agent/sync')
        if (generation !== followGeneration.current) return
        setFollowedSync({ base: agentSyncRef.current, state: res.provider_sync })
        if (!isSyncPending(res.provider_sync)) {
          setFollowingSync(false)
          const problems = syncProblems(res.provider_sync)
          if (problems.length > 0) {
            toast.warning('Your changes are saved, but the voice agent couldn’t be fully updated', { description: problems[0] })
          }
          return
        }
      } catch {
        // A dropped poll is retried on the next tick.
      }
      if (Date.now() >= deadline) {
        setFollowingSync(false)
        return
      }
      followTimer.current = window.setTimeout(() => void tick(), FOLLOW_INTERVAL_MS)
    }
    followTimer.current = window.setTimeout(() => void tick(), FOLLOW_FIRST_POLL_MS)
  }, [stopFollowingSync])

  useEffect(
    () => () => {
      followGeneration.current += 1
      if (followTimer.current !== null) window.clearTimeout(followTimer.current)
    },
    []
  )

  useEffect(() => {
    if (bootAgent) return
    const controller = new AbortController()
    requestJson<{ agent: Agent }>('/api/agent', { signal: controller.signal })
      .then((res) => {
        setBootAgent(res.agent)
        setBootError(null)
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setBootError(errorMessage(error, 'We couldn’t load your agent.'))
      })
    return () => controller.abort()
  }, [bootAgent, bootAttempt])

  // Back from connecting Google Calendar (Skills tab): report the outcome once, then tidy the URL.
  useEffect(() => {
    const url = new URL(window.location.href)
    const connected = url.searchParams.get('connected')
    const oauthError = url.searchParams.get('error')
    if (!connected && !oauthError) return
    if (connected === 'google_calendar') {
      // Booking also needs saved booking settings (the Booking section says when they're missing).
      toast.success('Google Calendar connected', {
        description: 'Check your booking settings below. Once they’re saved, your agent books appointments during calls.',
      })
    }
    else if (oauthError) toast.error('Google Calendar wasn’t connected', { description: googleConnectMessage(oauthError) })
    url.searchParams.delete('connected')
    url.searchParams.delete('error')
    window.history.replaceState(window.history.state, '', url)
  }, [])

  // On phones the tab row scrolls sideways: keep the open tab in view (a
  // ?tab=knowledge link would otherwise open with its tab hidden off-screen).
  const hasAgent = agent !== null
  useEffect(() => {
    const list = tabsListRef.current
    const active = list?.querySelector<HTMLElement>('[data-active]')
    if (!list || !active || list.scrollWidth <= list.clientWidth) return
    const left = active.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft
    if (left < list.scrollLeft || left + active.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = Math.max(0, left - (list.clientWidth - active.offsetWidth) / 2)
    }
    // The Knowledge count badge arrives later and widens the row, so re-check then.
  }, [activeTab, hasAgent, knowledgeHook.docs.length])

  // Phones: more tabs than fit. A fade on the right edge says the row scrolls.
  const [tabsOverflowEnd, setTabsOverflowEnd] = useState(false)
  useEffect(() => {
    const list = tabsListRef.current
    if (!list) return
    const measure = () => setTabsOverflowEnd(list.scrollLeft + list.clientWidth < list.scrollWidth - 4)
    measure()
    list.addEventListener('scroll', measure, { passive: true })
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(list)
    return () => {
      list.removeEventListener('scroll', measure)
      observer?.disconnect()
    }
  }, [hasAgent, knowledgeHook.docs.length])

  const anyDirty = Object.values(dirtyTabs).some(Boolean)
  useEffect(() => {
    if (!anyDirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [anyDirty])

  const goToTab = useCallback((tab: AgentTab) => {
    setActiveTab(tab)
    setDirtyTabs((prev) => ({ ...prev, [tab]: false }))
    // Keep the tab in the URL so reloads and the Google Calendar round trip land back here.
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.replaceState(window.history.state, '', url)
  }, [])

  const requestTab = (value: unknown) => {
    const tab = AGENT_TABS.find((t) => t === value)
    if (!tab || tab === activeTab) return
    if (dirtyTabs[activeTab]) setPendingTab(tab)
    else goToTab(tab)
  }

  if (!agent) {
    if (bootError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 py-24 text-center">
          <div className="mb-4 rounded-full bg-muted p-5">
            <Bot className="size-10 text-muted-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold">We couldn’t load your agent</h1>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{bootError}</p>
          <Button
            className="mt-4"
            onClick={() => {
              setBootError(null)
              setBootAttempt((n) => n + 1)
            }}
          >
            Try again
          </Button>
        </div>
      )
    }
    return (
      <div className="flex flex-col" aria-busy="true" aria-label="Loading your agent">
        <div className="border-b bg-card px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-3xl items-start gap-4">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-6 sm:px-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  const providerSync = followedSync && followedSync.base === agent.provider_sync ? followedSync.state : agent.provider_sync
  const voiceName = agent.cartesia_voice_name ?? agent.voice_name
  const language = AGENT_LANGUAGES.find((l) => l.value === agent.language)?.label ?? agent.language
  const activeNumbers = phoneNumbers.filter((n) => n.is_active).length

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-card px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full border bg-primary/10 sm:size-12">
              <Bot className="size-5 text-primary sm:size-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold">{agent.name}</h1>
                <Badge
                  variant="outline"
                  className={
                    agent.is_active
                      ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400'
                      : 'text-muted-foreground'
                  }
                >
                  {agent.is_active ? 'Active' : 'Paused'}
                </Badge>
                <ProviderSyncChip providerSync={providerSync} busy={isSyncing || isWaitingForSync || followingSync} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {voiceName && (
                  <span className="inline-flex items-center gap-1">
                    <Volume2 className="size-3.5" aria-hidden="true" />
                    {voiceName}
                  </span>
                )}
                <span>{language}</span>
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3.5" aria-hidden="true" />
                  {phoneNumbers.length === 0 ? (
                    <Link href="/phone" className="text-primary underline-offset-4 hover:underline">
                      Add a phone number
                    </Link>
                  ) : (
                    `${activeNumbers} active number${activeNumbers === 1 ? '' : 's'}`
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start rounded-lg border px-3 py-2 sm:self-auto">
            {isTogglingActive && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
            <label htmlFor="agent-active" className="text-sm text-muted-foreground">
              {agent.is_active ? 'On' : 'Off'}
            </label>
            <Switch
              id="agent-active"
              checked={agent.is_active}
              onCheckedChange={() => void toggleActive()}
              disabled={isTogglingActive}
              aria-label={agent.is_active ? 'Pause your agent' : 'Turn your agent on'}
            />
          </div>
        </div>
        <div className="mx-auto mt-3 max-w-3xl empty:mt-0">
          <ProviderSyncNotice
            providerSync={providerSync}
            onRetry={() => {
              stopFollowingSync()
              void resync()
            }}
            retrying={isSyncing}
          />
        </div>
      </div>

      <div className="flex-1">
        <Tabs value={activeTab} onValueChange={requestTab}>
          <div className="relative border-b bg-card px-2 sm:px-6">
            {tabsOverflowEnd && (
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-card to-transparent" />
            )}
            <TabsList
              ref={tabsListRef}
              variant="line"
              className="mx-auto w-full max-w-3xl justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0 group-data-horizontal/tabs:h-11"
            >
              {AGENT_TABS.map((value) => {
                const { label, icon: Icon } = TAB_META[value]
                return (
                  <TabsTrigger
                    key={value}
                    value={value}
                    onPointerEnter={() => preloadTab(value)}
                    onFocus={() => preloadTab(value)}
                    className="relative h-full shrink-0 rounded-none px-2.5 text-sm data-active:font-medium sm:px-4"
                  >
                    {/* Icons only from sm up: on a phone the labels alone come close to fitting. */}
                    <Icon className="size-4 max-sm:hidden" aria-hidden="true" />
                    <span>{label}</span>
                    {value === 'knowledge' && knowledgeHook.docs.length > 0 && (
                      <span className="ml-1 flex size-4 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                        {knowledgeHook.docs.length}
                      </span>
                    )}
                    {dirtyTabs[value] && <span className="size-1.5 rounded-full bg-amber-500" aria-label="unsaved changes" />}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </div>

          {/* w-full: a centred flex child otherwise grows to its widest unbreakable line (an email, a file name) on phones. */}
          <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-0 sm:px-6">
            <TabsContent value="general">
              <TabGeneral
                agent={agent}
                org={org}
                phoneNumbers={phoneNumbers}
                onUpdate={updateWithToast}
                isSaving={isSaving}
                onDirtyChange={onGeneralDirty}
              />
            </TabsContent>

            <TabsContent value="conversation">
              <TabConversation
                agent={agent}
                org={org}
                entitlements={entitlements}
                onUpdate={updateWithToast}
                isSaving={isSaving}
                onDirtyChange={onConversationDirty}
              />
            </TabsContent>

            <TabsContent value="voice" className="pb-6">
              <TabVoice agent={agent} onUpdateVoice={updateVoice} onUpdate={update} isSaving={isSaving} />
            </TabsContent>

            <TabsContent value="knowledge" className="pb-6">
              <TabKnowledge hook={knowledgeHook} />
            </TabsContent>

            <TabsContent value="skills" className="pb-6">
              <TabSkills
                agent={agent}
                onUpdate={updateWithToast}
                isSaving={isSaving}
                onDirtyChange={onSkillsDirty}
                onProviderSyncStarted={followProviderSync}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <Dialog open={pendingTab !== null} onOpenChange={(open) => !open && setPendingTab(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave without saving?</DialogTitle>
            <DialogDescription>
              You have unsaved changes on the {TAB_META[activeTab].label} tab. If you switch tabs now, they’ll be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingTab(null)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const target = pendingTab
                setPendingTab(null)
                setDirtyTabs((prev) => ({ ...prev, [activeTab]: false }))
                if (target) goToTab(target)
              }}
            >
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
