import 'server-only'
import { Readable } from 'node:stream'
// Per-API entry points instead of the whole `googleapis` package: much faster cold starts.
import { calendar as googleCalendar } from 'googleapis/build/src/apis/calendar'
import { docs as googleDocs } from 'googleapis/build/src/apis/docs'
import { drive as googleDrive, type drive_v3 } from 'googleapis/build/src/apis/drive'
import { gmail as googleGmail } from 'googleapis/build/src/apis/gmail'
import { sheets as googleSheets } from 'googleapis/build/src/apis/sheets'
import { entitlementsFor, requiredPlanFor } from '@/lib/billing/entitlements'
import { isGoogleConfigured } from '@/lib/env'
import {
  getAuthorizedClient,
  isGoogleAuthError,
  markGoogleIntegrationBroken,
  type GoogleOAuthClient,
} from '@/lib/google/client'
import { PLANS } from '@/types'
import type { ActionConfig } from './schemas'
import {
  DEFAULT_DOC_TITLE,
  DEFAULT_EMAIL_BODY,
  buildTemplateVars,
  renderTemplate,
  singleLine,
} from './templates'
import {
  SHEET_HEADER,
  buildRawEmail,
  callReportDocument,
  googleErrorMessage,
  sheetRange,
  sheetRow,
  transcriptFile,
} from './report'
import { GOOGLE_ACTION_INTEGRATION, type GoogleActionType, type WorkflowCallData, type WorkflowOrgData } from './types'

// Google Workspace steps (beta). Each one checks the plan, the app's Google
// configuration and the organisation's connection before calling Google, and
// turns every failure into a sentence the owner can act on.

export interface StepOutcome {
  success: boolean
  message: string
  attempts: number
  status_code?: number | null
  /** Recorded as skipped rather than failed (nothing was wrong, nothing to do). */
  skipped?: boolean
}

const GOOGLE_TIMEOUT_MS = 15_000
const DEFAULT_DRIVE_FOLDER = 'Neuro Tech Voice calls'

const PRODUCT_LABEL: Record<GoogleActionType, string> = {
  send_email: 'Gmail',
  add_to_sheet: 'Google Sheets',
  create_calendar_event: 'Google Calendar',
  create_doc: 'Google Docs',
  save_to_drive: 'Google Drive',
}

interface GoogleStepEnv {
  org: WorkflowOrgData
  call: WorkflowCallData
}

async function authorize(type: GoogleActionType, env: GoogleStepEnv): Promise<{ auth: GoogleOAuthClient } | { outcome: StepOutcome }> {
  const product = PRODUCT_LABEL[type]
  if (!entitlementsFor(env.org.plan).googleIntegrations) {
    const plan = PLANS[requiredPlanFor('googleIntegrations')].name
    return { outcome: { success: false, attempts: 0, message: `${product} steps are part of the ${plan} plan. Upgrade to turn this step on.` } }
  }
  if (!isGoogleConfigured()) {
    console.error('[workflows] Google step skipped: Google OAuth is not configured')
    return { outcome: { success: false, attempts: 0, message: 'Google connections are unavailable right now. Please contact support.' } }
  }
  try {
    const auth = await getAuthorizedClient(env.org.id, GOOGLE_ACTION_INTEGRATION[type])
    if (!auth) {
      return { outcome: { success: false, attempts: 0, message: `${product} isn’t connected. Connect it on the Integrations page.` } }
    }
    return { auth }
  } catch (error) {
    console.error('[workflows] Google authorization failed', type, error instanceof Error ? error.message : error)
    return { outcome: { success: false, attempts: 1, message: googleErrorMessage(error, product) } }
  }
}

async function failure(type: GoogleActionType, env: GoogleStepEnv, error: unknown): Promise<StepOutcome> {
  const e = error as { response?: { status?: number } }
  console.error('[workflows] Google step failed', type, e?.response?.status ?? '', error instanceof Error ? error.message : '')
  // Revoked or expired access only gets fixed by reconnecting: flag it so the
  // Integrations page asks for that and the agent stops relying on it.
  if (isGoogleAuthError(error)) {
    await markGoogleIntegrationBroken(env.org.id, GOOGLE_ACTION_INTEGRATION[type], `${PRODUCT_LABEL[type]} access was revoked or expired during a workflow.`)
  }
  return {
    success: false,
    attempts: 1,
    status_code: typeof e?.response?.status === 'number' ? e.response.status : null,
    message: googleErrorMessage(error, PRODUCT_LABEL[type]),
  }
}

export async function sendGmail(config: ActionConfig<'send_email'>, env: GoogleStepEnv): Promise<StepOutcome> {
  const authorized = await authorize('send_email', env)
  if ('outcome' in authorized) return authorized.outcome
  const vars = buildTemplateVars(env.call, env.org)
  const subject = singleLine(renderTemplate(config.subject, vars)) || 'Call follow-up'
  const body = renderTemplate(config.body?.trim() ? config.body : DEFAULT_EMAIL_BODY, vars).trim()
  try {
    const gmail = googleGmail({ version: 'v1', auth: authorized.auth })
    await gmail.users.messages.send(
      { userId: 'me', requestBody: { raw: buildRawEmail({ to: config.to, subject, body }) } },
      { timeout: GOOGLE_TIMEOUT_MS }
    )
    const recipients = config.to.length === 1 ? config.to[0] : `${config.to.length} recipients`
    return { success: true, attempts: 1, message: `Email sent to ${recipients}.` }
  } catch (error) {
    return failure('send_email', env, error)
  }
}

