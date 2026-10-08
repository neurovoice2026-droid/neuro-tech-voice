'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { AlertCircle, Info, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Field, FormSection } from '@/components/shared/FormSection'
import { OrbInline } from '@/components/shared/OrbLoader'
import { SaveBar, SettingSwitch } from './TabConversation'
import { readAgentSettings, type AgentHook, type AgentPatch } from '@/hooks/useAgent'
import {
  AnalysisSettingsSchema,
  ConversationSettingsSchema,
  DynamicVariablesSchema,
  PrivacySettingsSchema,
  TransferSettingsSchema,
} from '@/lib/voice-providers/settings'
import {
  DEFAULT_ANALYSIS_SETTINGS,
  type AnalysisSettings,
  type DataCollectionField,
  type TransferSettings,
} from '@/lib/voice-providers/types'
import { normalizeE164 } from '@/lib/phone/e164'
import { isStricterPrivacy } from '@/lib/voice-providers/privacy-change'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Agent, AgentStatusView } from '@/types'
import { BusinessToolsSection } from '@/components/agent/business-tools/BusinessToolsCards'

interface TabCallHandlingProps {
  agent: Agent
  status: AgentStatusView | null
  onUpdate: AgentHook['updateWithToast']
  isSaving: boolean
}

type Update = AgentHook['updateWithToast']
type AgentPrivacyPatch = NonNullable<AgentPatch['privacy_settings']>

/** Runs one card's save and tracks its own spinner (the hook's isSaving is page-wide). */
function useCardSave(onUpdate: Update) {
  const [saving, setSaving] = useState(false)
  const run = async (...args: Parameters<Update>) => {
    setSaving(true)
    try {
      return await onUpdate(...args)
    } finally {
      setSaving(false)
    }
  }
  return { saving, run }
}

let rowSequence = 0
/** Stable React keys for rows added in the editor (never sent to the server). */
function newRowKey(): string {
  rowSequence += 1
  return `row-${rowSequence}`
}

export function TabCallHandling({ agent, status, onUpdate, isSaving }: TabCallHandlingProps) {
  return (
    <div>
      <TransferCard agent={agent} status={status} onUpdate={onUpdate} isSaving={isSaving} />
      <BusinessToolsSection />
      <FallbackCard status={status} onUpdate={onUpdate} isSaving={isSaving} />
      <AnalysisCard agent={agent} onUpdate={onUpdate} isSaving={isSaving} />
      <PrivacyCard agent={agent} onUpdate={onUpdate} isSaving={isSaving} />
      <VariablesCard agent={agent} onUpdate={onUpdate} isSaving={isSaving} />
    </div>
  )
}

// ─── Human transfer ──────────────────────────────────────────────────────────

interface TransferDraft {
  enabled: boolean
  number: string
  condition: string
  label: string
  extension: string
  transfer_type: 'conference' | 'blind'
  whisper: boolean
}

function transferDraftFrom(t: TransferSettings): TransferDraft {
  return {
    enabled: t.enabled,
    number: t.number ?? '',
    condition: t.condition ?? '',
    label: t.label ?? '',
    extension: t.extension ?? '',
    transfer_type: t.transfer_type === 'blind' ? 'blind' : 'conference',
    whisper: t.whisper === true,
  }
}

const TRANSFER_TYPES: Array<{ value: TransferDraft['transfer_type']; label: string; hint: string }> = [
  { value: 'conference', label: 'Warm (recommended)', hint: 'The agent briefs your team member before leaving the call.' },
  { value: 'blind', label: 'Direct', hint: 'Connects straight away and shows the caller\'s number to your team member.' },
]

