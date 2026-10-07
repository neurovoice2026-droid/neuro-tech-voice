// What the owner types to confirm account deletion, and the fresh sign-in the
// request needs. Pure and client-safe: shared by DELETE /api/account and the
// Settings dialog.

/** Deleting an account needs a sign-in within this window (a session left open is not enough). */
export const REAUTH_WINDOW_MS = 30 * 60 * 1000

/** The business name, trimmed; DELETE when the organization has no name. */
export function expectedDeletionConfirmation(orgName: string | null | undefined): string {
  return orgName?.trim() || 'DELETE'
}

/** Exact match after trimming the typed text (case and spacing inside the name matter). */
export function isDeletionConfirmed(typed: string, orgName: string | null | undefined): boolean {
  return typed.trim() === expectedDeletionConfirmation(orgName)
}

/** True when the user signed in within REAUTH_WINDOW_MS of `now`. */
export function isRecentSignIn(lastSignInAt: string | null | undefined, now = Date.now()): boolean {
  const at = lastSignInAt ? Date.parse(lastSignInAt) : Number.NaN
  if (!Number.isFinite(at)) return false
  // A sign-in in the future (clock skew of a few seconds) still counts as recent.
  return now - at <= REAUTH_WINDOW_MS
}

/**
 * What the Settings page lists before the confirmation, kept in one place so
 * the dialog and the docs say the same thing as the deletion job.
 */
export const DELETED_ITEMS: readonly string[] = [
  'Your subscription and phone number billing (cancelled first, nothing more is charged)',
  'Your phone numbers (released) and your AI agent at every voice provider',
  'Every call record: transcripts, summaries and recordings, here and at the voice providers',
  'Your knowledge base documents, imported websites and uploaded files',
  'Your custom voices, pronunciation rules, workflows, messages and bookings',
  'Your Google connection (access revoked; events already in your own calendar stay there) and your sign-in',
]

export const RETAINED_ITEMS: readonly string[] = [
  'Your invoices, kept for 10 years as Romanian accounting law requires',
  'Monthly totals of billed minutes (no call details), kept with the invoices',
  'A record that the account was deleted, with no personal data',
]
