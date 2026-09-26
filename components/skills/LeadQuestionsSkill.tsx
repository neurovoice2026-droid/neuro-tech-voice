'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ClipboardList, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SkillSection } from '@/components/skills/SkillSection'
import type { AgentUpdate } from '@/components/agent/types'
import { AGENT_LIMITS } from '@/lib/voice/sync/limits'
import type { LeadField } from '@/types'

export const MAX_LEAD_FIELDS = AGENT_LIMITS.leadFields
const LABEL_MAX = 60
const QUESTION_MAX = 200

const SUGGESTIONS: { label: string; question: string }[] = [
  { label: 'Need', question: 'What can we help you with?' },
  { label: 'Timing', question: 'When would you like this done?' },
  { label: 'Budget', question: 'Do you have a budget in mind?' },
  { label: 'Email', question: 'What email address can we send details to?' },
  { label: 'Address', question: 'What’s the address for the job?' },
  { label: 'How they found us', question: 'How did you hear about us?' },
]

interface FieldDraft {
  /** Stored key; null until first saved (generated from the label). */
  key: string | null
  uid: string
  label: string
  question: string
  required: boolean
}

let uidCounter = 0
function nextUid(): string {
  uidCounter += 1
  return `lead-${uidCounter}`
}

/** "How they found us" → how_they_found_us; unique among the other keys. */
export function leadFieldKey(label: string, taken: Set<string>): string {
  const base =
    label
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      // Keys are at most 40 characters: room for a "q_" prefix and a "_12" suffix.
      .slice(0, 34) || 'answer'
  const start = /^[a-z]/.test(base) ? base : `q_${base}`
  let key = start
  for (let i = 2; taken.has(key); i++) key = `${start}_${i}`
  return key
}

function toDrafts(fields: LeadField[]): FieldDraft[] {
  return fields.map((f) => ({ key: f.key, uid: nextUid(), label: f.label, question: f.question, required: f.required }))
}

function toFields(drafts: FieldDraft[]): LeadField[] {
  const taken = new Set(drafts.map((d) => d.key).filter((k): k is string => Boolean(k)))
  return drafts.map((d) => {
    let key = d.key
    if (!key) {
      key = leadFieldKey(d.label, taken)
      taken.add(key)
    }
    return { key, label: d.label.trim(), question: d.question.trim(), required: d.required }
  })
}

function comparable(fields: LeadField[]): string {
  return JSON.stringify(fields.map((f) => [f.label.trim(), f.question.trim(), f.required]))
}

interface LeadQuestionsSkillProps {
  leadFields: LeadField[]
  onUpdate: AgentUpdate
  isSaving: boolean
  onDirtyChange?: (dirty: boolean) => void
}

