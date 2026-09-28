import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { kvDel, kvGet, kvSet } from '@/lib/kv'
import { randomToken, sha256Hex } from '@/lib/security/crypto'

// Proof that a session came from a password-reset link. Choosing a new
// password without the old one is only allowed right after the emailed link
// was opened: otherwise anyone holding a signed-in session (a shared computer,
// a stolen cookie) could set a new password, sign the owner out everywhere and
// pass the re-sign-in check that guards account deletion.
//
// /reset-password/callback stores a hash of a random nonce under the user id
// and puts the nonce in an httpOnly cookie; updatePassword needs both to
// match, and uses them up.

export const RECOVERY_COOKIE = 'ntv_pw_recovery'
/** Matches the reset page's useful life; the emailed link itself expires sooner. */
export const RECOVERY_TTL_SECONDS = 15 * 60

function recoveryKey(userId: string): string {
  return `auth:recovery:${userId}`
}

/** Called once the reset link's code was exchanged; returns the nonce for the cookie. */
export async function issueRecoveryGrant(userId: string): Promise<string> {
  const nonce = randomToken(32)
  await kvSet(recoveryKey(userId), sha256Hex(nonce), RECOVERY_TTL_SECONDS)
  return nonce
}

/** True when `nonce` (from the cookie) matches the user's grant. Doesn't use it up. */
export async function hasRecoveryGrant(userId: string, nonce: string | null | undefined): Promise<boolean> {
  if (!nonce || nonce.length > 128) return false
  const stored = await kvGet<string>(recoveryKey(userId))
  if (typeof stored !== 'string' || stored.length !== 64) return false
  return timingSafeEqual(Buffer.from(stored, 'utf8'), Buffer.from(sha256Hex(nonce), 'utf8'))
}

/** The new password is set: the grant can't be used again. */
export async function consumeRecoveryGrant(userId: string): Promise<void> {
  await kvDel(recoveryKey(userId))
}
