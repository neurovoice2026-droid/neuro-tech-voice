'use client'

import { useId, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { AlertCircle, FileAudio, Info, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field } from '@/components/shared/FormSection'
import { OrbLoader } from '@/components/shared/OrbLoader'
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

const GENDER_ITEMS: Record<string, string> = { unset: 'Not specified', female: 'Female', male: 'Male', neutral: 'Neutral' }

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
    gender: useId(),
    noise: useId(),
    noiseHint: useId(),
  }
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [speakerName, setSpeakerName] = useState('')
  const [consent, setConsent] = useState(false)
  const [rights, setRights] = useState(false)
  const [gender, setGender] = useState('unset')
  const [noisy, setNoisy] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [dragging, setDragging] = useState(false)

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
    setGender('unset')
    setNoisy(false)
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

  // The upload area also takes dropped files (same checks as the picker). The
  // handlers sit on its wrapper so a drop is never left to the browser, which
  // would open the file in the tab and lose the dialog, even when it is full.
  const isFileDrag = (e: DragEvent<HTMLElement>) => Array.from(e.dataTransfer.types).includes('Files')
  const dropHandlers = {
    onDragOver: (e: DragEvent<HTMLDivElement>) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      // A full list still takes the drop (it explains the limit) but is not highlighted.
      setDragging(files.length < MAX_FILES)
    },
    onDragLeave: (e: DragEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
    },
    onDrop: (e: DragEvent<HTMLDivElement>) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      setDragging(false)
      addFiles(e.dataTransfer.files)
    },
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
      if (gender !== 'unset') form.append('gender', gender)
      if (noisy) form.append('remove_background_noise', 'true')
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
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={handleSubmit} className="grid min-w-0 gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>Clone a voice</DialogTitle>
            <DialogDescription>
              Create an instant voice clone from short recordings. Only clone a voice you are allowed to use.
            </DialogDescription>
          </DialogHeader>

          {submitting ? (
            // The upload cannot be cancelled halfway: the orb holds the dialog until the provider answers.
            <OrbLoader
              state="shaping"
              size={64}
              label="Creating voice…"
              delayMs={0}
              className="min-h-[320px] rounded-2xl bg-secondary px-6"
            />
          ) : (
            <div className="grid min-w-0 gap-6">
              {/* A failed attempt is explained first, where the form comes back into view. */}
              {submitError && (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden="true" />
                  <AlertTitle>{submitError}</AlertTitle>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Voice name" htmlFor={ids.name}>
                  <Input
                    id={ids.name}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={MAX_NAME_LENGTH}
                    placeholder="e.g. Front desk – Ana"
                    autoComplete="off"
                    required
                  />
                </Field>
                <Field label="Speaker's full name" htmlFor={ids.speaker}>
                  <Input
                    id={ids.speaker}
                    value={speakerName}
                    onChange={(e) => setSpeakerName(e.target.value)}
                    maxLength={MAX_NAME_LENGTH}
                    placeholder="e.g. Ana Popescu"
                    autoComplete="off"
                    required
                  />
                </Field>
              </div>

              <div className="grid gap-2">
                <Label id={ids.gender}>
                  Voice gender <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Select items={GENDER_ITEMS} value={gender} onValueChange={(v) => typeof v === 'string' && setGender(v)}>
                  <SelectTrigger aria-labelledby={ids.gender} className="w-full sm:w-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GENDER_ITEMS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Recordings */}
              <div className="grid min-w-0 gap-3">
                <div className="flex min-h-4 items-center justify-between gap-3">
                  <Label htmlFor={ids.files}>Recordings</Label>
                  <span
                    className={cn('text-xs tabular-nums', overLimit ? 'font-medium text-destructive' : 'text-muted-foreground')}
                  >
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
                  disabled={files.length >= MAX_FILES}
                  onChange={(e) => {
                    addFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
                {/* Upload area (§7 dropzone): click to open the file picker, or drop files on it. */}
                <div {...dropHandlers}>
                  <button
                    type="button"
                    aria-describedby={ids.filesHint}
                    disabled={files.length >= MAX_FILES}
                    onClick={() => fileInputRef.current?.click()}
                    data-drag={dragging || undefined}
                    className="group/drop flex w-full flex-col items-center gap-1 rounded-2xl border border-dashed border-[#d6d4dc] bg-band px-6 py-7 text-center transition-colors duration-200 outline-none hover:border-foreground/30 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#d6d4dc] disabled:hover:bg-band data-drag:border-foreground/40 data-drag:bg-secondary"
                  >
                    <span className="mb-2 grid size-10 place-items-center rounded-full bg-white shadow-hair">
                      <Upload className="size-4 text-foreground" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium text-foreground">Add audio files</span>
                    <span className="text-xs text-muted-foreground">MP3, WAV, M4A, OGG or WebM</span>
                  </button>
                </div>
                <p id={ids.filesHint} className="text-xs leading-4 text-muted-foreground">
                  1–3 recordings, 4 MB in total. About 1–2 minutes of clear speech from one person, with no music or
                  background noise, gives the best result.
                </p>

                {files.length > 0 && (
                  <ul className="overflow-hidden rounded-2xl shadow-hair" aria-label="Selected recordings">
                    {files.map((f) => {
                      const key = fileKey(f)
                      const ext = extensionOf(f).replace('.', '')
                      return (
                        <li
                          key={key}
                          className="flex min-h-12 items-center gap-3 border-b border-rule px-3 py-2 last:border-b-0"
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary">
                            <FileAudio className="size-4 text-foreground" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm" title={f.name}>
                            {f.name}
                          </span>
                          {ext && (
                            <span className="hidden rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase sm:inline">
                              {ext}
                            </span>
                          )}
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatFileSize(f.size)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeFile(key)}
                            aria-label={`Remove ${f.name}`}
                            className="tap-44"
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {overLimit && (
                  <p role="alert" className="flex items-start gap-1.5 text-xs leading-4 text-destructive">
                    <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    The recordings add up to {formatFileSize(totalBytes)}. Remove or shorten one to stay under 4 MB.
                  </p>
                )}
                {fileError && (
                  <p role="alert" className="flex items-start gap-1.5 text-xs leading-4 text-destructive">
                    <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    {fileError}
                  </p>
                )}

                <div className="flex items-start gap-2.5 pt-1">
                  <Checkbox
                    id={ids.noise}
                    checked={noisy}
                    onCheckedChange={(v) => setNoisy(v)}
                    className="mt-px"
                    aria-describedby={ids.noiseHint}
                  />
                  <div className="grid gap-0.5">
                    <Label htmlFor={ids.noise} className="cursor-pointer text-sm leading-5 font-normal">
                      My recordings have background noise
                    </Label>
                    <p id={ids.noiseHint} className="text-xs leading-4 text-muted-foreground">
                      The noise is removed before cloning. Leave this off for clean recordings: it can make them sound
                      worse.
                    </p>
                  </div>
                </div>
              </div>

              {/* Privacy notice */}
              <Alert role="note">
                <Info aria-hidden="true" />
                <AlertDescription>
                  <p>
                    Your recordings are sent to our voice provider (ElevenLabs) to create the voice. We do not store the
                    audio files.
                  </p>
                  <p>You can delete this voice at any time from this page, which also removes it from the provider.</p>
                </AlertDescription>
              </Alert>

              {/* Consent */}
              <fieldset className="grid gap-3">
                <legend className="mb-3 flex items-center gap-1.5 text-[13px] leading-4 font-medium">
                  <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
                  Consent (required)
                </legend>
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id={ids.consent}
                    checked={consent}
                    onCheckedChange={(v) => setConsent(v)}
                    className="mt-px"
                    aria-required="true"
                  />
                  <Label htmlFor={ids.consent} className="cursor-pointer text-sm leading-5 font-normal">
                    I am this speaker, or I have their explicit written consent to clone their voice.
                  </Label>
                </div>
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id={ids.rights}
                    checked={rights}
                    onCheckedChange={(v) => setRights(v)}
                    className="mt-px"
                    aria-required="true"
                  />
                  <Label htmlFor={ids.rights} className="cursor-pointer text-sm leading-5 font-normal">
                    I have the rights to use this voice commercially and accept that it will be processed by our voice
                    provider.
                  </Label>
                </div>
              </fieldset>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              loading={submitting}
              loadingState="shaping"
              loadingText="Creating voice…"
            >
              Create voice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