function TransferCard({ agent, status, onUpdate, isSaving }: TabCallHandlingProps) {
  const saved = useMemo(() => transferDraftFrom(readAgentSettings(agent).transfer), [agent])
  const [draft, setDraft] = useState(saved)
  const [showErrors, setShowErrors] = useState(false)
  const { saving, run } = useCardSave(onUpdate)

  const typed = draft.number.trim()
  const normalized = typed ? normalizeE164(typed) : null
  const errors: Partial<Record<'number' | 'condition' | 'label' | 'extension', string>> = {}
  if (typed && !normalized) errors.number = 'Use the international format, e.g. +40712345678.'
  else if (!typed && draft.enabled) errors.number = 'Enter the number to transfer calls to.'
  if (draft.condition.trim().length > 500) errors.condition = 'Keep it under 500 characters.'
  if (draft.label.trim().length > 80) errors.label = 'Keep it under 80 characters.'
  const extension = draft.extension.replace(/\s+/g, '')
  const candidate: TransferSettings = {
    enabled: draft.enabled,
    number: normalized,
    condition: draft.condition.trim() || null,
    label: draft.label.trim() || null,
    extension: extension || null,
    transfer_type: draft.transfer_type,
    whisper: draft.whisper,
  }
  const parsed = TransferSettingsSchema.safeParse(candidate)
  if (!parsed.success) {
    // Show each schema error under its own field (e.g. a platform variable in the condition).
    const issue = parsed.error.issues[0]
    const field = issue?.path[0]
    if (field === 'condition' || field === 'label' || field === 'extension') errors[field] = errors[field] ?? issue.message
    else if (!errors.number) errors.number = issue?.message ?? 'Invalid transfer settings.'
  }
  const valid = Object.keys(errors).length === 0 && parsed.success
  const visible = showErrors ? errors : {}
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved)

  const save = async () => {
    if (!valid) {
      setShowErrors(true)
      return
    }
    const next = await run({ transfer_settings: candidate }, 'Transfer settings saved')
    if (next) {
      setDraft(transferDraftFrom(readAgentSettings(next).transfer))
      setShowErrors(false)
    }
  }

  const native = status?.numbers.filter((n) => n.routing_mode === 'native_elevenlabs').length ?? 0
  const smart = status?.numbers.filter((n) => n.routing_mode === 'app_routed').length ?? 0

  return (
    <FormSection title="Human transfer" description="Let the agent hand the call to a person on your team.">
      <SettingSwitch
        id="transfer-enabled"
        label="Allow transfers to a person"
        description="The agent tells the caller it is transferring them, then connects the call."
        checked={draft.enabled}
        onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
      />

      <div className="grid items-start gap-5 sm:grid-cols-2 sm:gap-x-4">
        <Field
          label="Transfer to"
          htmlFor="transfer-number"
          hint={visible.number ? undefined : 'International format. Only this number is ever used.'}
          error={visible.number}
        >
          <Input
            id="transfer-number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+40712345678"
            value={draft.number}
            onChange={(e) => setDraft((d) => ({ ...d, number: e.target.value }))}
            className="tabular-nums"
          />
        </Field>
        <Field
          label="Destination name"
          htmlFor="transfer-label"
          hint={visible.label ? undefined : <>How the agent refers to it: “I&apos;ll transfer you to our front desk.”</>}
          error={visible.label}
        >
          <Input
            id="transfer-label"
            placeholder="our front desk"
            value={draft.label}
            maxLength={80}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          />
        </Field>
        <Field
          label="Extension"
          optional
          htmlFor="transfer-extension"
          hint={visible.extension ? undefined : 'Dialed after the call connects, for a phone system menu. Digits, * and #; w waits half a second.'}
          error={visible.extension}
        >
          <Input
            id="transfer-extension"
            autoComplete="off"
            placeholder="ww123"
            value={draft.extension}
            maxLength={24}
            onChange={(e) => setDraft((d) => ({ ...d, extension: e.target.value }))}
            className="font-mono"
          />
        </Field>
        <Field
          label="Transfer method"
          htmlFor="transfer-type"
          hint={`Used on direct numbers. ${TRANSFER_TYPES.find((t) => t.value === draft.transfer_type)?.hint ?? ''}`.trim()}
        >
          <Select value={draft.transfer_type} onValueChange={(v) => v && setDraft((d) => ({ ...d, transfer_type: v as TransferDraft['transfer_type'] }))}>
            <SelectTrigger id="transfer-type" className="w-full" aria-describedby="transfer-type-hint">
              <SelectValue>{(v: string) => TRANSFER_TYPES.find((t) => t.value === v)?.label ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TRANSFER_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <SettingSwitch
        id="transfer-whisper"
        label="Tell your team member why the caller is transferred"
        description="On smart-routed numbers, the person who answers first hears a short announcement with the caller's reason, then the caller is connected."
        checked={draft.whisper}
        onCheckedChange={(v) => setDraft((d) => ({ ...d, whisper: v }))}
      />

      <Field label="When to transfer" htmlFor="transfer-condition" error={visible.condition}>
        <Textarea
          id="transfer-condition"
          placeholder="When the caller asks for a person, or has an urgent problem you can't solve."
          value={draft.condition}
          maxLength={500}
          rows={2}
          onChange={(e) => setDraft((d) => ({ ...d, condition: e.target.value }))}
          className="min-h-20 resize-none"
        />
      </Field>

      <Note>
        On numbers set to Direct ElevenLabs, ElevenLabs&apos; native transfer is used. On smart-routed numbers, the
        platform transfers the live call.
        {status && status.numbers.length > 0 && ` Your numbers: ${smart} smart-routed, ${native} direct.`}
      </Note>

      <SaveBar
        dirty={isDirty}
        saving={saving}
        blocked={(isSaving && !saving) || (showErrors && !valid)}
        onSave={() => void save()}
        onDiscard={() => {
          setDraft(saved)
          setShowErrors(false)
        }}
      />
    </FormSection>
  )
}

