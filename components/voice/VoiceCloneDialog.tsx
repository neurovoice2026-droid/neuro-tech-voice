'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, FileAudio, Info, Loader2, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { voiceDisplayName } from '@/components/voice/VoiceCard'
import { ApiError, errorMessage, invalidateVoiceCatalog, parseApiError } from '@/hooks/useVoiceCatalog'
import { cn, formatFileSize } from '@/lib/utils'
import type { VoiceOption } from '@/types'

const MAX_FILES = 3
/** Whole request must stay under the hosting body limit (~4.5 MB). */
const MAX_TOTAL_BYTES = 4 * 1024 * 1024
const MAX_NAME_LENGTH = 100
/** Formats the server accepts (it verifies the file signature as well). */
const MIME_BY_EXTENSION: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.webm': 'audio/webm',
}
const AUDIO_EXTENSIONS = Object.keys(MIME_BY_EXTENSION)
const ACCEPT = AUDIO_EXTENSIONS.join(',')

function extensionOf(file: File): string {
  const lower = file.name.toLowerCase()
  return AUDIO_EXTENSIONS.find((ext) => lower.endsWith(ext)) ?? ''
}

function isAudioFile(file: File): boolean {
  return !!extensionOf(file)
}

/** Some browsers report no MIME type (e.g. .m4a/.wav on Windows): derive it from the extension. */
function withAudioType(file: File): File {
  if (file.type.startsWith('audio/')) return file
  const type = MIME_BY_EXTENSION[extensionOf(file)]
  return type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file
}

