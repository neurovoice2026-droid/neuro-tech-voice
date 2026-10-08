import {
  CalendarPlus,
  Clock,
  FileText,
  FolderUp,
  Frown,
  Hash,
  Mail,
  MessageSquareText,
  PhoneMissed,
  PhoneOff,
  Sheet,
  Tag,
  TextSearch,
  Webhook,
  type LucideIcon,
} from 'lucide-react'
import {
  DEFAULT_DOC_TITLE,
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_EVENT_TITLE,
  DEFAULT_SMS_MESSAGE,
} from '@/lib/workflows/templates'
import {
  GOOGLE_ACTION_INTEGRATION,
  isGoogleAction,
  type ActionType,
  type GoogleIntegrationType,
  type TriggerType,
} from '@/lib/workflows/types'
import type { Plan } from '@/types'

/**
 * Tone classes for trigger/action icons. The redesign drops the per-item rainbow:
 * icons are ink on a tinted-grey disc; only semantic triggers (a missed call, an
 * unresolved call) colour the icon itself, never the background.
 */
const NEUTRAL_TILE = 'bg-secondary text-foreground'
const NEUTRAL_ICON = 'text-foreground'

export interface TriggerMeta {
  label: string
  description: string
  icon: LucideIcon
  /** Icon disc classes (background + icon colour). */
  tone: string
}

export const TRIGGER_META: Record<TriggerType, TriggerMeta> = {
  call_ended: {
    label: 'Call ended',
    description: 'Every call your agent finishes.',
    icon: PhoneOff,
    tone: NEUTRAL_TILE,
  },
  call_missed: {
    label: 'Missed call',
    description: 'A call nobody answered, or that couldn’t be taken.',
    icon: PhoneMissed,
    tone: 'bg-secondary text-destructive',
  },
  sentiment_negative: {
    label: 'Call not resolved',
    description: 'The AI marked the call as not successful: its goal was not reached.',
    icon: Frown,
    tone: 'bg-secondary text-warning',
  },
  keyword_detected: {
    label: 'Keyword heard',
    description: 'A word or phrase you choose, said by the caller or the agent.',
    icon: TextSearch,
    tone: NEUTRAL_TILE,
  },
}

export type ActionGroup = 'notify' | 'organize' | 'google'

export interface ActionMeta {
  label: string
  description: string
  icon: LucideIcon
  /** Icon colour class. */
  tone: string
  group: ActionGroup
}

export const ACTION_META: Record<ActionType, ActionMeta> = {
  notify_slack: {
    label: 'Notify Slack',
    description: 'Post a message to a Slack channel.',
    icon: Hash,
    tone: NEUTRAL_ICON,
    group: 'notify',
  },
  send_webhook: {
    label: 'Send webhook',
    description: 'Send the call’s details to your CRM, Zapier, Make or n8n.',
    icon: Webhook,
    tone: NEUTRAL_ICON,
    group: 'notify',
  },
  send_sms: {
    label: 'Text the caller',
    description: 'Send the caller a text message.',
    icon: MessageSquareText,
    tone: NEUTRAL_ICON,
    group: 'notify',
  },
  add_tag: {
    label: 'Tag the call',
    description: 'Label the call so it stands out in your call list.',
    icon: Tag,
    tone: NEUTRAL_ICON,
    group: 'organize',
  },
  wait: {
    label: 'Wait',
    description: 'Pause up to 30 seconds before the next step.',
    icon: Clock,
    tone: NEUTRAL_ICON,
    group: 'organize',
  },
  send_email: {
    label: 'Send email (Gmail)',
    description: 'Email the call summary from your Gmail account.',
    icon: Mail,
    tone: NEUTRAL_ICON,
    group: 'google',
  },
  add_to_sheet: {
    label: 'Add row (Google Sheets)',
    description: 'Add the call as a new row in a spreadsheet.',
    icon: Sheet,
    tone: NEUTRAL_ICON,
    group: 'google',
  },
  create_calendar_event: {
    label: 'Follow-up (Google Calendar)',
    description: 'Put a follow-up reminder in your calendar.',
    icon: CalendarPlus,
    tone: NEUTRAL_ICON,
    group: 'google',
  },
  create_doc: {
    label: 'Call report (Google Docs)',
    description: 'Write a call report as a document.',
    icon: FileText,
    tone: NEUTRAL_ICON,
    group: 'google',
  },
  save_to_drive: {
    label: 'Save transcript (Google Drive)',
    description: 'Save the transcript as a text file in Drive.',
    icon: FolderUp,
    tone: NEUTRAL_ICON,
    group: 'google',
  },
}

export const ACTION_GROUPS: { id: ActionGroup; label: string; types: ActionType[] }[] = [
  { id: 'notify', label: 'Notify and send', types: ['notify_slack', 'send_webhook', 'send_sms'] },
  { id: 'organize', label: 'Organize', types: ['add_tag', 'wait'] },
  { id: 'google', label: 'Google Workspace', types: ['send_email', 'add_to_sheet', 'create_calendar_event', 'create_doc', 'save_to_drive'] },
]

export const GOOGLE_LABELS: Record<GoogleIntegrationType, string> = {
  google_calendar: 'Google Calendar',
  gmail: 'Gmail',
  google_sheets: 'Google Sheets',
  google_docs: 'Google Docs',
  google_drive: 'Google Drive',
}

export function googleIntegrationFor(type: ActionType): GoogleIntegrationType | null {
  return isGoogleAction(type) ? GOOGLE_ACTION_INTEGRATION[type] : null
}

/** Starting values for a new step; required text fields get a sensible default the owner can edit. */
export function defaultConfigFor(type: ActionType): Record<string, unknown> {
  switch (type) {
    case 'send_webhook':
      return { url: '' }
    case 'notify_slack':
      return { webhook_url: '', message: '' }
    case 'send_sms':
      return { message: DEFAULT_SMS_MESSAGE }
    case 'add_tag':
      return { tag: '' }
    case 'wait':
      return { seconds: 5 }
    case 'send_email':
      return { to: '', subject: DEFAULT_EMAIL_SUBJECT, body: '' }
    case 'add_to_sheet':
      return { spreadsheet_id: '', sheet_name: '' }
    case 'create_calendar_event':
      return { offset_hours: 24, duration_minutes: 30, title: DEFAULT_EVENT_TITLE }
    case 'create_doc':
      return { title: DEFAULT_DOC_TITLE, include_transcript: true }
    case 'save_to_drive':
      return { folder_name: '' }
  }
}

export function newActionId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return `step_${random}`
}

/** What the builder knows about the account when it opens. */
export interface WorkflowCapabilities {
  google: { allowed: boolean; requiredPlan: Plan; available: boolean }
  sms: { allowed: boolean; requiredPlan: Plan }
  connections: Record<GoogleIntegrationType, { connected: boolean; account_email: string | null }>
}

export function formatRelative(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
