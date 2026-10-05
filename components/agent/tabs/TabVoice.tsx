'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import { AlertCircle, Info, Loader2, Mic, Plus, RotateCw, Trash2, Volume2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { FallbackVoiceSelect } from '@/components/voice/FallbackVoiceSelect'
import { VoiceCloneDialog } from '@/components/voice/VoiceCloneDialog'
import { PreviewButton, voiceDisplayName, voiceLocaleLine } from '@/components/voice/VoiceCard'
import { VoicePicker } from '@/components/voice/VoicePicker'
import { VOICE_SYNC_COPY, VoiceSyncBadge } from '@/components/voice/VoiceSyncBadge'
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
import type { Agent, VoiceOption, VoiceSyncStatus } from '@/types'

export interface TabVoiceProps {
  agent: Agent
  onAgentUpdated: (agent: Agent) => void
}

/** While another request holds the sync ("saving"), re-read the agent until it settles. */
const SYNC_POLL_MS = 4000
const SYNC_POLL_MAX = 15

export function TabVoice({ agent, onAgentUpdated }: TabVoiceProps) {
  const [pendingVoice, setPendingVoice] = useState<VoiceOption | null>(null)
  const [applying, setApplying] = useState<'apply' | 'retry' | null>(null)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VoiceOption | null>(null)
  const [deleting, setDeleting] = useState(false)

  const preview = useAudioPreview()
  const custom = useVoiceCatalog({ source: 'workspace', pageSize: 100 })
  const customVoices = custom.voices.filter((v) => v.source === 'cloned')

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

  return (
    <div className="space-y-6">
      {/* Current voice */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current voice</CardTitle>
          <CardDescription>The voice your agent uses on calls.</CardDescription>
        </CardHeader>
        <CardContent>
          {agent.voice_id ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Volume2 className="size-5 text-primary" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{currentName}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{agent.voice_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  {currentPreviewSource && (
                    <PreviewButton
                      name={currentName}
                      variant="icon"
                      status={preview.statusFor(`current:${agent.voice_id}`)}
                      onClick={() => preview.toggle(`current:${agent.voice_id}`, currentPreviewSource)}
                    />
                  )}
                  <VoiceSyncBadge status={syncStatus} />
                </div>
              </div>

              {syncStatus === 'failed' ? (
                <div
                  role="alert"
                  className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-center"
                >
                  <AlertCircle className="hidden size-4 shrink-0 text-destructive sm:block" aria-hidden="true" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium text-destructive">This voice is not applied yet</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {agent.voice_sync_error || VOICE_SYNC_COPY.failed.description}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={retrySync} disabled={busy} className="gap-1.5">
                    <RotateCw aria-hidden="true" /> Retry
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {VOICE_SYNC_COPY[syncStatus].description}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mic className="size-4" aria-hidden="true" />
              No voice selected yet. Pick one below.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose a voice</CardTitle>
          <CardDescription>Preview voices, pick one, then confirm to apply it to your agent.</CardDescription>
        </CardHeader>
        <CardContent>
          <VoicePicker
            layout="dashboard"
            defaultLanguage={agent.language}
            selectedVoiceId={pendingVoice?.voiceId ?? agent.voice_id}
            onSelect={choose}
            disabled={busy}
          />
        </CardContent>
      </Card>

      {/* Custom (cloned) voices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your custom voices</CardTitle>
          <CardDescription>Voices cloned from your own recordings, with the speaker&apos;s consent.</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => setCloneOpen(true)} className="gap-1.5">
              <Plus aria-hidden="true" /> Clone a voice
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {custom.error ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="min-w-0 flex-1 text-sm text-destructive">{custom.error}</p>
              <Button variant="outline" size="sm" onClick={custom.retry} className="gap-1.5">
                <RotateCw aria-hidden="true" /> Try again
              </Button>
            </div>
          ) : custom.isLoading && custom.voices.length === 0 ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
          ) : customVoices.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
              <Wand2 className="size-6 text-muted-foreground/60" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">No custom voices yet.</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Clone a voice from 1–3 short recordings, for example your receptionist or yourself.
              </p>
            </div>
          ) : (
            <ul className={custom.isLoading ? 'space-y-2 opacity-60' : 'space-y-2'} aria-busy={custom.isLoading}>
              {customVoices.map((voice) => {
                const name = voiceDisplayName(voice)
                const inUse = voice.voiceId === agent.voice_id
                const isPending = voice.voiceId === pendingVoice?.voiceId
                const locale = voiceLocaleLine(voice)
                return (
                  <li key={voice.voiceId} className="flex flex-wrap items-center gap-2 rounded-xl border p-3 sm:flex-nowrap">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        <span className="truncate">{name}</span>
                        {inUse && (
                          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            In use
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{locale.text}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <PreviewButton
                        name={name}
                        variant="icon"
                        status={preview.statusFor(voice.voiceId)}
                        onClick={() => preview.toggle(voice.voiceId, voicePreviewSource(voice, agent.language))}
                      />
                      <Button
                        variant="outline"
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
            <div className="mt-3 flex justify-center">
              <Button variant="ghost" size="sm" onClick={custom.loadMore} disabled={custom.isLoadingMore}>
                {custom.isLoadingMore && <Loader2 className="animate-spin" aria-hidden="true" />}
                Show more voices
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider fallback voice (Cartesia) */}
      <FallbackVoiceSelect agent={agent} onAgentUpdated={onAgentUpdated} />

      <Card className="border-dashed">
        <CardContent className="flex gap-3 py-4">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">
            A new voice applies from the next call. The status above only shows <strong>Active</strong> once our voice
            provider has confirmed the change.
          </p>
        </CardContent>
      </Card>

      {/* Confirm bar */}
      {pendingVoice && (
        <div
          role="region"
          aria-label="Confirm voice change"
          className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center"
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
            <Button variant="outline" size="sm" onClick={() => setPendingVoice(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void applyVoice(agentVoiceBody(pendingVoice), 'apply')}
              disabled={busy}
              className="purple-glow gap-1.5"
            >
              {applying === 'apply' ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  {pendingVoice.requiresProvisioning ? 'Adding voice…' : 'Applying…'}
                </>
              ) : (
                'Apply voice'
              )}
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
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting} className="gap-1.5">
              {deleting && <Loader2 className="animate-spin" aria-hidden="true" />}
              Delete voice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
