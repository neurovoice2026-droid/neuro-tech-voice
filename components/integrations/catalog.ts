import type { GoogleIntegrationType } from '@/lib/workflows/types'

export interface GoogleIntegrationInfo {
  type: GoogleIntegrationType
  name: string
  logo: string
  logoBg: string
  description: string
  /** Only what the product does today. */
  capabilities: string[]
}

// Descriptions match what the app actually does with each connection
// (lib/workflows/google.ts, and the agent's calendar tools for Calendar).
export const GOOGLE_INTEGRATIONS: GoogleIntegrationInfo[] = [
  {
    type: 'google_calendar',
    name: 'Google Calendar',
    logo: '/integrari/google_calendar.svg',
    logoBg: 'bg-blue-50',
    description: 'Let your agent check your availability and book appointments while it talks to callers.',
    capabilities: ['Checks free times during calls', 'Books, moves and cancels appointments', 'Adds follow-up reminders from workflows'],
  },
  {
    type: 'gmail',
    name: 'Gmail',
    logo: '/integrari/google_mail.svg',
    logoBg: 'bg-red-50',
    description: 'Email a call’s summary from your own Gmail address with a workflow step.',
    capabilities: ['Sends from your Gmail account', 'Summary, outcome and caller details', 'Your own subject and message'],
  },
  {
    type: 'google_sheets',
    name: 'Google Sheets',
    logo: '/integrari/google_sheets.svg',
    logoBg: 'bg-green-50',
    description: 'Add a row for every call to a spreadsheet you choose.',
    capabilities: ['Date, number and caller name', 'Outcome, sentiment and summary', 'Header row added for you'],
  },
  {
    type: 'google_docs',
    name: 'Google Docs',
    logo: '/integrari/google_docs.svg',
    logoBg: 'bg-blue-50',
    description: 'Write a call report as a Google Doc after each call.',
    capabilities: ['Summary and call details', 'Full transcript if you want it', 'Title with the date and caller'],
  },
  {
    type: 'google_drive',
    name: 'Google Drive',
    logo: '/integrari/google_drive.svg',
    logoBg: 'bg-yellow-50',
    description: 'Save each call’s transcript as a text file in a Drive folder.',
    capabilities: ['One file per call', 'Kept in a folder you name', 'Only touches files it created'],
  },
]

/** Friendly text for ?error= codes the Google connect flow sends back (app/api/integrations/google/*). */
export function connectErrorMessage(code: string): string {
  switch (code) {
    case 'oauth_denied':
      return 'The Google connection was cancelled. Nothing was changed.'
    case 'invalid_state':
      return 'That connection link expired or was opened in another tab. Please try connecting again.'
    case 'token_exchange':
    case 'no_refresh_token':
      return 'Google didn’t finish the connection. Please try again.'
    case 'missing_permissions':
      return 'Google didn’t grant every permission this needs. Please connect again and allow everything it asks for.'
    case 'upgrade_required':
      return 'Google Workspace is part of a higher plan. Upgrade to connect it.'
    case 'rate_limited':
      return 'Too many connection attempts. Please wait a few minutes and try again.'
    case 'google_not_configured':
    case 'encryption_not_configured':
    case 'setup_incomplete':
      return 'Google connections are unavailable right now. Please contact support.'
    case 'invalid_type':
      return 'That isn’t a Google service we can connect.'
    case 'save_failed':
      return 'We couldn’t save the connection. Please try again.'
    default:
      return 'We couldn’t connect Google. Please try again.'
  }
}
