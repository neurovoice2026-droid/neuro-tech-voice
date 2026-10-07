// Bearer authentication of the Cartesia (fallback agent) webhook tools: the
// static CARTESIA_TOOL_SECRET configured on the tool, compared in constant
// time (same rule as ../cartesia-context/route.ts). Private folder: not a route.

import crypto from 'crypto'

export function cartesiaToolAuthorized(request: Request): boolean {
  const secret = (process.env.CARTESIA_TOOL_SECRET ?? '').trim()
  if (secret.length < 24) return false
  const header = request.headers.get('authorization') ?? ''
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!given) return false
  const a = crypto.createHash('sha256').update(given).digest()
  const b = crypto.createHash('sha256').update(secret).digest()
  return crypto.timingSafeEqual(a, b)
}
