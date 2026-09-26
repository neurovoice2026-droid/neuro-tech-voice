// Validation for workflows and their steps. Client-safe: the builder runs the
// same schemas as the API before saving, so errors show next to the field.

import '@/lib/zod-setup'
import { z } from 'zod'
import { MAX_KEYWORD_LENGTH, keywordListIssue, parseKeywords } from './keywords'
import { unknownTemplateVariables } from './templates'
import {
  ACTION_TYPES,
  MAX_WORKFLOW_ACTIONS,
  TRIGGER_TYPES,
  type ActionType,
  type StoredWorkflowAction,
} from './types'

// ─── Field helpers ────────────────────────────────────────────────────────────

function template(max: number, opts: { required?: string } = {}) {
  let base = z.string().max(max, `Keep this under ${max} characters`)
  if (opts.required) base = base.refine((value) => value.trim().length > 0, opts.required)
  return base.superRefine((value, ctx) => {
    const unknown = unknownTemplateVariables(value)
    if (unknown.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: `We don't recognise ${unknown.map((name) => `{{${name}}}`).join(', ')}. Use the variables listed under the field.`,
      })
    }
  })
}

const SLACK_WEBHOOK_PREFIX = 'https://hooks.slack.com/'

export function isSlackWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return (
      url.protocol === 'https:' &&
      url.hostname === 'hooks.slack.com' &&
      !url.port &&
      !url.username &&
      !url.password &&
      url.pathname.length > 1 &&
      value.trim().startsWith(SLACK_WEBHOOK_PREFIX)
    )
  } catch {
    return false
  }
}

/** Accepts a full Google Sheets link or a bare spreadsheet id; returns the id or ''. */
export function parseSpreadsheetId(input: string): string {
  const value = input.trim()
  const fromUrl = value.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/)
  if (fromUrl) return fromUrl[1]
  return /^[A-Za-z0-9_-]{20,100}$/.test(value) ? value : ''
}

const webhookUrl = z
  .string()
  .trim()
  .min(1, 'Paste the address that should receive the call details')
  .max(2048, 'This address is too long')
  .refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' && !url.username && !url.password
    } catch {
      return false
    }
  }, 'Use a full https:// address, for example https://hooks.zapier.com/…')

const tagName = z
  .string()
  .trim()
  .min(1, 'Enter a tag, for example follow-up')
  .max(40, 'Keep tags under 40 characters')
  .refine((value) => !/[,{}<>]/.test(value), 'Tags can’t contain commas, braces or angle brackets')

const emailList = z
  .union([z.string(), z.array(z.string())])
  .transform((value) =>
    (Array.isArray(value) ? value : value.split(/[,;\s]+/))
      .map((item) => item.trim())
      .filter(Boolean)
  )
  .pipe(
    z
      .array(z.email('One of the addresses isn’t a valid email'))
      .min(1, 'Add at least one email address')
      .max(10, 'Send to at most 10 addresses')
  )

// Google Sheets tab names can't contain these characters.
const sheetName = z
  .string()
  .trim()
  .max(100, 'Keep the tab name under 100 characters')
  .refine((value) => !/[[\]*?:/\\]/.test(value), 'Tab names can’t contain [ ] * ? : / or \\')

// ─── Step configs ─────────────────────────────────────────────────────────────

export const sendWebhookConfigSchema = z.object({ url: webhookUrl })

export const notifySlackConfigSchema = z.object({
  webhook_url: z
    .string()
    .trim()
    .min(1, 'Paste the incoming-webhook link from Slack')
    .refine(isSlackWebhookUrl, 'Use a Slack incoming-webhook link: it starts with https://hooks.slack.com/'),
  message: template(2000).optional(),
})

export const sendSmsConfigSchema = z.object({
  message: template(480, { required: 'Write the text you want the caller to receive' }),
})

export const addTagConfigSchema = z.object({ tag: tagName })

export const waitConfigSchema = z.object({
  seconds: z.coerce
    .number()
    .int('Use whole seconds')
    .min(1, 'Wait at least 1 second')
    .max(30, 'Wait at most 30 seconds')
    .default(5),
})

