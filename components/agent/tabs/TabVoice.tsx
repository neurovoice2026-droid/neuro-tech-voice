'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, Info, Mic, Plus, RotateCw, Trash2, Volume2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { FormSection } from '@/components/shared/FormSection'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { FallbackVoiceSelect } from '@/components/voice/FallbackVoiceSelect'
import { PronunciationCard } from '@/components/voice/PronunciationCard'
import { VoiceCloneDialog } from '@/components/voice/VoiceCloneDialog'
import { useCustomVoiceLimits, useCurrentVoiceNotice } from '@/components/voice/useVoiceStatus'
import { PreviewButton, voiceDisplayName, voiceLocaleLine } from '@/components/voice/VoiceCard'
import { VoicePicker } from '@/components/voice/VoicePicker'
import { VOICE_SYNC_COPY, VoiceSyncBadge } from '@/components/voice/VoiceSyncBadge'
import { VoiceTuningCard } from '@/components/agent/VoiceTuningCard'
import type { AgentHook } from '@/hooks/useAgent'
import { useAudioPreview, voicePreviewSource, type PreviewRequest } from '@/hooks/useAudioPreview'
import {
  ApiError,
  agentVoiceBody,
  errorMessage,
  invalidateVoiceCatalog,
  isAbortError,
  parseApiError,
  saveAgentVoice,
  useVoiceCatalog,
  type AgentVoiceBody,
} from '@/hooks/useVoiceCatalog'
import { cn } from '@/lib/utils'
import type { Agent, VoiceOption, VoiceSyncStatus } from '@/types'

export interface TabVoiceProps {
  agent: Agent
  onAgentUpdated: (agent: Agent) => void
  /** PATCH /api/agent (voice tuning); the tuning card is shown only when given. */
  onUpdate?: AgentHook['updateWithToast']
  isSaving?: boolean
}

/** While another request holds the sync ("saving"), re-read the agent until it settles. */
const SYNC_POLL_MS = 4000
const SYNC_POLL_MAX = 15

