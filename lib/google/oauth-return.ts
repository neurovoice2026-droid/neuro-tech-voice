// Where the Google OAuth flow sends the owner back. Only same-origin pages
// from this allow-list (exact path + query) are accepted: anything else, an
// absolute URL, `//host` or a crafted path, falls back to /integrations, so
// the callback can never be turned into an open redirect. The connect route
// stores the allow-list KEY next to the CSRF nonce in the OAuth state cookie
// (`<nonce>.<key>`); the callback maps the key back to the path. Pure.

export const DEFAULT_OAUTH_RETURN_PATH = '/integrations'

const RETURN_PATHS = {
  integrations: DEFAULT_OAUTH_RETURN_PATH,
  agent_call_handling: '/agent?tab=call-handling',
} as const

export type OAuthReturnKey = keyof typeof RETURN_PATHS

/** The allow-list key of a requested return path (`?return_to=`), or null when it is not allowed. */
export function oauthReturnKey(requested: string | null | undefined): OAuthReturnKey | null {
  if (!requested) return null
  for (const [key, path] of Object.entries(RETURN_PATHS) as Array<[OAuthReturnKey, string]>) {
    if (path === requested) return key
  }
  return null
}

/** The page of an allow-list key; the default for anything else. */
export function oauthReturnPath(key: string | null | undefined): string {
  return key && Object.hasOwn(RETURN_PATHS, key) ? RETURN_PATHS[key as OAuthReturnKey] : DEFAULT_OAUTH_RETURN_PATH
}

/** Value of the state cookie: the CSRF nonce, plus the return key when there is one. */
export function oauthStateCookieValue(nonce: string, key: OAuthReturnKey | null): string {
  return key && key !== 'integrations' ? `${nonce}.${key}` : nonce
}

/** Splits the state cookie back into nonce and return path (older cookies carry the nonce only). */
export function parseOAuthStateCookie(value: string | null | undefined): { nonce: string | null; returnPath: string } {
  if (!value) return { nonce: null, returnPath: DEFAULT_OAUTH_RETURN_PATH }
  const dot = value.indexOf('.')
  const nonce = dot === -1 ? value : value.slice(0, dot)
  const key = dot === -1 ? null : value.slice(dot + 1)
  return { nonce: nonce || null, returnPath: oauthReturnPath(key) }
}

/**
 * `path` plus extra query parameters (e.g. `connected`, `error`). `path` must
 * come from the allow-list; the result is relative to the request's origin.
 */
export function withQuery(path: string, params: Record<string, string>): string {
  const [pathname, query = ''] = path.split('?')
  const search = new URLSearchParams(query)
  for (const [k, v] of Object.entries(params)) search.set(k, v)
  const qs = search.toString()
  return qs ? `${pathname}?${qs}` : pathname
}
