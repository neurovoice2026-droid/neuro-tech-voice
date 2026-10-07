// ELEVENLABS_TOOL_SECRET: the value of the X-NTV-Tool-Key header every
// platform webhook tool sends (stored once as an ElevenLabs workspace secret,
// referenced by id in the tool config). Values are only read here and never
// returned by the diagnostics, only their presence.
//
// Rotation: set ELEVENLABS_TOOL_SECRET to the new value and
// ELEVENLABS_TOOL_SECRET_PREVIOUS to the old one, deploy, run the tool
// reconcile (maintenance or POST /api/admin/voice/tools); once it reports the
// secret rotated, remove ELEVENLABS_TOOL_SECRET_PREVIOUS.

import crypto from 'crypto'
import type { ConfigProblem } from '@/lib/voice-providers/config'

export const TOOL_SECRET_MIN_LENGTH = 32

function read(name: string): string | null {
  const v = (process.env[name] ?? '').trim()
  return v.length >= TOOL_SECRET_MIN_LENGTH ? v : null
}

/** The current tool key, or null when missing or shorter than 32 characters. */
export function toolSecretValue(): string | null {
  return read('ELEVENLABS_TOOL_SECRET')
}

/** The previous tool key, accepted during a rotation only. */
export function previousToolSecretValue(): string | null {
  return read('ELEVENLABS_TOOL_SECRET_PREVIOUS')
}

/** Production deployments must authenticate tool requests with the workspace key. */
export function toolSecretRequired(): boolean {
  return process.env.NODE_ENV === 'production'
}

function sameSecret(given: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(given).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

/**
 * Checks the X-NTV-Tool-Key header in constant time against the current key
 * and, during a rotation, the previous one. 'not_configured' when no key is
 * set (development only: production requires one, see toolSecretRequired).
 */
export function checkToolKey(header: string | null): 'valid' | 'invalid' | 'not_configured' {
  const current = toolSecretValue()
  if (!current) return 'not_configured'
  if (!header) return 'invalid'
  const previous = previousToolSecretValue()
  // Both comparisons always run: no timing difference between the two keys.
  const okCurrent = sameSecret(header, current)
  const okPrevious = previous ? sameSecret(header, previous) : false
  return okCurrent || okPrevious ? 'valid' : 'invalid'
}

/** Configuration problems (presence and length only, never values). */
export function toolSecretProblems(): ConfigProblem[] {
  const out: ConfigProblem[] = []
  const raw = (process.env.ELEVENLABS_TOOL_SECRET ?? '').trim()
  const rawPrev = (process.env.ELEVENLABS_TOOL_SECRET_PREVIOUS ?? '').trim()
  if (!raw) {
    out.push({
      key: 'ELEVENLABS_TOOL_SECRET',
      severity: toolSecretRequired() ? 'error' : 'warning',
      message: toolSecretRequired()
        ? 'Missing: platform webhook tools (human transfer) cannot be set up; app-routed agents offer to take a message instead.'
        : 'Missing: tool requests are authenticated by the per-call token only (allowed outside production).',
    })
  } else if (raw.length < TOOL_SECRET_MIN_LENGTH) {
    out.push({ key: 'ELEVENLABS_TOOL_SECRET', severity: 'error', message: `Shorter than ${TOOL_SECRET_MIN_LENGTH} characters: ignored.` })
  }
  if (rawPrev && rawPrev.length < TOOL_SECRET_MIN_LENGTH) {
    out.push({ key: 'ELEVENLABS_TOOL_SECRET_PREVIOUS', severity: 'warning', message: `Shorter than ${TOOL_SECRET_MIN_LENGTH} characters: ignored.` })
  } else if (rawPrev) {
    out.push({ key: 'ELEVENLABS_TOOL_SECRET_PREVIOUS', severity: 'warning', message: 'A previous tool key is still accepted: remove it once the rotation is reported done.' })
  }
  return out
}