export function LeadQuestionsSkill({ leadFields, onUpdate, isSaving, onDirtyChange }: LeadQuestionsSkillProps) {
  const [drafts, setDrafts] = useState<FieldDraft[]>(() => toDrafts(leadFields))
  const [saving, setSaving] = useState(false)

  const savedComparable = useMemo(() => comparable(leadFields), [leadFields])
  const dirty = comparable(toFields(drafts)) !== savedComparable

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const errors = drafts.map((d) => ({
    label: !d.label.trim() ? 'Add a short label.' : d.label.trim().length > LABEL_MAX ? `Under ${LABEL_MAX} characters.` : null,
    question: !d.question.trim()
      ? 'Write the question your agent asks.'
      : d.question.trim().length > QUESTION_MAX
        ? `Under ${QUESTION_MAX} characters.`
        : null,
  }))
  const invalid = errors.some((e) => e.label || e.question)

  const update = (uid: string, patch: Partial<FieldDraft>) => setDrafts((list) => list.map((d) => (d.uid === uid ? { ...d, ...patch } : d)))
  const move = (index: number, delta: number) =>
    setDrafts((list) => {
      const target = index + delta
      if (target < 0 || target >= list.length) return list
      const next = [...list]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  const add = (preset?: { label: string; question: string }) =>
    setDrafts((list) =>
      list.length >= MAX_LEAD_FIELDS
        ? list
        : [...list, { key: null, uid: nextUid(), label: preset?.label ?? '', question: preset?.question ?? '', required: false }]
    )

  const save = async () => {
    if (invalid) return
    setSaving(true)
    const fields = toFields(drafts)
    const ok = await onUpdate({ lead_fields: fields }, 'Lead questions saved')
    if (ok) setDrafts((list) => list.map((d, i) => ({ ...d, key: fields[i].key, label: fields[i].label, question: fields[i].question })))
    setSaving(false)
  }

  const unusedSuggestions = SUGGESTIONS.filter((s) => !drafts.some((d) => d.label.trim().toLowerCase() === s.label.toLowerCase()))
  const busy = saving || isSaving

  return (
    <SkillSection
      id="lead-questions"
      icon={ClipboardList}
      title="Lead questions"
      description="Questions your agent works into the conversation. The answers are saved on each call and sent to your workflows."
      status={leadFields.length > 0 ? { label: `${leadFields.length} question${leadFields.length === 1 ? '' : 's'}`, tone: 'on' } : { label: 'None yet', tone: 'off' }}
    >
      <div className="space-y-3">
        {drafts.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            No questions yet. Your agent still takes the caller’s name and reason for calling.
          </p>
        ) : (
          <ol className="space-y-2">
            {drafts.map((draft, index) => (
              <li key={draft.uid} className="rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-xs font-medium text-muted-foreground">{index + 1}.</span>
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[10rem_1fr]">
                    <div>
                      <Label htmlFor={`${draft.uid}-label`} className="sr-only">
                        Label
                      </Label>
                      <Input
                        id={`${draft.uid}-label`}
                        value={draft.label}
                        onChange={(e) => update(draft.uid, { label: e.target.value })}
                        placeholder="Label, e.g. Budget"
                        aria-invalid={Boolean(errors[index].label)}
                      />
                      {errors[index].label && <p className="mt-1 text-xs text-destructive">{errors[index].label}</p>}
                    </div>
                    <div>
                      <Label htmlFor={`${draft.uid}-question`} className="sr-only">
                        Question
                      </Label>
                      <Input
                        id={`${draft.uid}-question`}
                        value={draft.question}
                        onChange={(e) => update(draft.uid, { question: e.target.value })}
                        placeholder="What your agent asks"
                        aria-invalid={Boolean(errors[index].question)}
                      />
                      {errors[index].question && <p className="mt-1 text-xs text-destructive">{errors[index].question}</p>}
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <Switch
                        id={`${draft.uid}-required`}
                        size="sm"
                        checked={draft.required}
                        onCheckedChange={(v) => update(draft.uid, { required: v })}
                      />
                      <Label htmlFor={`${draft.uid}-required`} className="text-xs font-normal text-muted-foreground">
                        Must ask (otherwise only when it fits the conversation)
                      </Label>
                    </div>
                  </div>
                  {/* Stacked beside the fields on phones, so each control gets a full 36 px target. */}
                  <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:gap-0.5">
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move question ${index + 1} up`} className="max-sm:size-9">
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => move(index, 1)}
                      disabled={index === drafts.length - 1}
                      aria-label={`Move question ${index + 1} down`}
                      className="max-sm:size-9"
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDrafts((list) => list.filter((d) => d.uid !== draft.uid))}
                      aria-label={`Remove question ${index + 1}`}
                      className="max-sm:size-9"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => add()} disabled={drafts.length >= MAX_LEAD_FIELDS}>
            <Plus aria-hidden="true" />
            Add a question
          </Button>
          {drafts.length < MAX_LEAD_FIELDS &&
            unusedSuggestions.slice(0, 4).map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => add(s)}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                + {s.label}
              </button>
            ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {drafts.length}/{MAX_LEAD_FIELDS}
          </span>
        </div>

        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {invalid && dirty ? (
              <span className="text-destructive">Fill in every label and question to save.</span>
            ) : dirty ? (
              'You have unsaved question changes.'
            ) : (
              'Lead questions are saved.'
            )}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setDrafts(toDrafts(leadFields))} disabled={!dirty || busy} className="flex-1 sm:flex-none">
              Discard
            </Button>
            <Button type="button" onClick={save} disabled={!dirty || busy || invalid} className="flex-1 sm:flex-none">
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              {saving ? 'Saving…' : 'Save questions'}
            </Button>
          </div>
        </div>
      </div>
    </SkillSection>
  )
}
