// POST /api/commerce/webhooks/[platform]/[publicId] — store platform webhooks.
// Public (no session): the random public id resolves the connection and the
// platform's signature over the raw bytes authenticates the delivery
// (lib/commerce/webhooks/ingest.ts). Never logs the body or the headers.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { MAX_WEBHOOK_BYTES, ingestWebhook } from '@/lib/commerce/webhooks/ingest'

export const maxDuration = 30

export async function POST(request: Request, ctx: { params: Promise<{ platform: string; publicId: string }> }) {
  const { platform, publicId } = await ctx.params
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'commerce.webhook' })
  const headers = { 'Cache-Control': 'no-store' }
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_WEBHOOK_BYTES) return NextResponse.json({ ok: false, error: 'payload too large' }, { status: 413, headers })
  try {
    const rawBody = new Uint8Array(await request.arrayBuffer())
    const result = await ingestWebhook(createAdminClient(), { platform, publicId, request: { headers: request.headers, rawBody, url: new URL(request.url) } }, log)
    return NextResponse.json(result.body, { status: result.status, headers })
  } catch (err) {
    log.error('commerce.webhook.failed', err)
    // 5xx: the platform retries (where it retries at all); nothing was written.
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500, headers })
  }
}
