import 'server-only'
// Revokes a Google OAuth grant (https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke):
// POST https://oauth2.googleapis.com/revoke with the token form-encoded.
// 200 = revoked; 400 = the token is already invalid (revoked or expired).
// The token is sent in the body only, never in a URL or a log line.

const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const TIMEOUT_MS = 10_000

export class GoogleRevokeError extends Error {
  constructor(
    readonly status: number | null,
    readonly reason: 'http' | 'timeout' | 'network' = 'http',
  ) {
    super(status ? `Google revoke failed with HTTP ${status}` : `Google revoke failed (${reason})`)
    this.name = 'GoogleRevokeError'
  }
}

export async function revokeGoogleToken(token: string): Promise<'revoked' | 'already_invalid'> {
  let res: Response
  try {
    res = await fetch(REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (err) {
    // Network or timeout: the caller retries; the error carries no request data (the token stays out of it).
    throw new GoogleRevokeError(null, err instanceof DOMException && err.name === 'TimeoutError' ? 'timeout' : 'network')
  }
  // The body is never read or surfaced (it can echo request details).
  if (res.ok) return 'revoked'
  if (res.status === 400) return 'already_invalid'
  throw new GoogleRevokeError(res.status)
}