// ─── Provider fallback ───────────────────────────────────────────────────────

function FallbackCard({ status, onUpdate, isSaving }: Omit<TabCallHandlingProps, 'agent'>) {
  // The value just saved, shown until the refreshed status confirms it.
  const [requested, setRequested] = useState<boolean | null>(null)
  const { saving, run } = useCardSave(onUpdate)
  const enabled = requested ?? status?.fallback_enabled ?? true
  const backup = status?.providers.find((p) => p.role === 'fallback')
  const unavailable = !!status && (!backup || !backup.configured)

  const toggle = async (value: boolean) => {
    setRequested(value)
    const next = await run(
      { organization: { voice_fallback_enabled: value } },
      value ? 'Backup voice agent turned on' : 'Backup voice agent turned off',
    )
    if (!next) setRequested(null)
  }

  return (
    <FormSection
      title="Provider fallback"
      description="A backup voice agent for when the primary provider is down."
      aside={saving ? <SavingIndicator /> : undefined}
    >
      <SettingSwitch
        id="fallback-enabled"
        label="Use a backup voice agent"
        description="If ElevenLabs is unavailable, new calls are answered by a backup voice agent (Cartesia). Calls already in progress are not moved."
        checked={enabled}
        onCheckedChange={(v) => void toggle(v)}
        disabled={!status || saving || isSaving}
      />
      {unavailable && (
        <Note>The backup voice agent is not available on the platform yet, so this setting has no effect for now.</Note>
      )}
      <p className="text-xs leading-[18px] text-muted-foreground">
        This is not the conversational fallback phrase (Conversation tab), which the agent says when it doesn&apos;t
        understand.
      </p>
    </FormSection>
  )
}

// ─── Post-call analysis ──────────────────────────────────────────────────────

interface CriterionRow {
  key: string
  id: string
  name: string
  prompt: string
  /** The id was typed by hand (stop deriving it from the name). */
  idEdited: boolean
}

interface FieldRow {
  key: string
  id: string
  type: DataCollectionField['type']
  description: string
}

interface AnalysisDraft {
  criteria: CriterionRow[]
  fields: FieldRow[]
}

const MAX_CRITERIA = 30
const MAX_FIELDS = 25
const FIELD_TYPES: Array<{ value: DataCollectionField['type']; label: string }> = [
  { value: 'string', label: 'Text' },
  { value: 'boolean', label: 'Yes / no' },
  { value: 'integer', label: 'Whole number' },
  { value: 'number', label: 'Number' },
]

function analysisDraftFrom(a: AnalysisSettings, prefix = 'saved'): AnalysisDraft {
  return {
    criteria: a.success_criteria.map((c, i) => ({ key: `${prefix}-c-${i}`, id: c.id, name: c.name, prompt: c.prompt, idEdited: true })),
    fields: a.data_collection.map((f, i) => ({ key: `${prefix}-f-${i}`, id: f.id, type: f.type, description: f.description })),
  }
}

function toAnalysis(d: AnalysisDraft): AnalysisSettings {
  return {
    success_criteria: d.criteria.map((c) => ({ id: c.id.trim(), name: c.name.trim(), prompt: c.prompt.trim() })),
    data_collection: d.fields.map((f) => ({ id: f.id.trim(), type: f.type, description: f.description.trim() })),
  }
}

/** "Booked an appointment" → "booked_an_appointment" (valid id: lowercase, starts with a letter, ≤40). */
function slugId(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const id = /^[a-z]/.test(base) ? base : base ? `c_${base}` : ''
  return id.slice(0, 40).replace(/_+$/, '')
}

type AnalysisErrors = Record<string, string>

function analysisErrors(d: AnalysisDraft): AnalysisErrors {
  const errors: AnalysisErrors = {}
  const parsed = AnalysisSettingsSchema.safeParse(toAnalysis(d))
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [list, index, field] = issue.path
      if (typeof index !== 'number' || typeof field !== 'string') continue
      const key = `${list === 'success_criteria' ? 'c' : 'f'}-${index}-${field}`
      if (errors[key]) continue
      errors[key] =
        field === 'id'
          ? 'Use lowercase letters, digits and underscores, starting with a letter.'
          : issue.code === 'too_small'
            ? 'Required.'
            : issue.code === 'too_big'
              ? 'Too long.'
              : issue.message
    }
  }
  const dupes = (ids: string[], prefix: 'c' | 'f') => {
    const seen = new Set<string>()
    ids.forEach((id, i) => {
      const k = id.trim()
      if (!k) return
      if (seen.has(k) && !errors[`${prefix}-${i}-id`]) errors[`${prefix}-${i}-id`] = 'This id is already used.'
      seen.add(k)
    })
  }
  dupes(d.criteria.map((c) => c.id), 'c')
  dupes(d.fields.map((f) => f.id), 'f')
  return errors
}

