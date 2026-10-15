import { google } from 'googleapis'
import { googleScopesFor, type GoogleIntegrationType } from '@/lib/google/scopes'

export function getGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  )
}

// Asks only for the scopes of the integration being connected
// (lib/google/scopes.ts). include_granted_scopes is Google's incremental
// authorization: the consent screen shows the new scope alone, and the token
// also carries what this account granted the app before.
export function getGoogleOAuthUrl(type: GoogleIntegrationType, state: string): string {
  const client = getGoogleOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: googleScopesFor(type),
    include_granted_scopes: true,
    state,
  })
}

export function getGoogleClientWithToken(refreshToken: string) {
  const client = getGoogleOAuthClient()
  client.setCredentials({ refresh_token: refreshToken })
  return client
}
