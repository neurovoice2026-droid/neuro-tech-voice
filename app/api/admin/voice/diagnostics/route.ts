// Platform-admin diagnostics: configuration presence (never values), config
// problems, circuit states, platform resources, sync/webhook backlogs and the
// last 24 h of failovers. `?probe=1` also runs live health probes (read-only
// provider calls).
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { summarizeVoiceConfig, validateVoiceConfig } from '@/lib/voice-providers/config'
import { peek } from '@/lib/voice-providers/circuit-registry'
import { listPlatformResources } from '@/lib/voice-providers/platform-resources'
import { probeProviders } from '@/lib/voice-providers/maintenance'
import { diagnoseModels } from '@/lib/elevenlabs/model-diagnostics'
import { knowledgeDiagnostics } from '@/lib/voice-providers/knowledge-diagnostics'

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'admin.voice.diagnostics' })
  try {
    const admin = await requireAdmin(request)
    const db = createAdminClient()
    const since = new Date(Date.now() - 24 * 3600_000).toISOString()
    const [elCircuit, ctCircuit, elMedia, ctMedia, resources, syncRows, webhookRows, failovers, recentCalls] = await Promise.all([
      peek('elevenlabs'),
      peek('cartesia'),
      peek('elevenlabs_media'),
      peek('cartesia_media'),
      listPlatformResources(),
      db.from('agent_provider_resources').select('provider, status'),
      db.from('webhook_events').select('provider, status').in('status', ['received', 'processing', 'failed']),
      db.from('provider_events').select('system, ok, details').eq('kind', 'failover').gte('created_at', since).limit(1000),
      db.from('calls').select('provider, routing_reason, duration_seconds, cost_usd').gte('created_at', since).limit(5000),
    ])
    for (const r of [syncRows, webhookRows, failovers, recentCalls]) if (r.error) throw new Error(`diagnostics read failed: ${r.error.message}`)

    // Provider selection and cost per minute over the last 24 h.
    const usage: Record<string, { calls: number; minutes: number; cost_usd: number; cost_per_minute_usd: number | null }> = {}
    const reasons: Record<string, number> = {}
    for (const c of recentCalls.data ?? []) {
      const key = (c.provider as string | null) ?? 'none'
      const u = (usage[key] = usage[key] ?? { calls: 0, minutes: 0, cost_usd: 0, cost_per_minute_usd: null })
      u.calls++
      u.minutes += Number(c.duration_seconds ?? 0) / 60
      u.cost_usd += Number(c.cost_usd ?? 0)
      const reason = (c.routing_reason as string | null) ?? 'unknown'
      reasons[reason] = (reasons[reason] ?? 0) + 1
    }
    for (const u of Object.values(usage)) {
      u.minutes = Math.round(u.minutes * 10) / 10
      u.cost_per_minute_usd = u.minutes > 0 && u.cost_usd > 0 ? Math.round((u.cost_usd / u.minutes) * 10000) / 10000 : null
    }

    const tally = (rows: Array<Record<string, unknown>>, a: string, b: string) => {
      const out: Record<string, Record<string, number>> = {}
      for (const r of rows) {
        const k1 = String(r[a])
        const k2 = String(r[b])
        out[k1] = out[k1] ?? {}
        out[k1][k2] = (out[k1][k2] ?? 0) + 1
      }
      return out
    }
    const probe = new URL(request.url).searchParams.get('probe') === '1'
    // TTS model / LLM checks (env, GET /v1/models, GET /v1/convai/llm/list, synced-agent drift).
    const modelProblems = await diagnoseModels(db, log)
    log.info('admin.diagnostics', { by: admin.kind, probe })
    return NextResponse.json(
      {
        config: summarizeVoiceConfig(),
        problems: [...validateVoiceConfig(), ...modelProblems],
        // `effective` is what routing sees (forced overrides, open → half-open after the open period).
        circuits: {
          elevenlabs: { effective: elCircuit.state, ...elCircuit.raw },
          elevenlabs_media: { effective: elMedia.state, ...elMedia.raw },
          cartesia: { effective: ctCircuit.state, ...ctCircuit.raw },
          cartesia_media: { effective: ctMedia.state, ...ctMedia.raw },
        },
        platform_resources: Object.fromEntries(Object.entries(resources).map(([k, v]) => [k, !!v])),
        agent_sync: tally(syncRows.data ?? [], 'provider', 'status'),
        webhook_backlog: tally(webhookRows.data ?? [], 'provider', 'status'),
        calls_24h: { by_provider: usage, by_routing_reason: reasons },
        failovers_24h: {
          total: (failovers.data ?? []).length,
          final_failures: (failovers.data ?? []).filter((f) => (f.details as { final?: boolean } | null)?.final).length,
        },
        ...(probe ? { health: await probeProviders(log) } : {}),
        knowledge: await knowledgeDiagnostics(log).catch((err: unknown) => (log.error('admin.diagnostics_knowledge_failed', err), { error: 'unavailable' })),
        voices: await import('@/lib/voice-providers/voice-diagnostics').then((m) => m.voiceDiagnostics(log)).catch((err: unknown) => (log.error('admin.diagnostics_voices_failed', err), { error: 'unavailable' })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.diagnostics_failed', requestId)
  }
}