export function TabVoice({ agent, onAgentUpdated, onUpdate, isSaving = false }: TabVoiceProps) {
  const [pendingVoice, setPendingVoice] = useState<VoiceOption | null>(null)
  const [applying, setApplying] = useState<'apply' | 'retry' | null>(null)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VoiceOption | null>(null)
  const [deleting, setDeleting] = useState(false)

  const preview = useAudioPreview()
  const custom = useVoiceCatalog({ source: 'workspace', pageSize: 100 })
  const customVoices = custom.voices.filter((v) => v.source === 'cloned' || v.source === 'designed')
  // Retirement / removal notice of the current voice, and what custom voices the plan allows.
  const voiceNotice = useCurrentVoiceNotice(agent.voice_id)
  const limits = useCustomVoiceLimits(customVoices.length)
  const pickerRef = useRef<HTMLDivElement>(null)

  // The status read records the provider's voice of an agent saved without one: reload the agent to show it.
  const pinnedVoiceId = !agent.voice_id ? (voiceNotice?.voice_id ?? null) : null
  const reloadAgent = useEffectEvent((next: Agent) => onAgentUpdated(next))
  useEffect(() => {
    if (!pinnedVoiceId) return
    const controller = new AbortController()
    fetch('/api/agent', { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) return
        const next = (await res.json()) as Agent | null
        if (next?.voice_id) reloadAgent(next)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) return
        // Shown on the next visit; the voice itself is already recorded server-side.
        toast.error('Could not refresh your agent', { description: errorMessage(err, 'Reload the page to see its voice.') })
      })
    return () => controller.abort()
  }, [pinnedVoiceId])

  function goToPicker() {
    pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    pickerRef.current?.focus({ preventScroll: true })
  }

  const syncStatus: VoiceSyncStatus = applying ? 'saving' : (agent.voice_sync_status ?? 'pending')

  // ── Keep the badge honest while a sync started elsewhere is still running ──
  const deliverAgent = useEffectEvent((next: Agent) => onAgentUpdated(next))
  const serverSyncing = agent.voice_sync_status === 'saving' && applying === null

  useEffect(() => {
    if (!serverSyncing) return
    const controller = new AbortController()
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      attempts += 1
      try {
        const res = await fetch('/api/agent', {
          signal: controller.signal,
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        if (res.ok) {
          const next = (await res.json()) as Agent | null
          if (next && next.voice_sync_status !== 'saving') {
            deliverAgent(next)
            return
          }
        }
      } catch (err) {
        if (controller.signal.aborted || isAbortError(err)) return
        // A transient network error: the next poll tries again.
      }
      if (attempts < SYNC_POLL_MAX && !controller.signal.aborted) timer = setTimeout(poll, SYNC_POLL_MS)
    }
    timer = setTimeout(poll, SYNC_POLL_MS)
    return () => {
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [serverSyncing])

  // ── Save ──
  async function applyVoice(body: AgentVoiceBody, mode: 'apply' | 'retry') {
    if (applying) return
    preview.stop()
    setApplying(mode)
    try {
      const result = await saveAgentVoice(body)
      onAgentUpdated(result.agent)
      setPendingVoice(null)
      const name = result.agent.voice_name ?? body.voice_name
      if (result.voice_sync_status === 'synced') {
        toast.success('Voice updated', { description: `Callers now hear ${name}.` })
      } else if (result.voice_sync_status === 'failed') {
        toast.error('Voice saved but not applied', {
          description:
            result.error ?? result.agent.voice_sync_error ?? 'Callers still hear the previous voice. Use Retry to try again.',
        })
      } else {
        toast.info('Voice saved', { description: VOICE_SYNC_COPY.pending.description })
      }
    } catch (err) {
      toast.error('Could not change the voice', {
        description: errorMessage(err, 'Please try again in a moment.'),
      })
    } finally {
      setApplying(null)
    }
  }

  function retrySync() {
    if (!agent.voice_id) return
    void applyVoice({ voice_id: agent.voice_id, voice_name: agent.voice_name ?? agent.voice_id }, 'retry')
  }

  function choose(voice: VoiceOption) {
    setPendingVoice(voice.voiceId === agent.voice_id ? null : voice)
  }

  // ── Delete a cloned voice ──
  async function confirmDelete() {
    const target = deleteTarget
    if (!target || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/voices/${encodeURIComponent(target.voiceId)}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw await parseApiError(res, 'Could not delete this voice.')
      if (preview.activeId === target.voiceId) preview.stop()
      if (pendingVoice?.voiceId === target.voiceId) setPendingVoice(null)
      invalidateVoiceCatalog('workspace')
      toast.success(`"${voiceDisplayName(target)}" deleted`)
      setDeleteTarget(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('This voice is in use', {
          description: 'Choose another voice for your agent before deleting this one.',
        })
      } else {
        toast.error('Could not delete this voice', { description: errorMessage(err, 'Please try again.') })
      }
    } finally {
      setDeleting(false)
    }
  }

  const currentPreviewSource: PreviewRequest | null = agent.voice_id
    ? {
        kind: 'request',
        url: '/api/voices/preview',
        method: 'POST',
        body: { voice_id: agent.voice_id, ...(agent.language ? { language: agent.language } : {}) },
      }
    : null
  const currentName = agent.voice_name ?? 'Unknown voice'
  const busy = applying !== null

  const noticeBanner = voiceNotice?.notice ? (
    <Alert variant="warning" role="status">
      <AlertTriangle aria-hidden="true" />
      <AlertDescription>{voiceNotice.notice.message}</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={goToPicker}>
          Choose a new voice
        </Button>
      </AlertAction>
    </Alert>
  ) : null

  return (
    <div>
      {/* Current voice */}
      <FormSection title="Current voice" description="The voice your agent uses on calls.">
        {agent.voice_id ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 shadow-hair">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-medium text-foreground"
                aria-hidden="true"
              >
                {currentName.trim().charAt(0).toUpperCase() || <Volume2 className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] leading-6 font-medium">{currentName}</p>
                <p className="truncate font-mono text-xs leading-4 text-muted-foreground">{agent.voice_id}</p>
              </div>
              <div className="flex items-center gap-2">
                <VoiceSyncBadge status={syncStatus} />
                {currentPreviewSource && (
                  <PreviewButton
                    name={currentName}
                    variant="icon"
                    status={preview.statusFor(`current:${agent.voice_id}`)}
                    onClick={() => preview.toggle(`current:${agent.voice_id}`, currentPreviewSource)}
                  />
                )}
              </div>
            </div>

            {noticeBanner}

            {syncStatus === 'failed' ? (
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>This voice is not applied yet</AlertTitle>
                <AlertDescription>{agent.voice_sync_error || VOICE_SYNC_COPY.failed.description}</AlertDescription>
                <AlertAction>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={retrySync}
                    disabled={busy && applying !== 'retry'}
                    loading={applying === 'retry'}
                    loadingState="connecting"
                  >
                    <RotateCw aria-hidden="true" /> Retry
                  </Button>
                </AlertAction>
              </Alert>
            ) : (
              <p className="text-xs leading-[18px] text-muted-foreground" aria-live="polite">
                {VOICE_SYNC_COPY[syncStatus].description}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3.5 text-sm text-muted-foreground">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-foreground shadow-hair" aria-hidden="true">
                <Mic className="size-4" />
              </span>
              No voice selected yet. Pick one below.
            </div>
            {noticeBanner}
          </div>
        )}
      </FormSection>

      {/* Picker: full width (the voice grid needs the room), focus target of "Choose a new voice". */}
      <section
        ref={pickerRef}
        tabIndex={-1}
        aria-labelledby="choose-voice-title"
        className="scroll-mt-16 space-y-5 border-t border-rule py-8 outline-none"
      >
        <div>
          <h2 id="choose-voice-title" className="text-[15px] leading-[22px] font-medium">Choose a voice</h2>
          <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">
            Preview voices, pick one, then confirm to apply it to your agent.
          </p>
        </div>
        <VoicePicker
          layout="dashboard"
          defaultLanguage={agent.language}
          selectedVoiceId={pendingVoice?.voiceId ?? agent.voice_id}
          onSelect={choose}
          disabled={busy}
          design={{
            unavailableReason: limits.unavailableReason,
            onSaved: (voice) => setPendingVoice(voice.voiceId === agent.voice_id ? null : voice),
          }}
        />
      </section>

      {/* Custom (cloned / designed) voices */}
      <FormSection
        title="Your custom voices"
        description="Voices cloned from your own recordings (with the speaker's consent) or designed from a description."
        aside={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCloneOpen(true)}
            disabled={!!limits.unavailableReason}
            aria-describedby={limits.unavailableReason ? 'custom-voices-unavailable' : undefined}
          >
            <Plus aria-hidden="true" /> Clone a voice
          </Button>
        }
      >
        {limits.unavailableReason && (
          <p id="custom-voices-unavailable" className="text-xs leading-[18px] text-muted-foreground">
            {limits.unavailableReason}
          </p>
        )}
        {custom.error ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertDescription>{custom.error}</AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={custom.retry}>
                <RotateCw aria-hidden="true" /> Try again
              </Button>
            </AlertAction>
          </Alert>
        ) : custom.isLoading && custom.voices.length === 0 ? (
          // The empty state's shell and height (most accounts have no custom voice yet), so nothing jumps.
          <OrbLoader
            size={32}
            layout="row"
            label="Loading your custom voices…"
            className="min-h-[204px] justify-center rounded-2xl bg-secondary px-6"
          />
        ) : customVoices.length === 0 ? (
          <EmptyState
            icon={Wand2}
            title="No custom voices yet."
            description="Clone a voice from 1–3 short recordings, for example your receptionist or yourself."
            className="py-10"
          />
        ) : (
          <ul
            className={cn('overflow-hidden rounded-2xl bg-card shadow-hair transition-opacity', custom.isLoading && 'opacity-60')}
            aria-busy={custom.isLoading}
          >
            {customVoices.map((voice) => {
              const name = voiceDisplayName(voice)
              const inUse = voice.voiceId === agent.voice_id
              const isPending = voice.voiceId === pendingVoice?.voiceId
              const locale = voiceLocaleLine(voice)
              return (
                <li
                  key={voice.voiceId}
                  className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-4 py-3 last:border-b-0 sm:flex-nowrap"
                >
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium"
                    aria-hidden="true"
                  >
                    {name.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm leading-5 font-medium">
                      <span className="truncate">{name}</span>
                      {inUse && (
                        <Badge variant="secondary" className="h-5 px-2 text-[11px]">
                          In use
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs leading-4 text-muted-foreground">{locale.text}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <PreviewButton
                      name={name}
                      variant="icon"
                      status={preview.statusFor(voice.voiceId)}
                      onClick={() => preview.toggle(voice.voiceId, voicePreviewSource(voice, agent.language))}
                    />
                    <Button
                      variant={inUse || isPending ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => choose(voice)}
                      disabled={inUse || isPending || busy}
                    >
                      {inUse ? 'Current' : isPending ? 'Selected' : 'Use voice'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(voice)}
                      disabled={inUse || busy}
                      aria-label={`Delete ${name}`}
                      title={inUse ? 'Choose another voice for your agent before deleting this one' : 'Delete voice'}
                      className="tap-44 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {custom.hasMore && !custom.error && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={custom.loadMore}
              loading={custom.isLoadingMore}
              loadingState="breathing"
            >
              Show more voices
            </Button>
          </div>
        )}
      </FormSection>

      {onUpdate && <VoiceTuningCard agent={agent} onUpdate={onUpdate} isSaving={isSaving} />}

      <PronunciationCard agent={agent} />

      {/* Provider fallback voice (Cartesia) */}
      <FallbackVoiceSelect agent={agent} onAgentUpdated={onAgentUpdated} />

      <p className="flex gap-2.5 rounded-2xl bg-secondary px-4 py-3.5 text-xs leading-[18px] text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 text-foreground" aria-hidden="true" />
        <span>
          A new voice applies from the next call. The status above only shows{' '}
          <strong className="font-medium text-foreground">Active</strong> once our voice provider has confirmed the change.
        </span>
      </p>

      {/* Confirm bar */}
      {pendingVoice && (
        <div
          role="region"
          aria-label="Confirm voice change"
          className="sticky bottom-4 z-10 mt-6 flex flex-col gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-pop backdrop-blur-md sm:flex-row sm:items-center sm:pl-5"
        >
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate">
              <span className="font-medium">{voiceDisplayName(pendingVoice)}</span>
              <span className="ml-2 text-muted-foreground">selected. Apply it to your agent?</span>
            </p>
            {pendingVoice.requiresProvisioning && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                This library voice will be added to your workspace.
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPendingVoice(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void applyVoice(agentVoiceBody(pendingVoice), 'apply')}
              disabled={busy && applying !== 'apply'}
              loading={applying === 'apply'}
              loadingText={pendingVoice.requiresProvisioning ? 'Adding voice…' : 'Applying…'}
            >
              Apply voice
            </Button>
          </div>
        </div>
      )}

      <VoiceCloneDialog
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        onCloned={(voice) => setPendingVoice(voice.voiceId === agent.voice_id ? null : voice)}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this voice?</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget ? voiceDisplayName(deleteTarget) : ''}&quot; will be permanently deleted from your
              workspace and from our voice provider. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive-solid"
              onClick={() => void confirmDelete()}
              loading={deleting}
              loadingText="Deleting…"
            >
              Delete voice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