function AnalysisCard({ agent, onUpdate, isSaving }: Omit<TabCallHandlingProps, 'status'>) {
  const saved = useMemo(() => analysisDraftFrom(readAgentSettings(agent).analysis), [agent])
  const [draft, setDraft] = useState(saved)
  const [showErrors, setShowErrors] = useState(false)
  const { saving, run } = useCardSave(onUpdate)

  const errors = analysisErrors(draft)
  const valid = Object.keys(errors).length === 0
  const visible: AnalysisErrors = showErrors ? errors : {}
  const isDirty = JSON.stringify(toAnalysis(draft)) !== JSON.stringify(toAnalysis(saved))
  const isDefault = JSON.stringify(toAnalysis(draft)) === JSON.stringify(DEFAULT_ANALYSIS_SETTINGS)

  const setCriterion = (key: string, patch: Partial<CriterionRow>) =>
    setDraft((d) => ({
      ...d,
      criteria: d.criteria.map((c) => {
        if (c.key !== key) return c
        const next = { ...c, ...patch }
        if (patch.name !== undefined && !c.idEdited) next.id = slugId(patch.name)
        return next
      }),
    }))
  const setField = (key: string, patch: Partial<FieldRow>) =>
    setDraft((d) => ({ ...d, fields: d.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) }))

  const save = async () => {
    if (!valid) {
      setShowErrors(true)
      return
    }
    const next = await run({ analysis_settings: toAnalysis(draft) }, 'Post-call analysis saved')
    if (next) {
      setDraft(analysisDraftFrom(readAgentSettings(next).analysis, `saved-${Date.now()}`))
      setShowErrors(false)
    }
  }

  const err = (key: string) => visible[key]

  return (
    <FormSection
      title="Post-call analysis"
      description="After every call, the transcript is checked against these criteria and the fields are filled in."
      aside={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="tap-44"
          disabled={isDefault}
          onClick={() => setDraft(analysisDraftFrom(DEFAULT_ANALYSIS_SETTINGS, `default-${Date.now()}`))}
        >
          <RotateCcw aria-hidden="true" /> Defaults
        </Button>
      }
    >
      {/* Success criteria */}
      <section className="space-y-3" aria-labelledby="analysis-criteria-title">
        <div className="flex items-center justify-between gap-3">
          <h3 id="analysis-criteria-title" className="text-[13px] leading-5 font-medium">
            Success criteria{' '}
            <span className="font-normal text-muted-foreground tabular-nums">({draft.criteria.length}/{MAX_CRITERIA})</span>
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="tap-44"
            disabled={draft.criteria.length >= MAX_CRITERIA}
            onClick={() =>
              setDraft((d) => ({
                ...d,
                criteria: [...d.criteria, { key: newRowKey(), id: '', name: '', prompt: '', idEdited: false }],
              }))
            }
          >
            <Plus aria-hidden="true" /> Add criterion
          </Button>
        </div>
        {draft.criteria.length === 0 && <EmptyLine>No criteria. Calls are not graded.</EmptyLine>}
        <ul className="space-y-2">
          {draft.criteria.map((c, i) => (
            <li key={c.key} className="space-y-4 rounded-2xl bg-secondary p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
                <Field label="Name" htmlFor={`crit-${c.key}-name`} error={err(`c-${i}-name`)}>
                  <Input
                    id={`crit-${c.key}-name`}
                    value={c.name}
                    maxLength={100}
                    placeholder="Appointment booked"
                    onChange={(e) => setCriterion(c.key, { name: e.target.value })}
                  />
                </Field>
                <Field label="ID" htmlFor={`crit-${c.key}-id`} error={err(`c-${i}-id`)} className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                  <Input
                    id={`crit-${c.key}-id`}
                    value={c.id}
                    maxLength={40}
                    placeholder="appointment_booked"
                    className="font-mono text-base md:text-[13px]"
                    onChange={(e) => setCriterion(c.key, { id: e.target.value, idEdited: true })}
                  />
                </Field>
                <RemoveButton
                  label={`Remove criterion ${c.name || i + 1}`}
                  onClick={() => setDraft((d) => ({ ...d, criteria: d.criteria.filter((x) => x.key !== c.key) }))}
                />
              </div>
              <Field label="The call is successful when…" htmlFor={`crit-${c.key}-prompt`} error={err(`c-${i}-prompt`)}>
                <Textarea
                  id={`crit-${c.key}-prompt`}
                  value={c.prompt}
                  maxLength={2000}
                  rows={2}
                  placeholder="The caller booked, moved or cancelled an appointment and the details were confirmed."
                  className="min-h-20 resize-none"
                  onChange={(e) => setCriterion(c.key, { prompt: e.target.value })}
                />
              </Field>
            </li>
          ))}
        </ul>
      </section>

      {/* Data collection */}
      <section className="space-y-3" aria-labelledby="analysis-fields-title">
        <div className="flex items-center justify-between gap-3">
          <h3 id="analysis-fields-title" className="text-[13px] leading-5 font-medium">
            Data to collect{' '}
            <span className="font-normal text-muted-foreground tabular-nums">({draft.fields.length}/{MAX_FIELDS})</span>
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="tap-44"
            disabled={draft.fields.length >= MAX_FIELDS}
            onClick={() =>
              setDraft((d) => ({ ...d, fields: [...d.fields, { key: newRowKey(), id: '', type: 'string', description: '' }] }))
            }
          >
            <Plus aria-hidden="true" /> Add field
          </Button>
        </div>
        {draft.fields.length === 0 && <EmptyLine>No fields. Nothing is extracted from calls.</EmptyLine>}
        <ul className="space-y-2">
          {draft.fields.map((f, i) => (
            <li key={f.key} className="space-y-4 rounded-2xl bg-secondary p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
                <Field label="ID" htmlFor={`field-${f.key}-id`} error={err(`f-${i}-id`)}>
                  <Input
                    id={`field-${f.key}-id`}
                    value={f.id}
                    maxLength={40}
                    placeholder="preferred_date"
                    className="font-mono text-base md:text-[13px]"
                    onChange={(e) => setField(f.key, { id: e.target.value })}
                  />
                </Field>
                <Field label="Type" htmlFor={`field-${f.key}-type`} className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                  <Select value={f.type} onValueChange={(v) => v && setField(f.key, { type: v as DataCollectionField['type'] })}>
                    <SelectTrigger id={`field-${f.key}-type`} className="w-full">
                      <SelectValue>{(v: string) => FIELD_TYPES.find((t) => t.value === v)?.label ?? v}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <RemoveButton
                  label={`Remove field ${f.id || i + 1}`}
                  onClick={() => setDraft((d) => ({ ...d, fields: d.fields.filter((x) => x.key !== f.key) }))}
                />
              </div>
              <Field label="What to extract" htmlFor={`field-${f.key}-description`} error={err(`f-${i}-description`)}>
                <Textarea
                  id={`field-${f.key}-description`}
                  value={f.description}
                  maxLength={1000}
                  rows={2}
                  placeholder="The date the caller would like to come in, as YYYY-MM-DD."
                  className="min-h-20 resize-none"
                  onChange={(e) => setField(f.key, { description: e.target.value })}
                />
              </Field>
            </li>
          ))}
        </ul>
      </section>

      <SaveBar
        dirty={isDirty}
        saving={saving}
        blocked={(isSaving && !saving) || (showErrors && !valid)}
        onSave={() => void save()}
        onDiscard={() => {
          setDraft(saved)
          setShowErrors(false)
        }}
      />
      {showErrors && !valid && <p role="status" className="text-right text-xs text-destructive">Fix the highlighted fields to save.</p>}
    </FormSection>
  )
}

