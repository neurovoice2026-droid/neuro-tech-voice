// Small client helpers for the workflow and integration APIs.

/** The message from our `{ error: { code, message } }` body, or a friendly fallback. */
export async function readApiError(res: Response, fallback = 'Something went wrong. Please try again.'): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: unknown } | string }
    if (typeof body.error === 'string') return body.error
    if (body.error && typeof body.error.message === 'string') return body.error.message
  } catch {
    // not JSON
  }
  if (res.status === 429) return 'You’re doing that a bit too often. Please wait a moment and try again.'
  return fallback
}
