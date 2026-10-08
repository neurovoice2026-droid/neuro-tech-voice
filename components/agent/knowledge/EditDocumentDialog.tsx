'use client'

// Rename a document, or edit pasted text in place (same document on the
// agent: no delete and re-add). Text can only be edited once the document is
// on the agent (PATCH /api/agent/knowledge/[docId] refuses a text edit
// otherwise); until then the dialog only renames it.

import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/shared/FormSection'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { KNOWLEDGE_LIMITS, type KnowledgeDoc } from '@/hooks/useKnowledge'
import { cn } from '@/lib/utils'

/** Pasted text whose content can be edited in place: settled on the agent (provider copy present). */
export function canEditDocumentText(doc: KnowledgeDoc): boolean {
  return doc.type === 'text' && doc.status === 'ready' && !!doc.elevenlabs_doc_id && !doc.deleting_at
}

interface EditDocumentDialogProps {
  doc: KnowledgeDoc | null
  onClose: () => void
  loadText: (docId: string) => Promise<string | null>
  onSave: (docId: string, patch: { name?: string; text?: string }) => Promise<boolean>
}

export function EditDocumentDialog({ doc, onClose, loadText, onSave }: EditDocumentDialogProps) {
  const [saving, setSaving] = useState(false)
  return (
    <Dialog open={!!doc} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        {doc && <EditForm key={doc.id} doc={doc} onClose={onClose} loadText={loadText} onSave={onSave} saving={saving} setSaving={setSaving} />}
      </DialogContent>
    </Dialog>
  )
}

function EditForm({
  doc,
  onClose,
  loadText,
  onSave,
  saving,
  setSaving,
}: Omit<EditDocumentDialogProps, 'doc'> & { doc: KnowledgeDoc; saving: boolean; setSaving: (v: boolean) => void }) {
  const isText = canEditDocumentText(doc)
  // Pasted text that is not on the agent yet (failed or not attached): rename only.
  const textLocked = doc.type === 'text' && !isText
  const [name, setName] = useState(doc.name)
  const [text, setText] = useState('')
  const [original, setOriginal] = useState<string | null>(null)
  const [loading, setLoading] = useState(isText)

  useEffect(() => {
    if (!isText) return
    let cancelled = false
    void loadText(doc.id).then((value) => {
      if (cancelled) return
      setOriginal(value)
      setText(value ?? '')
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [doc.id, isText, loadText])

  const trimmed = name.trim()
  const tooLong = text.length > KNOWLEDGE_LIMITS.maxTextChars
  const textUnavailable = isText && !loading && original === null
  const nameChanged = trimmed !== doc.name
  const textChanged = isText && original !== null && text !== original
  const canSave = !!trimmed && (nameChanged || textChanged) && !tooLong && !saving && !loading && (!isText || !!text.trim())

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    const ok = await onSave(doc.id, { ...(nameChanged ? { name: trimmed } : {}), ...(textChanged ? { text } : {}) })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isText ? 'Edit text' : 'Rename document'}</DialogTitle>
        <DialogDescription>
          {isText
            ? 'Changes reach your agent right away. The document stays on your agent while you edit it.'
            : textLocked
              ? 'This text is not on your agent yet, so only its name can be changed now. Retry the document first, then you can edit its text.'
              : 'The new name is shown to your agent as the title of this document.'}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-5">
        <Field label="Name" htmlFor="kb-edit-name">
          <Input id="kb-edit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={KNOWLEDGE_LIMITS.maxNameChars} disabled={saving} />
        </Field>
        {isText && (
          <div className="grid gap-2">
            <Field label="Text" htmlFor="kb-edit-text">
              {loading ? (
                <OrbLoader size={32} label="Loading the text…" className="h-48 rounded-[10px] bg-band" />
              ) : (
                <Textarea
                  id="kb-edit-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-48 max-h-[50vh] overflow-y-auto"
                  disabled={saving || original === null}
                  aria-invalid={tooLong || undefined}
                  aria-describedby={textUnavailable ? 'kb-edit-text-unavailable' : undefined}
                />
              )}
            </Field>
            {/* A load failure, not a validation error: the (disabled) field is not marked invalid. */}
            {textUnavailable && (
              <p id="kb-edit-text-unavailable" role="alert" className="flex items-start gap-1.5 text-xs leading-4 text-destructive">
                <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                <span>The text could not be loaded. You can still rename the document.</span>
              </p>
            )}
            <p className={cn('text-xs tabular-nums', tooLong ? 'text-destructive' : 'text-muted-foreground')}>
              {text.length.toLocaleString()} / {KNOWLEDGE_LIMITS.maxTextChars.toLocaleString()} characters
            </p>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={() => void save()} disabled={!canSave} loading={saving} loadingText="Saving…">
          Save
        </Button>
      </DialogFooter>
    </>
  )
}
