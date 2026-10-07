// Scheduled voice maintenance (vercel.json cron, daily on the Hobby plan; every
// 5 minutes with supabase/ops/schedule_voice_maintenance.sql):
// provider health probes (feed the circuit breaker), agent sync retries,
// webhook reprocessing and Cartesia call polling. Vercel Cron authenticates
// with `Authorization: Bearer $CRON_SECRET`.
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { runVoiceMaintenance } from '@/lib/voice-providers/maintenance'

export const maxDuration = 300

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? ''
  if (secret.length < 16) return false
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const a = crypto.createHash('sha256').update(given).digest()
  const b = crypto.createHash('sha256').update(secret).digest()
  return crypto.timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'cron.voice_maintenance' })
  if (!authorized(request)) {
    log.warn('cron.unauthorized')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const started = Date.now()
  const report = await runVoiceMaintenance(log)
  log.info('cron.voice_maintenance_done', { ms: Date.now() - started })
  return NextResponse.json({ ok: true, ms: Date.now() - started, report }, { headers: { 'Cache-Control': 'no-store' } })
}