// ─── Privacy ─────────────────────────────────────────────────────────────────

const RETENTION_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
  { value: 730, label: '2 years' },
  { value: -1, label: 'Unlimited (kept until deleted)' },
]

function retentionLabel(days: number): string {
  const known = RETENTION_OPTIONS.find((o) => o.value === days)
  if (known) return known.label
  if (days === 0) return 'Delete right after the call'
  return `${days} days`
}

/** What the confirmation says before a stricter privacy setting is applied to stored calls. */
function stricterPrivacyMessage(saved: PrivacyDraft, draft: PrivacyDraft): string {
  const parts: string[] = []
  if (saved.record_audio && !draft.record_audio) {
    parts.push('Recording stops, and the voice provider may also delete the recordings of calls it already stores.')
  }
  const shorter = draft.retention_days >= 0 && (saved.retention_days < 0 || draft.retention_days < saved.retention_days)
  if (shorter) {
    parts.push(
      draft.retention_days === 0
        ? 'Transcripts and recordings already stored at the voice provider will be deleted, and transcripts and summaries in your call history here are removed too.'
        : `Transcripts and recordings older than ${retentionLabel(draft.retention_days)} will be deleted at the voice provider and from your call history here, including calls already stored.`,
    )
  }
  return `${parts.join(' ')} This cannot be undone.`
}