export const sendEmailConfigSchema = z.object({
  to: emailList,
  subject: template(200, { required: 'Add a subject line' }),
  body: template(5000).optional(),
})

export const addToSheetConfigSchema = z.object({
  spreadsheet_id: z
    .string()
    .transform(parseSpreadsheetId)
    .pipe(z.string().min(1, 'Paste the link of your Google Sheet')),
  sheet_name: sheetName.optional(),
})

export const createCalendarEventConfigSchema = z.object({
  offset_hours: z.coerce
    .number()
    .int('Use whole hours')
    .min(1, 'Schedule it at least 1 hour after the call')
    .max(336, 'Schedule it within two weeks (336 hours)')
    .default(24),
  duration_minutes: z.coerce
    .number()
    .int('Use whole minutes')
    .min(15, 'Make it at least 15 minutes')
    .max(240, 'Make it at most 4 hours')
    .default(30),
  title: template(200, { required: 'Give the event a title' }),
})

export const createDocConfigSchema = z.object({
  title: template(200, { required: 'Give the document a title' }),
  include_transcript: z.boolean().default(true),
})

export const saveToDriveConfigSchema = z.object({
  folder_name: z
    .string()
    .trim()
    .max(100, 'Keep the folder name under 100 characters')
    .refine((value) => !/['\\]/.test(value), 'Folder names can’t contain quotes or backslashes')
    .optional(),
})

export const ACTION_CONFIG_SCHEMAS = {
  send_webhook: sendWebhookConfigSchema,
  notify_slack: notifySlackConfigSchema,
  send_sms: sendSmsConfigSchema,
  add_tag: addTagConfigSchema,
  wait: waitConfigSchema,
  send_email: sendEmailConfigSchema,
  add_to_sheet: addToSheetConfigSchema,
  create_calendar_event: createCalendarEventConfigSchema,
  create_doc: createDocConfigSchema,
  save_to_drive: saveToDriveConfigSchema,
} as const satisfies Record<ActionType, z.ZodType>

export type ActionConfig<T extends ActionType> = z.output<(typeof ACTION_CONFIG_SCHEMAS)[T]>

// ─── Steps ────────────────────────────────────────────────────────────────────

const actionId = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid step id')

function step<T extends ActionType>(type: T) {
  return z.object({ id: actionId, type: z.literal(type), config: ACTION_CONFIG_SCHEMAS[type] })
}

export const workflowActionSchema = z.discriminatedUnion('type', [
  step('send_webhook'),
  step('notify_slack'),
  step('send_sms'),
  step('add_tag'),
  step('wait'),
  step('send_email'),
  step('add_to_sheet'),
  step('create_calendar_event'),
  step('create_doc'),
  step('save_to_drive'),
])

export type WorkflowAction = z.output<typeof workflowActionSchema>

export const actionListSchema = z
  .array(workflowActionSchema)
  .min(1, 'Add at least one step')
  .max(MAX_WORKFLOW_ACTIONS, `A workflow can have at most ${MAX_WORKFLOW_ACTIONS} steps`)
  .superRefine((actions, ctx) => {
    const ids = new Set<string>()
    actions.forEach((action, index) => {
      if (ids.has(action.id)) ctx.addIssue({ code: 'custom', path: [index, 'id'], message: 'Duplicate step id' })
      ids.add(action.id)
    })
  })

// ─── Workflow ─────────────────────────────────────────────────────────────────

export const triggerTypeSchema = z.enum(TRIGGER_TYPES)

export const triggerConfigSchema = z
  .object({
    keyword: z.string().max(MAX_KEYWORD_LENGTH * 10 + 20, 'That’s too many keywords').optional(),
  })
  .default({})

/** Keyword trigger needs at least one keyword; other triggers store an empty config. */
export function normalizeTriggerConfig(
  trigger: z.infer<typeof triggerTypeSchema>,
  config: z.infer<typeof triggerConfigSchema>,
  ctx: z.RefinementCtx,
  path: (string | number)[] = ['trigger_config', 'keyword']
): { keyword?: string } {
  if (trigger !== 'keyword_detected') return {}
  const issue = keywordListIssue(config.keyword)
  if (issue) {
    ctx.addIssue({ code: 'custom', path, message: issue })
    return {}
  }
  return { keyword: parseKeywords(config.keyword).join(', ') }
}

const workflowName = z.string().trim().min(1, 'Give your workflow a name').max(100, 'Keep the name under 100 characters')
const workflowDescription = z.string().trim().max(300, 'Keep the description under 300 characters').nullable()

export const workflowCreateSchema = z
  .object({
    name: workflowName,
    description: workflowDescription.optional(),
    trigger: triggerTypeSchema,
    trigger_config: triggerConfigSchema,
    actions: actionListSchema,
    enabled: z.boolean().default(true),
  })
  .transform((value, ctx) => ({
    ...value,
    description: value.description ? value.description : null,
    trigger_config: normalizeTriggerConfig(value.trigger, value.trigger_config, ctx),
  }))

export type WorkflowCreateInput = z.output<typeof workflowCreateSchema>

export const workflowPatchSchema = z
  .object({
    name: workflowName.optional(),
    description: workflowDescription.optional(),
    trigger: triggerTypeSchema.optional(),
    trigger_config: z.object({ keyword: z.string().max(MAX_KEYWORD_LENGTH * 10 + 20).optional() }).optional(),
    actions: actionListSchema.optional(),
    enabled: z.boolean().optional(),
    rotate_secret: z.literal(true).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update')

export type WorkflowPatchInput = z.output<typeof workflowPatchSchema>

// ─── Stored steps (runtime) ───────────────────────────────────────────────────

const ACTION_TYPE_SET = new Set<string>(ACTION_TYPES)

/** Maps configs saved by the old builder onto the current field names. */
function legacyConfig(type: ActionType, config: Record<string, unknown>): Record<string, unknown> {
  const next = { ...config }
  if (type === 'notify_slack' && next.webhook_url === undefined && typeof next.url === 'string') next.webhook_url = next.url
  if (type === 'wait' && next.seconds === undefined && next.duration !== undefined) next.seconds = next.duration
  if (type === 'add_to_sheet' && next.spreadsheet_id === undefined && typeof next.sheet_id === 'string') {
    next.spreadsheet_id = next.sheet_id
  }
  if (type === 'create_calendar_event' && next.title === undefined && typeof next.summary === 'string') next.title = next.summary
  return next
}

export type ParsedStoredAction =
  | { ok: true; action: WorkflowAction }
  | { ok: false; id: string; type: string; message: string }

/** Validates one saved step at run time; a broken step fails with a fixable message instead of crashing. */
export function parseStoredAction(raw: unknown, index: number): ParsedStoredAction {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Partial<StoredWorkflowAction>
  const id = typeof record.id === 'string' && record.id ? record.id : `step-${index + 1}`
  const type = typeof record.type === 'string' ? record.type : 'unknown'
  if (!ACTION_TYPE_SET.has(type)) {
    return { ok: false, id, type, message: 'This step type isn’t supported any more. Remove it from the workflow.' }
  }
  const config = record.config && typeof record.config === 'object' ? (record.config as Record<string, unknown>) : {}
  const parsed = workflowActionSchema.safeParse({ id, type, config: legacyConfig(type as ActionType, config) })
  if (parsed.success) return { ok: true, action: parsed.data }
  const first = parsed.error.issues[0]
  return {
    ok: false,
    id,
    type,
    message: `This step needs attention: ${first?.message ?? 'its settings are incomplete'}. Open the workflow to fix it.`,
  }
}

/** First validation message per field path ("actions.1.config.url" → message), for forms. */
export function issuesByPath(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.')
    if (!(key in out)) out[key] = issue.message
  }
  return out
}

/**
 * A step's issues ("config.to.1" relative to the step) keyed by top-level
 * config field ("to"), so a problem inside a field (one bad address in a list
 * of recipients) shows under that field instead of only turning the step red.
 */
export function stepFieldErrors(stepIssues: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, message] of Object.entries(stepIssues)) {
    if (!key.startsWith('config.')) continue
    const field = key.slice('config.'.length).split('.')[0]
    if (field && !(field in out)) out[field] = message
  }
  return out
}