export async function appendSheetRow(config: ActionConfig<'add_to_sheet'>, env: GoogleStepEnv): Promise<StepOutcome> {
  const authorized = await authorize('add_to_sheet', env)
  if ('outcome' in authorized) return authorized.outcome
  try {
    const sheets = googleSheets({ version: 'v4', auth: authorized.auth })
    const range = sheetRange(config.sheet_name)
    // A header row first when the tab is empty, so the sheet reads well on its own.
    const existing = await sheets.spreadsheets.values.get(
      { spreadsheetId: config.spreadsheet_id, range, majorDimension: 'ROWS' },
      { timeout: GOOGLE_TIMEOUT_MS }
    )
    const empty = !existing.data.values || existing.data.values.length === 0
    const values = empty ? [[...SHEET_HEADER], sheetRow(env.call, env.org)] : [sheetRow(env.call, env.org)]
    await sheets.spreadsheets.values.append(
      {
        spreadsheetId: config.spreadsheet_id,
        range,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values },
      },
      { timeout: GOOGLE_TIMEOUT_MS }
    )
    return { success: true, attempts: 1, message: config.sheet_name ? `Row added to the “${config.sheet_name}” tab.` : 'Row added to the sheet.' }
  } catch (error) {
    return failure('add_to_sheet', env, error)
  }
}

export async function createFollowUpEvent(config: ActionConfig<'create_calendar_event'>, env: GoogleStepEnv): Promise<StepOutcome> {
  const authorized = await authorize('create_calendar_event', env)
  if ('outcome' in authorized) return authorized.outcome
  const vars = buildTemplateVars(env.call, env.org)
  const quarter = 15 * 60 * 1000
  // Rounded up to the next quarter hour so the event lands on a normal slot.
  const start = new Date(Math.ceil((Date.now() + config.offset_hours * 3_600_000) / quarter) * quarter)
  const end = new Date(start.getTime() + config.duration_minutes * 60_000)
  try {
    const calendar = googleCalendar({ version: 'v3', auth: authorized.auth })
    await calendar.events.insert(
      {
        calendarId: 'primary',
        requestBody: {
          summary: singleLine(renderTemplate(config.title, vars)) || 'Call follow-up',
          description: callReportDocument(env.call, env.org, { includeTranscript: false }),
          start: { dateTime: start.toISOString(), timeZone: env.org.timezone },
          end: { dateTime: end.toISOString(), timeZone: env.org.timezone },
          extendedProperties: env.call.call_id ? { private: { ntv_call_id: env.call.call_id } } : undefined,
        },
      },
      { timeout: GOOGLE_TIMEOUT_MS }
    )
    return { success: true, attempts: 1, message: `Follow-up added to your calendar ${config.offset_hours} ${config.offset_hours === 1 ? 'hour' : 'hours'} after the call.` }
  } catch (error) {
    return failure('create_calendar_event', env, error)
  }
}

export async function createCallDoc(config: ActionConfig<'create_doc'>, env: GoogleStepEnv): Promise<StepOutcome> {
  const authorized = await authorize('create_doc', env)
  if ('outcome' in authorized) return authorized.outcome
  const vars = buildTemplateVars(env.call, env.org)
  const title = singleLine(renderTemplate(config.title || DEFAULT_DOC_TITLE, vars)) || 'Call report'
  try {
    const docs = googleDocs({ version: 'v1', auth: authorized.auth })
    const created = await docs.documents.create({ requestBody: { title } }, { timeout: GOOGLE_TIMEOUT_MS })
    const documentId = created.data.documentId
    if (!documentId) throw new Error('Google Docs returned no document id')
    await docs.documents.batchUpdate(
      {
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: callReportDocument(env.call, env.org, { includeTranscript: config.include_transcript }),
              },
            },
          ],
        },
      },
      { timeout: GOOGLE_TIMEOUT_MS }
    )
    return { success: true, attempts: 1, message: `Document “${title}” created.` }
  } catch (error) {
    return failure('create_doc', env, error)
  }
}

// drive.file only lets the app see files and folders it created, so the folder
// is found by name among those (or created once) instead of a picked folder id.
async function findOrCreateFolder(drive: drive_v3.Drive, name: string): Promise<string> {
  const escaped = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const found = await drive.files.list(
    {
      q: `mimeType = 'application/vnd.google-apps.folder' and name = '${escaped}' and trashed = false`,
      fields: 'files(id)',
      pageSize: 1,
      spaces: 'drive',
    },
    { timeout: GOOGLE_TIMEOUT_MS }
  )
  const existing = found.data.files?.[0]?.id
  if (existing) return existing
  const created = await drive.files.create(
    { requestBody: { name, mimeType: 'application/vnd.google-apps.folder' }, fields: 'id' },
    { timeout: GOOGLE_TIMEOUT_MS }
  )
  if (!created.data.id) throw new Error('Google Drive returned no folder id')
  return created.data.id
}

export async function saveTranscriptToDrive(config: ActionConfig<'save_to_drive'>, env: GoogleStepEnv): Promise<StepOutcome> {
  const authorized = await authorize('save_to_drive', env)
  if ('outcome' in authorized) return authorized.outcome
  const folderName = config.folder_name?.trim() || DEFAULT_DRIVE_FOLDER
  const file = transcriptFile(env.call, env.org)
  try {
    const drive = googleDrive({ version: 'v3', auth: authorized.auth })
    const folderId = await findOrCreateFolder(drive, folderName)
    await drive.files.create(
      {
        requestBody: { name: file.name, parents: [folderId], mimeType: 'text/plain' },
        media: { mimeType: 'text/plain', body: Readable.from([file.content]) },
        fields: 'id',
      },
      { timeout: GOOGLE_TIMEOUT_MS }
    )
    return { success: true, attempts: 1, message: `Transcript saved to the “${folderName}” folder in Google Drive.` }
  } catch (error) {
    return failure('save_to_drive', env, error)
  }
}
