'use client'

import { useId } from 'react'
import { ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { parseSpreadsheetId } from '@/lib/workflows/schemas'
import { DEFAULT_EMAIL_BODY, DEFAULT_SLACK_MESSAGE } from '@/lib/workflows/templates'
import type { ActionType, GoogleIntegrationType, TriggerType } from '@/lib/workflows/types'
import { GoogleConnectionNotice } from './GoogleConnectionNotice'
import { PayloadPreview } from './PayloadPreview'
import { SigningSecretField } from './SigningSecretField'
import { TemplateField } from './TemplateField'
import { googleIntegrationFor, type WorkflowCapabilities } from './meta'

export interface DraftAction {
  id: string
  type: ActionType
  config: Record<string, unknown>
}

interface ActionConfigFieldsProps {
  action: DraftAction
  /** Validation messages keyed by config field name. */
  errors: Record<string, string>
  onChange: (config: Record<string, unknown>) => void
  workflowId: string | null
  workflowName: string
  trigger: TriggerType
  capabilities: WorkflowCapabilities
  onRefreshConnection: (integration: GoogleIntegrationType) => Promise<void>
}

function text(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ')
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  error,
  hint,
  type = 'text',
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  hint?: React.ReactNode
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className="text-sm"
      />
      {error ? (
        <p id={`${id}-error`} className="text-[11px] text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

const SMS_VARIABLES = ['caller_name', 'business_name', 'agent_name', 'date', 'time']
/** Titles and subjects are one line: the short values only. */
const TITLE_VARIABLES = ['caller_number', 'caller_name', 'outcome', 'intent', 'date', 'time', 'agent_name', 'business_name']

export function ActionConfigFields({
  action,
  errors,
  onChange,
  workflowId,
  workflowName,
  trigger,
  capabilities,
  onRefreshConnection,
}: ActionConfigFieldsProps) {
  const sliderId = useId()
  const { config } = action
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  const google = googleIntegrationFor(action.type)

  const googleNotice = google ? (
    <GoogleConnectionNotice integration={google} capabilities={capabilities} onRefresh={onRefreshConnection} />
  ) : null

  switch (action.type) {
    case 'send_webhook':
      return (
        <div className="space-y-3">
          <Field
            label="Endpoint address"
            value={text(config.url)}
            onChange={(v) => set('url', v)}
            placeholder="https://hooks.zapier.com/hooks/catch/…"
            error={errors.url}
            hint="Paste the https:// address from your CRM, Zapier, Make, n8n or your own server."
            inputMode="url"
          />
          <SigningSecretField workflowId={workflowId} />
          <PayloadPreview trigger={trigger} workflowName={workflowName} />
        </div>
      )

    case 'notify_slack':
      return (
        <div className="space-y-3">
          <Field
            label="Slack incoming-webhook link"
            value={text(config.webhook_url)}
            onChange={(v) => set('webhook_url', v)}
            placeholder="https://hooks.slack.com/services/…"
            error={errors.webhook_url}
            inputMode="url"
            hint={
              <>
                In Slack, add the Incoming Webhooks app to a channel and copy its link.{' '}
                <a
                  href="https://api.slack.com/messaging/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-purple-600 hover:underline"
                >
                  How to get it <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </>
            }
          />
          <TemplateField
            label="Message (optional)"
            value={text(config.message)}
            onChange={(v) => set('message', v)}
            multiline
            rows={3}
            maxLength={2000}
            placeholder={DEFAULT_SLACK_MESSAGE}
            error={errors.message}
            hint="Leave it empty to send the caller’s number, how the call went and its summary."
          />
        </div>
      )

    case 'send_sms':
      return (
        <div className="space-y-3">
          {!capabilities.sms.allowed ? (
            <p className="text-[11px] text-amber-700">Texting callers isn’t part of your current plan, so this step can’t be saved.</p>
          ) : null}
          <TemplateField
            label="Text message"
            value={text(config.message)}
            onChange={(v) => set('message', v)}
            multiline
            rows={3}
            maxLength={480}
            showCount
            variables={SMS_VARIABLES}
            error={errors.message}
            hint="Sent to the caller only when their number is known. People who reply STOP never get texts."
          />
        </div>
      )

    case 'add_tag':
      return (
        <Field
          label="Tag"
          value={text(config.tag)}
          onChange={(v) => set('tag', v)}
          placeholder="follow-up"
          error={errors.tag}
          hint="Shows on the call in your call list, so you can filter for it."
        />
      )

    case 'wait': {
      const seconds = Math.min(30, Math.max(1, num(config.seconds, 5)))
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={sliderId} className="text-xs font-medium">Wait for</Label>
            <span className="text-sm font-semibold tabular-nums text-foreground" aria-hidden="true">
              {seconds} {seconds === 1 ? 'second' : 'seconds'}
            </span>
          </div>
          <input
            id={sliderId}
            type="range"
            min={1}
            max={30}
            step={1}
            value={seconds}
            onChange={(e) => set('seconds', Number(e.target.value))}
            aria-valuetext={`${seconds} seconds`}
            className="w-full accent-purple-600"
          />
          <p className="text-[11px] text-muted-foreground">Useful when the system after this needs a moment. Up to 30 seconds.</p>
          {errors.seconds ? <p className="text-[11px] text-destructive">{errors.seconds}</p> : null}
        </div>
      )
    }

    case 'send_email':
      return (
        <div className="space-y-3">
          {googleNotice}
          <Field
            label="Send to"
            value={text(config.to)}
            onChange={(v) => set('to', v)}
            placeholder="frontdesk@yourbusiness.com, owner@yourbusiness.com"
            error={errors.to}
            hint="One or more addresses, separated by commas. The email comes from your connected Gmail account."
            inputMode="email"
          />
          <TemplateField
            label="Subject"
            variables={TITLE_VARIABLES}
            value={text(config.subject)}
            onChange={(v) => set('subject', v)}
            maxLength={200}
            error={errors.subject}
          />
          <TemplateField
            label="Message (optional)"
            value={text(config.body)}
            onChange={(v) => set('body', v)}
            multiline
            rows={5}
            maxLength={5000}
            placeholder={DEFAULT_EMAIL_BODY}
            error={errors.body}
            hint="Leave it empty to send the call’s summary and details."
          />
        </div>
      )

    case 'add_to_sheet': {
      const raw = text(config.spreadsheet_id)
      const parsedId = raw ? parseSpreadsheetId(raw) : ''
      return (
        <div className="space-y-3">
          {googleNotice}
          <Field
            label="Google Sheet link"
            value={raw}
            onChange={(v) => set('spreadsheet_id', v)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            error={errors.spreadsheet_id}
            inputMode="url"
            hint={
              parsedId
                ? `Found the spreadsheet (…${parsedId.slice(-6)}). The connected Google account needs edit access to it.`
                : 'Open the sheet in Google Sheets and paste its link from the address bar.'
            }
          />
          <Field
            label="Tab name (optional)"
            value={text(config.sheet_name)}
            onChange={(v) => set('sheet_name', v)}
            placeholder="Calls"
            error={errors.sheet_name}
            hint="Leave it empty to use the first tab. A header row is added when the tab is empty."
          />
        </div>
      )
    }

    case 'create_calendar_event':
      return (
        <div className="space-y-3">
          {googleNotice}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Hours after the call"
              type="number"
              inputMode="numeric"
              value={text(config.offset_hours)}
              onChange={(v) => set('offset_hours', v === '' ? '' : Number(v))}
              error={errors.offset_hours}
              hint="From 1 hour to 2 weeks (336)."
            />
            <Field
              label="Length in minutes"
              type="number"
              inputMode="numeric"
              value={text(config.duration_minutes)}
              onChange={(v) => set('duration_minutes', v === '' ? '' : Number(v))}
              error={errors.duration_minutes}
              hint="From 15 to 240."
            />
          </div>
          <TemplateField
            label="Event title"
            variables={TITLE_VARIABLES}
            value={text(config.title)}
            onChange={(v) => set('title', v)}
            maxLength={200}
            error={errors.title}
            hint="The event goes in your main calendar, with the call’s summary in its description."
          />
        </div>
      )

    case 'create_doc':
      return (
        <div className="space-y-3">
          {googleNotice}
          <TemplateField
            label="Document title"
            variables={TITLE_VARIABLES}
            value={text(config.title)}
            onChange={(v) => set('title', v)}
            maxLength={200}
            error={errors.title}
          />
          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <div>
              <p className="text-xs font-medium text-foreground">Include the transcript</p>
              <p className="text-[11px] text-muted-foreground">The full conversation goes under the summary.</p>
            </div>
            <Switch
              checked={config.include_transcript !== false}
              onCheckedChange={(checked) => set('include_transcript', checked)}
              aria-label="Include the transcript"
            />
          </div>
        </div>
      )

    case 'save_to_drive':
      return (
        <div className="space-y-3">
          {googleNotice}
          <Field
            label="Folder name (optional)"
            value={text(config.folder_name)}
            onChange={(v) => set('folder_name', v)}
            placeholder="Neuro Tech Voice calls"
            error={errors.folder_name}
            hint="We create this folder in your Drive the first time and save a .txt transcript of each call in it."
          />
        </div>
      )
  }
}