interface PrivacyDraft {
  record_audio: boolean
  retention_days: number
  recording_notice: boolean
}

/** The owner saved a retention period before (privacy_settings.retention_days stored). */
function hasSavedRetention(raw: unknown): boolean {
  return !!raw && typeof raw === 'object' && !Array.isArray(raw) && typeof (raw as { retention_days?: unknown }).retention_days === 'number'
}

type PrivacyChoice = Pick<PrivacyDraft, 'record_audio' | 'retention_days'>

/**
 * privacy_settings for PATCH /api/agent, or null when neither recording nor
 * retention changed. A saved retention period also deletes the call history
 * here, so retention_days is only sent when the owner chose one (now or in an
 * earlier save): saving the recording switch alone must not turn the
 * displayed default into a saved period.
 */
export function privacySettingsPatch(storedRaw: unknown, saved: PrivacyChoice, draft: PrivacyChoice): AgentPrivacyPatch | null {
  const retentionChanged = draft.retention_days !== saved.retention_days
  if (draft.record_audio === saved.record_audio && !retentionChanged) return null
  return {
    record_audio: draft.record_audio,
    ...(retentionChanged || hasSavedRetention(storedRaw) ? { retention_days: draft.retention_days } : {}),
  }
}

const PrivacyPatchSchema = PrivacySettingsSchema.partial({ retention_days: true })

