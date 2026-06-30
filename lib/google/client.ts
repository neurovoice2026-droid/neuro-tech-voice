import { google } from 'googleapis'

export function getGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  )
}

export function getGoogleOAuthUrl(state: string): string {
  const client = getGoogleOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/drive.file',
    ],
    state,
  })
}

export function getGoogleClientWithToken(refreshToken: string) {
  const client = getGoogleOAuthClient()
  client.setCredentials({ refresh_token: refreshToken })
  return client
}