const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`

export interface VoiceCloneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Called with the new workspace voice once it is usable; the workspace
   * catalog is refreshed already. Not called while the provider still has to
   * verify the clone (it cannot be selected until then).
   */
  onCloned?: (voice: VoiceOption) => void
}

export function VoiceCloneDialog({ open, onOpenChange, onCloned }: VoiceCloneDialogProps) {
  const ids = {
    name: useId(),
    speaker: useId(),
    consent: useId(),
    rights: useId(),
    files: useId(),
    filesHint: useId(),
  }
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [speakerName, setSpeakerName] = useState('')
  const [consent, setConsent] = useState(false)
  const [rights, setRights] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
  const overLimit = totalBytes > MAX_TOTAL_BYTES
  const canSubmit =
    !submitting &&
    name.trim().length > 0 &&
    speakerName.trim().length > 0 &&
    consent &&
    rights &&
    files.length >= 1 &&
    files.length <= MAX_FILES &&
    !overLimit

  function reset() {
    setName('')
    setSpeakerName('')
    setConsent(false)
    setRights(false)
    setFiles([])
    setFileError(null)
    setSubmitError(null)
  }

  function handleOpenChange(next: boolean) {
    // The upload cannot be cancelled halfway (the provider may already be
    // creating the voice), so the dialog stays open until it finishes.
    if (!next && submitting) return
    if (!next) reset()
    onOpenChange(next)
  }

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    const incoming = Array.from(list)
    const rejected = incoming.filter((f) => !isAudioFile(f))
    const seen = new Set(files.map(fileKey))
    const accepted = incoming.filter((f) => isAudioFile(f) && !seen.has(fileKey(f)))
    const merged = [...files, ...accepted]
    let error: string | null = null
    if (rejected.length > 0) {
      error = `${rejected.map((f) => f.name).join(', ')} ${rejected.length === 1 ? 'is' : 'are'} not an audio file.`
    }
    if (merged.length > MAX_FILES) {
      error = `You can add up to ${MAX_FILES} recordings. Remove one to add another.`
    }
    setFiles(merged.slice(0, MAX_FILES))
    setFileError(error)
    setSubmitError(null)
  }

  function removeFile(key: string) {
    setFiles((prev) => prev.filter((f) => fileKey(f) !== key))
    setFileError(null)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const form = new FormData()
      form.append('name', name.trim())
      form.append('speaker_name', speakerName.trim())
      form.append('consent', 'true')
      form.append('rights_attestation', 'true')
      for (const file of files) form.append('files', withAudioType(file), file.name)

      const res = await fetch('/api/voices/clone', { method: 'POST', body: form })
      if (!res.ok) throw await parseApiError(res, 'Could not create the voice. Please try again.')
      // A clone the provider would hold for verification is rejected by the
      // server (422 with a product message), shown below via submitError.
      const json = (await res.json()) as { voice?: VoiceOption }
      if (!json.voice) throw new ApiError('Unexpected response while creating the voice.', res.status)

      invalidateVoiceCatalog('workspace')
      toast.success(`"${voiceDisplayName(json.voice)}" is ready`, {
        description: 'You can now choose it as your agent’s voice.',
      })
      onCloned?.(json.voice)
      reset()
      onOpenChange(false)
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 413
          ? 'These recordings are too large. Keep the total under 4 MB.'
          : errorMessage(err, 'Could not create the voice. Please try again.')
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Clone a voice</DialogTitle>
            <DialogDescription>
              Create an instant voice clone from short recordings. Only clone a voice you are allowed to use.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={ids.name}>Voice name</Label>
              <Input
                id={ids.name}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_NAME_LENGTH}
                placeholder="e.g. Front desk – Ana"
                autoComplete="off"
                disabled={submitting}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={ids.speaker}>Speaker&apos;s full name</Label>
              <Input
                id={ids.speaker}
                value={speakerName}
                onChange={(e) => setSpeakerName(e.target.value)}
                maxLength={MAX_NAME_LENGTH}
                placeholder="e.g. Ana Popescu"
                autoComplete="off"
                disabled={submitting}
                required
              />
            </div>
          </div>

          {/* Recordings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={ids.files}>Recordings</Label>
              <span className={cn('text-xs', overLimit ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                {formatFileSize(totalBytes)} of 4 MB · {files.length}/{MAX_FILES} files
              </span>
            </div>
            <input
              ref={fileInputRef}
              id={ids.files}
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-describedby={ids.filesHint}
              disabled={submitting || files.length >= MAX_FILES}
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full flex-col gap-1 border-dashed py-4"
              aria-describedby={ids.filesHint}
              disabled={submitting || files.length >= MAX_FILES}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">Add audio files</span>
              <span className="text-xs font-normal text-muted-foreground">MP3, WAV, M4A, OGG or WebM</span>
            </Button>
            <p id={ids.filesHint} className="text-xs text-muted-foreground">
              1–3 recordings, 4 MB in total. About 1–2 minutes of clear speech from one person, with no music or
              background noise, gives the best result.
            </p>

            {files.length > 0 && (
              <ul className="space-y-1.5" aria-label="Selected recordings">
                {files.map((f) => {
                  const key = fileKey(f)
                  return (
                    <li key={key} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                      <FileAudio className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate" title={f.name}>
                        {f.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(f.size)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeFile(key)}
                        disabled={submitting}
                        aria-label={`Remove ${f.name}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
            {overLimit && (
              <p role="alert" className="text-xs text-destructive">
                The recordings add up to {formatFileSize(totalBytes)}. Remove or shorten one to stay under 4 MB.
              </p>
            )}
            {fileError && (
              <p role="alert" className="text-xs text-destructive">
                {fileError}
              </p>
            )}
          </div>

          {/* Privacy notice */}
          <div className="flex gap-2.5 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p>
                Your recordings are sent to our voice provider (ElevenLabs) to create the voice. We do not store the
                audio files.
              </p>
              <p>You can delete this voice at any time from this page, which also removes it from the provider.</p>
            </div>
          </div>

          {/* Consent */}
          <fieldset className="space-y-3" disabled={submitting}>
            <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
              Consent (required)
            </legend>
            <div className="flex items-start gap-2.5">
              <Checkbox
                id={ids.consent}
                checked={consent}
                onCheckedChange={(v) => setConsent(v)}
                className="mt-0.5"
                aria-required="true"
              />
              <Label htmlFor={ids.consent} className="cursor-pointer text-sm leading-relaxed font-normal">
                I am this speaker, or I have their explicit written consent to clone their voice.
              </Label>
            </div>
            <div className="flex items-start gap-2.5">
              <Checkbox
                id={ids.rights}
                checked={rights}
                onCheckedChange={(v) => setRights(v)}
                className="mt-0.5"
                aria-required="true"
              />
              <Label htmlFor={ids.rights} className="cursor-pointer text-sm leading-relaxed font-normal">
                I have the rights to use this voice commercially and accept that it will be processed by our voice
                provider.
              </Label>
            </div>
          </fieldset>

          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>{submitError}</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} className="gap-1.5">
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" /> Creating voice…
                </>
              ) : (
                'Create voice'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