function PrivacyCard({ agent, onUpdate, isSaving }: Omit<TabCallHandlingProps, 'status'>) {
  const saved = useMemo<PrivacyDraft>(() => {
    const s = readAgentSettings(agent)
    return { ...s.privacy, recording_notice: s.conversation.recording_notice }
  }, [agent])
  const [draft, setDraft] = useState(saved)
  const [confirming, setConfirming] = useState(false)
  const { saving, run } = useCardSave(onUpdate)
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved)
  // Turning recording off or shortening retention also applies to calls the
  // voice provider already stores (deleted, cannot be undone): confirm first.
  const stricter = isStricterPrivacy(
    { record_audio: saved.record_audio, retention_days: saved.retention_days },
    { record_audio: draft.record_audio, retention_days: draft.retention_days },
  )

  const options = RETENTION_OPTIONS.some((o) => o.value === draft.retention_days)
    ? RETENTION_OPTIONS
    : [...RETENTION_OPTIONS, { value: draft.retention_days, label: retentionLabel(draft.retention_days) }]

  const save = async () => {
    const privacy = privacySettingsPatch(agent.privacy_settings, saved, draft)
    // conversation_settings is sent whole: keep everything the Conversation tab owns as saved.
    const conversation = { ...readAgentSettings(agent).conversation, recording_notice: draft.recording_notice, ai_disclosure: true as const }
    const p = privacy ? PrivacyPatchSchema.safeParse(privacy) : null
    const c = ConversationSettingsSchema.safeParse(conversation)
    if ((p && !p.success) || !c.success) {
      // Only reachable with corrupted stored settings (the server would reject them too).
      toast.error('These settings could not be saved', { description: 'Reload the page and try again.' })
      return
    }
    const next = await run({ ...(p?.success ? { privacy_settings: p.data } : {}), conversation_settings: c.data }, 'Privacy settings saved')
    if (next) {
      const s = readAgentSettings(next)
      setDraft({ ...s.privacy, recording_notice: s.conversation.recording_notice })
    }
  }

  const requestSave = () => {
    if (stricter) setConfirming(true)
    else void save()
  }

  return (
    <FormSection title="Privacy" description="Recordings, how long call data is kept, and what callers are told.">
      <SettingSwitch
        id="privacy-record"
        label="Record call audio"
        description="Keep a recording of each call so you can listen back. Transcripts are kept either way."
        checked={draft.record_audio}
        onCheckedChange={(v) => setDraft((d) => ({ ...d, record_audio: v }))}
      />

      <Field label="Keep transcripts and recordings for" htmlFor="privacy-retention">
        <Select
          value={String(draft.retention_days)}
          onValueChange={(v) => v !== null && setDraft((d) => ({ ...d, retention_days: Number(v) }))}
        >
          <SelectTrigger id="privacy-retention" className="w-full sm:w-60" aria-describedby="privacy-retention-hint">
            <SelectValue>{(v: string) => retentionLabel(Number(v))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div id="privacy-retention-hint" className="space-y-1.5 text-xs leading-[18px] text-muted-foreground">
          <p>
            Applies to calls stored at the voice provider. “Unlimited” keeps them until you delete them. Choosing a shorter
            period, or turning recording off, also applies to calls already stored there: older transcripts and recordings
            are deleted and cannot be recovered.
          </p>
          <p>
            Your call history here follows the same period: transcripts, summaries and collected details of older calls
            are removed (call counts and durations stay). Copies your automations already sent elsewhere (Google Sheets,
            Docs, email, webhooks) are not deleted.
          </p>
        </div>
      </Field>

      <SettingSwitch
        id="privacy-notice"
        label="Recording notice in the greeting"
        description={
          draft.record_audio
            ? 'Adds a short “this call may be recorded” notice to the first message. Required in many countries when recording.'
            : 'Adds a short “this call may be recorded” notice to the first message.'
        }
        checked={draft.recording_notice}
        onCheckedChange={(v) => setDraft((d) => ({ ...d, recording_notice: v }))}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <Label htmlFor="privacy-ai-disclosure" className="text-sm font-medium">
            AI disclosure <Badge variant="secondary" className="ml-1 h-5 px-2 text-[11px]">Always on</Badge>
          </Label>
          <p id="privacy-ai-disclosure-description" className="text-xs text-muted-foreground">
            Callers are always told they are speaking with an AI assistant, and the agent never claims to be human.
            This is required and cannot be turned off.
          </p>
        </div>
        <Switch id="privacy-ai-disclosure" checked disabled aria-describedby="privacy-ai-disclosure-description" className="mt-0.5" />
      </div>

      <SaveBar
        dirty={isDirty}
        saving={saving}
        blocked={isSaving && !saving}
        onSave={requestSave}
        onDiscard={() => setDraft(saved)}
      />

      <Dialog open={confirming} onOpenChange={(open) => !open && setConfirming(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply to calls already stored?</DialogTitle>
            <DialogDescription>{stricterPrivacyMessage(saved, draft)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive-solid"
              onClick={() => {
                setConfirming(false)
                void save()
              }}
            >
              Save and apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormSection>
  )
}

// ─── Dynamic variables ───────────────────────────────────────────────────────

interface VariableRow {
  key: string
  name: string
  value: string
}

const MAX_VARIABLES = 20
const VARIABLE_NAME = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/

function variableRowsFrom(vars: Record<string, string>, prefix = 'saved'): VariableRow[] {
  return Object.entries(vars).map(([name, value], i) => ({ key: `${prefix}-${i}`, name, value }))
}

function toVariables(rows: VariableRow[]): Record<string, string> {
  return Object.fromEntries(rows.map((r) => [r.name.trim(), r.value]))
}

function variableErrors(rows: VariableRow[]): Record<string, string> {
  const errors: Record<string, string> = {}
  const seen = new Set<string>()
  for (const r of rows) {
    const name = r.name.trim()
    if (!name) errors[`${r.key}-name`] = 'Enter a name.'
    else if (!VARIABLE_NAME.test(name)) errors[`${r.key}-name`] = 'Start with a letter; use letters, digits and underscores (max 40).'
    else if (seen.has(name)) errors[`${r.key}-name`] = 'This name is already used.'
    else {
      const single = DynamicVariablesSchema.safeParse({ [name]: r.value })
      const issue = single.success ? undefined : single.error.issues[0]
      if (issue?.code === 'invalid_key') {
        // e.g. "Reserved variable name" (the key refinement's own message).
        errors[`${r.key}-name`] = issue.issues[0]?.message ?? 'This name cannot be used.'
      } else if (issue?.code === 'too_big') {
        errors[`${r.key}-value`] = 'Keep the value under 500 characters.'
      } else if (issue) {
        errors[`${r.key}-name`] = issue.message
      }
    }
    seen.add(name)
  }
  return errors
}

function VariablesCard({ agent, onUpdate, isSaving }: Omit<TabCallHandlingProps, 'status'>) {
  const saved = useMemo(() => variableRowsFrom(readAgentSettings(agent).dynamicVariables), [agent])
  const [rows, setRows] = useState(saved)
  const [showErrors, setShowErrors] = useState(false)
  const { saving, run } = useCardSave(onUpdate)

  const errors = variableErrors(rows)
  const record = toVariables(rows)
  const parsed = DynamicVariablesSchema.safeParse(record)
  const valid = Object.keys(errors).length === 0 && parsed.success
  const visible = showErrors ? errors : {}
  const isDirty = JSON.stringify(rows.map(({ name, value }) => [name, value])) !== JSON.stringify(saved.map(({ name, value }) => [name, value]))

  const setRow = (key: string, patch: Partial<VariableRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const save = async () => {
    if (!valid || !parsed.success) {
      setShowErrors(true)
      return
    }
    const next = await run({ dynamic_variables: parsed.data }, 'Variables saved')
    if (next) {
      setRows(variableRowsFrom(readAgentSettings(next).dynamicVariables, `saved-${Date.now()}`))
      setShowErrors(false)
    }
  }

  return (
    <FormSection
      title="Variables"
      description={
        <>
          Fixed values you can use in your system prompt or first message as{' '}
          <code className="rounded-md bg-secondary px-1 py-px font-mono text-xs text-foreground">{'{{name}}'}</code>. Do not store passwords or other
          secrets here.
        </>
      }
    >
      {rows.length === 0 ? (
        <EmptyLine>No variables yet.</EmptyLine>
      ) : (
        <ul className="space-y-2" aria-label="Variables">
          {rows.map((r) => {
            const nameError = visible[`${r.key}-name`]
            const valueError = visible[`${r.key}-value`]
            return (
              <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[11rem_minmax(0,1fr)_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor={`var-${r.key}-name`} className="sr-only">Variable name</Label>
                  <Input
                    id={`var-${r.key}-name`}
                    value={r.name}
                    maxLength={40}
                    placeholder="opening_offer"
                    className="font-mono text-base md:text-[13px]"
                    onChange={(e) => setRow(r.key, { name: e.target.value })}
                    aria-invalid={nameError ? true : undefined}
                    aria-describedby={nameError ? `var-${r.key}-name-error` : undefined}
                  />
                  {nameError && <InlineError id={`var-${r.key}-name-error`}>{nameError}</InlineError>}
                </div>
                <div className="col-span-2 row-start-2 space-y-1.5 sm:col-span-1 sm:row-start-auto">
                  <Label htmlFor={`var-${r.key}-value`} className="sr-only">Value of {r.name || 'variable'}</Label>
                  <Input
                    id={`var-${r.key}-value`}
                    value={r.value}
                    maxLength={500}
                    placeholder="10% off the first visit"
                    onChange={(e) => setRow(r.key, { value: e.target.value })}
                    aria-invalid={valueError ? true : undefined}
                    aria-describedby={valueError ? `var-${r.key}-value-error` : undefined}
                  />
                  {valueError && <InlineError id={`var-${r.key}-value-error`}>{valueError}</InlineError>}
                </div>
                <RemoveButton
                  label={`Remove variable ${r.name || ''}`.trim()}
                  className="mt-1"
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                />
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className={cn('max-w-[40ch] text-xs leading-[18px]', rows.length >= MAX_VARIABLES ? 'text-warning' : 'text-muted-foreground')}>
          <span className="tabular-nums">{rows.length}/{MAX_VARIABLES}</span> variables. Names starting with system__, secret__ or ntv_, and after_hours and
          business_name, are reserved.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="tap-44"
          disabled={rows.length >= MAX_VARIABLES}
          onClick={() => setRows((rs) => [...rs, { key: newRowKey(), name: '', value: '' }])}
        >
          <Plus aria-hidden="true" /> Add variable
        </Button>
      </div>
      <SaveBar
        dirty={isDirty}
        saving={saving}
        blocked={(isSaving && !saving) || (showErrors && !valid)}
        onSave={() => void save()}
        onDiscard={() => {
          setRows(saved)
          setShowErrors(false)
        }}
      />
      {showErrors && !valid && <p role="status" className="text-right text-xs text-destructive">Fix the highlighted fields to save.</p>}
    </FormSection>
  )
}

// ─── Small pieces ────────────────────────────────────────────────────────────

/** Muted 12 px help line with an info icon. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs leading-[18px] text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

/** Tinted line for an empty list ("No variables yet."). */
function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-secondary px-4 py-3 text-[13px] leading-[19px] text-muted-foreground">{children}</p>
}

/** Field error with its icon, for controls laid out without a visible label. */
function InlineError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-xs leading-4 text-destructive">
      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

/** Ghost trash button for an editable row (muted until hovered). */
function RemoveButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      onClick={onClick}
      className={cn('tap-44 mt-7 text-muted-foreground hover:bg-destructive-soft hover:text-destructive', className)}
    >
      <Trash2 aria-hidden="true" />
    </Button>
  )
}

/** Shown next to a section title while its toggle saves. */
function SavingIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      <OrbInline state="working" />
      Saving…
    </span>
  )
}
