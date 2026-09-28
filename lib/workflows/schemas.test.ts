import { describe, expect, it } from 'vitest'
import {
  ACTION_CONFIG_SCHEMAS,
  actionListSchema,
  isSlackWebhookUrl,
  issuesByPath,
  parseSpreadsheetId,
  parseStoredAction,
  workflowActionSchema,
  workflowCreateSchema,
  workflowPatchSchema,
  stepFieldErrors,
} from './schemas'
import { MAX_WORKFLOW_ACTIONS } from './types'

const SHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'

function workflow(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Missed calls to Slack',
    trigger: 'call_missed',
    actions: [{ id: 'a1', type: 'notify_slack', config: { webhook_url: 'https://hooks.slack.com/services/T0/B0/xyz' } }],
    ...overrides,
  }
}

describe('step configs', () => {
  it('webhook needs a full https address without credentials', () => {
    const schema = ACTION_CONFIG_SCHEMAS.send_webhook
    expect(schema.safeParse({ url: 'https://hooks.zapier.com/hooks/catch/1/abc' }).success).toBe(true)
    expect(schema.safeParse({ url: 'http://example.com/hook' }).success).toBe(false)
    expect(schema.safeParse({ url: 'https://user:pass@example.com/hook' }).success).toBe(false)
    expect(schema.safeParse({ url: 'not a url' }).success).toBe(false)
    expect(schema.safeParse({ url: '' }).success).toBe(false)
  })

  it('Slack accepts only hooks.slack.com incoming webhooks', () => {
    expect(isSlackWebhookUrl('https://hooks.slack.com/services/T0/B0/xyz')).toBe(true)
    expect(isSlackWebhookUrl('https://hooks.slack.com/triggers/T0/1/abc')).toBe(true)
    expect(isSlackWebhookUrl('http://hooks.slack.com/services/T0')).toBe(false)
    expect(isSlackWebhookUrl('https://hooks.slack.com.evil.com/services/T0')).toBe(false)
    expect(isSlackWebhookUrl('https://evil.com/https://hooks.slack.com/')).toBe(false)
    expect(isSlackWebhookUrl('https://hooks.slack.com:8443/services/T0')).toBe(false)
    expect(isSlackWebhookUrl('https://hooks.slack.com/')).toBe(false)
  })

  it('Slack message templates only accept known variables', () => {
    const schema = ACTION_CONFIG_SCHEMAS.notify_slack
    const url = 'https://hooks.slack.com/services/T0/B0/xyz'
    expect(schema.safeParse({ webhook_url: url, message: 'Call from {{caller_number}} for {{agent_name}}' }).success).toBe(true)
    expect(schema.safeParse({ webhook_url: url, message: 'Legacy {{caller}} {{agent}} {{call_summary}}' }).success).toBe(true)
    const bad = schema.safeParse({ webhook_url: url, message: 'Hi {{callr_number}}' })
    expect(bad.success).toBe(false)
    expect(bad.error?.issues[0]?.message).toContain('{{callr_number}}')
  })

  it('wait is 1 to 30 whole seconds, 5 by default', () => {
    const schema = ACTION_CONFIG_SCHEMAS.wait
    expect(schema.parse({})).toEqual({ seconds: 5 })
    expect(schema.parse({ seconds: '12' })).toEqual({ seconds: 12 })
    expect(schema.safeParse({ seconds: 0 }).success).toBe(false)
    expect(schema.safeParse({ seconds: 31 }).success).toBe(false)
    expect(schema.safeParse({ seconds: 2.5 }).success).toBe(false)
  })

  it('tags are short labels', () => {
    const schema = ACTION_CONFIG_SCHEMAS.add_tag
    expect(schema.parse({ tag: '  follow-up ' })).toEqual({ tag: 'follow-up' })
    expect(schema.safeParse({ tag: '' }).success).toBe(false)
    expect(schema.safeParse({ tag: 'a,b' }).success).toBe(false)
    expect(schema.safeParse({ tag: 'x'.repeat(41) }).success).toBe(false)
  })

  it('SMS needs a message of at most 480 characters', () => {
    const schema = ACTION_CONFIG_SCHEMAS.send_sms
    expect(schema.safeParse({ message: 'Thanks for calling {{business_name}}' }).success).toBe(true)
    expect(schema.safeParse({ message: '   ' }).success).toBe(false)
    expect(schema.safeParse({ message: 'x'.repeat(481) }).success).toBe(false)
  })

  it('email recipients are parsed from a list and validated', () => {
    const schema = ACTION_CONFIG_SCHEMAS.send_email
    expect(schema.parse({ to: 'a@example.com, b@example.com; c@example.com', subject: 'Call' }).to).toEqual([
      'a@example.com',
      'b@example.com',
      'c@example.com',
    ])
    expect(schema.safeParse({ to: 'not-an-email', subject: 'Call' }).success).toBe(false)
    expect(schema.safeParse({ to: '', subject: 'Call' }).success).toBe(false)
    expect(schema.safeParse({ to: ['a@example.com'], subject: '' }).success).toBe(false)
  })

  it('sheets accept a link or an id and validate the tab name', () => {
    const schema = ACTION_CONFIG_SCHEMAS.add_to_sheet
    expect(schema.parse({ spreadsheet_id: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0` })).toEqual({ spreadsheet_id: SHEET_ID })
    expect(schema.parse({ spreadsheet_id: SHEET_ID, sheet_name: 'Leads' })).toEqual({ spreadsheet_id: SHEET_ID, sheet_name: 'Leads' })
    expect(schema.safeParse({ spreadsheet_id: 'https://example.com/sheet' }).success).toBe(false)
    expect(schema.safeParse({ spreadsheet_id: SHEET_ID, sheet_name: 'Leads/2026' }).success).toBe(false)
  })

  it('calendar follow-ups default to 24 hours and 30 minutes', () => {
    const schema = ACTION_CONFIG_SCHEMAS.create_calendar_event
    expect(schema.parse({ title: 'Call back {{caller_number}}' })).toEqual({ offset_hours: 24, duration_minutes: 30, title: 'Call back {{caller_number}}' })
    expect(schema.safeParse({ title: 'x', offset_hours: 0 }).success).toBe(false)
    expect(schema.safeParse({ title: 'x', offset_hours: 337 }).success).toBe(false)
  })

  it('docs and drive configs', () => {
    expect(ACTION_CONFIG_SCHEMAS.create_doc.parse({ title: 'Report' })).toEqual({ title: 'Report', include_transcript: true })
    expect(ACTION_CONFIG_SCHEMAS.save_to_drive.parse({})).toEqual({})
    expect(ACTION_CONFIG_SCHEMAS.save_to_drive.safeParse({ folder_name: "Bob's calls" }).success).toBe(false)
  })
})

describe('parseSpreadsheetId', () => {
  it('extracts the id from sharing links', () => {
    expect(parseSpreadsheetId(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`)).toBe(SHEET_ID)
    expect(parseSpreadsheetId(`  ${SHEET_ID}  `)).toBe(SHEET_ID)
    expect(parseSpreadsheetId('https://docs.google.com/document/d/abc')).toBe('')
  })
})

describe('workflowActionSchema', () => {
  it('discriminates on type and rejects unknown types', () => {
    expect(workflowActionSchema.safeParse({ id: 'a', type: 'wait', config: { seconds: 3 } }).success).toBe(true)
    expect(workflowActionSchema.safeParse({ id: 'a', type: 'launch_rocket', config: {} }).success).toBe(false)
    expect(workflowActionSchema.safeParse({ id: 'a b', type: 'wait', config: {} }).success).toBe(false)
  })
})

describe('workflowCreateSchema', () => {
  it('accepts a complete workflow and defaults enabled', () => {
    const parsed = workflowCreateSchema.parse(workflow({ description: '  ' }))
    expect(parsed.enabled).toBe(true)
    expect(parsed.description).toBeNull()
    expect(parsed.trigger_config).toEqual({})
  })

  it('requires a keyword for the keyword trigger and normalises it', () => {
    expect(workflowCreateSchema.safeParse(workflow({ trigger: 'keyword_detected' })).success).toBe(false)
    const parsed = workflowCreateSchema.parse(workflow({ trigger: 'keyword_detected', trigger_config: { keyword: ' urgent ,  refund,,' } }))
    expect(parsed.trigger_config).toEqual({ keyword: 'urgent, refund' })
  })

  it('drops the keyword for other triggers', () => {
    expect(workflowCreateSchema.parse(workflow({ trigger_config: { keyword: 'x' } })).trigger_config).toEqual({})
  })

  it(`allows 1 to ${MAX_WORKFLOW_ACTIONS} steps with unique ids`, () => {
    const step = (i: number) => ({ id: `a${i}`, type: 'wait', config: { seconds: 1 } })
    expect(workflowCreateSchema.safeParse(workflow({ actions: [] })).success).toBe(false)
    expect(workflowCreateSchema.safeParse(workflow({ actions: Array.from({ length: MAX_WORKFLOW_ACTIONS }, (_, i) => step(i)) })).success).toBe(true)
    expect(workflowCreateSchema.safeParse(workflow({ actions: Array.from({ length: MAX_WORKFLOW_ACTIONS + 1 }, (_, i) => step(i)) })).success).toBe(false)
    expect(workflowCreateSchema.safeParse(workflow({ actions: [step(1), step(1)] })).success).toBe(false)
  })

  it('rejects unknown triggers and blank names', () => {
    expect(workflowCreateSchema.safeParse(workflow({ trigger: 'call_started' })).success).toBe(false)
    expect(workflowCreateSchema.safeParse(workflow({ name: '   ' })).success).toBe(false)
  })
})

describe('workflowPatchSchema', () => {
  it('accepts partial updates and secret rotation, rejects unknown keys and empty bodies', () => {
    expect(workflowPatchSchema.safeParse({ enabled: false }).success).toBe(true)
    expect(workflowPatchSchema.safeParse({ rotate_secret: true }).success).toBe(true)
    expect(workflowPatchSchema.safeParse({ rotate_secret: false }).success).toBe(false)
    expect(workflowPatchSchema.safeParse({ signing_secret: 'mine' }).success).toBe(false)
    expect(workflowPatchSchema.safeParse({ org_id: 'x' }).success).toBe(false)
    expect(workflowPatchSchema.safeParse({}).success).toBe(false)
  })
})

describe('parseStoredAction', () => {
  it('reads configs saved by the old builder', () => {
    const slack = parseStoredAction({ id: 'a0', type: 'notify_slack', config: { url: 'https://hooks.slack.com/services/T/B/x' } }, 0)
    expect(slack).toMatchObject({ ok: true, action: { type: 'notify_slack', config: { webhook_url: 'https://hooks.slack.com/services/T/B/x' } } })
    expect(parseStoredAction({ id: 'a1', type: 'wait', config: {} }, 1)).toMatchObject({ ok: true, action: { config: { seconds: 5 } } })
  })

  it('turns broken or unknown steps into a fixable message', () => {
    const broken = parseStoredAction({ id: 'a2', type: 'send_webhook', config: { url: 'http://insecure.example.com' } }, 2)
    expect(broken.ok).toBe(false)
    if (!broken.ok) expect(broken.message).toMatch(/needs attention/)
    const unknown = parseStoredAction({ type: 'launch_rocket' }, 3)
    expect(unknown).toMatchObject({ ok: false, id: 'step-4', type: 'launch_rocket' })
    expect(parseStoredAction(null, 0).ok).toBe(false)
  })
})

describe('builder error mapping', () => {
  it('shows an invalid address inside a recipient list under the "to" field', () => {
    const parsed = actionListSchema.safeParse([
      { id: 'a1', type: 'add_tag', config: { tag: 'vip' } },
      { id: 'a2', type: 'send_email', config: { to: 'owner@example.com, not-an-email', subject: 'Call' } },
    ])
    expect(parsed.success).toBe(false)
    if (parsed.success) return
    const byPath = issuesByPath(parsed.error)
    expect(Object.keys(byPath)).toContain('1.config.to.1')
    const stepTwo = Object.fromEntries(
      Object.entries(byPath)
        .filter(([key]) => key.startsWith('1.'))
        .map(([key, message]) => [key.slice(2), message])
    )
    expect(stepFieldErrors(stepTwo)).toEqual({ to: 'One of the addresses isn’t a valid email' })
  })

  it('keeps the first message per field and ignores step-level keys', () => {
    expect(
      stepFieldErrors({
        '': 'Whole step',
        id: 'Duplicate step id',
        'config.url': 'Use a full https:// address',
        'config.to.0': 'first',
        'config.to.3': 'second',
      })
    ).toEqual({ url: 'Use a full https:// address', to: 'first' })
  })
})
