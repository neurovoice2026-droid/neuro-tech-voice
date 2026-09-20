// ─── Media stream server ─────────────────────────────────────────────────────
// The persistent process Telnyx streams call audio to.
//
// DEPLOYMENT: this cannot run on Vercel serverless. A media stream is a
// long-lived WebSocket carrying 50 frames/second for the duration of a call,
// which is the opposite of the request/response model serverless functions
// are billed and timed for. Deploy it separately (Fly.io, Railway, a VM) and
// point TELNYX_STREAM_URL at it. The Next.js app and this process share the
// same database and nothing else.

import { createServer } from 'http'
import { createAdminClient } from '@/lib/supabase/admin'
import { WebSocketServer, type WebSocket } from 'ws'
import { CallSession, type AgentConfig, type SttSource, type TranscriptEntry } from './session'
import { DEFAULT_LLM_MODEL } from './llm'
import { formatBreakdown } from './metrics'
import { retrieveContext } from './retrieval'

interface TelnyxStreamMessage {
  event: 'connected' | 'start' | 'media' | 'stop' | 'error'
  stream_id?: string
  sequence_number?: string
  start?: {
    media_format?: { encoding: string; sample_rate: number; channels: number }
  }
  media?: { track?: string; chunk?: string; timestamp?: string; payload: string }
  [key: string]: unknown
}

/**
 * Per-call context, passed as query params on the stream URL.
 *
 * Telnyx's `start` frame carries no application data of ours, so identifying
 * which agent a stream belongs to has to happen at connection time. The
 * webhook that answers the call already knows the agent (it resolved it from
 * the dialled number) and encodes it into stream_url — see
 * app/api/telnyx/webhook/route.ts.
 */
interface StreamParams {
  agentId: string
  orgId: string
  callControlId: string
  callSessionId: string
  direction: 'inbound' | 'outbound'
  callerNumber: string | null
  phoneNumberId: string | null
}

function parseParams(url: string | undefined): StreamParams | null {
  if (!url) return null
  const q = new URL(url, 'http://localhost').searchParams
  const agentId = q.get('agent')
  const orgId = q.get('org')
  const callControlId = q.get('ccid')
  const callSessionId = q.get('csid')
  if (!agentId || !orgId || !callControlId || !callSessionId) return null
  return {
    agentId,
    orgId,
    callControlId,
    callSessionId,
    direction: q.get('dir') === 'outbound' ? 'outbound' : 'inbound',
    callerNumber: q.get('from'),
    phoneNumberId: q.get('pn'),
  }
}

async function loadAgent(agentId: string): Promise<AgentConfig | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('agents')
    .select('id, org_id, name, system_prompt, first_message, language, voice_id, llm_model, fallback_message')
    .eq('id', agentId)
    .single()

  if (!data) return null

  return {
    id: data.id as string,
    orgId: data.org_id as string,
    name: data.name as string,
    systemPrompt: (data.system_prompt as string) ?? '',
    firstMessage: (data.first_message as string) ?? '',
    language: (data.language as string) ?? 'ro',
    voiceId: (data.voice_id as string) ?? null,
    llmModel: (data.llm_model as string) ?? DEFAULT_LLM_MODEL,
    retrieve: (query) => retrieveContext(data.id as string, query),
  }
}

/**
 * Live sessions, keyed by Telnyx call_control_id.
 *
 * Needed because transcripts and audio arrive on two different transports:
 * audio over the media WebSocket, words over an HTTP webhook relayed from the
 * Next.js app. Both have to reach the same in-memory session.
 */
const sessions = new Map<string, CallSession>()

export function createMediaServer(opts: { port: number }) {
  // Plain HTTP alongside the WebSocket on one port: Telnyx's transcription
  // events are webhooks, not stream frames, so they need somewhere to land.
  const http = createServer((req, res) => {
    if (req.method !== 'POST' || !req.url?.startsWith('/transcription')) {
      res.writeHead(404).end()
      return
    }

    // Shared-secret check. This endpoint drives what the agent says, so it
    // must not be callable by anyone who finds the host.
    const secret = process.env.ORCHESTRATOR_SECRET
    if (secret && req.headers['x-orchestrator-secret'] !== secret) {
      res.writeHead(401).end()
      return
    }

    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      try {
        const { call_control_id, transcript, is_final } = JSON.parse(body) as {
          call_control_id?: string
          transcript?: string
          is_final?: boolean
        }
        const session = call_control_id ? sessions.get(call_control_id) : undefined
        if (session && transcript) {
          session.handleTranscript(transcript, !!is_final)
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}')
      } catch {
        res.writeHead(400).end()
      }
    })
  })

  const wss = new WebSocketServer({ server: http })

  wss.on('connection', (ws: WebSocket, req) => {
    const params = parseParams(req.url)
    if (!params) {
      ws.close(1008, 'missing stream parameters')
      return
    }

    let session: CallSession | null = null
    const transcript: TranscriptEntry[] = []
    let finalised = false

    const send = (msg: Record<string, unknown>) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
    }

    // Persisting is guarded rather than tied to a single event because a
    // dropped call can produce `stop`, a socket close, both, or neither in
    // either order — and a call that bills but leaves no record is worse than
    // one recorded slightly late.
    const finalise = async () => {
      if (finalised || !session) return
      finalised = true
      sessions.delete(params.callControlId)
      session.close()

      const { turns, median, worst } = session.latencyStats
      if (median && worst) {
        console.log(
          `[call ${params.callSessionId}] ${turns} turns | median ${formatBreakdown(median)} | worst ${worst.totalMs}ms`
        )
      }

      await persistCall(params, session, transcript)
    }

    ws.on('message', async (raw: Buffer) => {
      let msg: TelnyxStreamMessage
      try {
        msg = JSON.parse(raw.toString()) as TelnyxStreamMessage
      } catch {
        return
      }

      switch (msg.event) {
        case 'connected':
          break

        case 'start': {
          const agent = await loadAgent(params.agentId)
          if (!agent) {
            ws.close(1011, 'agent not found')
            return
          }
          session = new CallSession(
            agent,
            {
              send,
              onTranscript: (e) => transcript.push(e),
              onError: (err) => console.error(`[call ${params.callSessionId}]`, err.message),
            },
            (process.env.STT_SOURCE as SttSource) ?? 'telnyx'
          )
          // Take the carrier's word for the format rather than assuming PCMU;
          // the outbound codec is whatever we asked Telnyx for when answering.
          session.setMediaFormat(
            msg.start?.media_format?.encoding,
            process.env.TELNYX_STREAM_CODEC ?? 'PCMU'
          )
          sessions.set(params.callControlId, session)
          await session.greet()
          break
        }

        case 'media':
          if (msg.media?.payload) session?.handleMedia(msg.media.payload)
          break

        case 'stop':
          await finalise()
          break
      }
    })

    ws.on('close', () => { void finalise() })
    ws.on('error', (err) => {
      console.error(`[call ${params.callSessionId}] socket error:`, err.message)
      void finalise()
    })
  })

  http.listen(opts.port)
  console.log(`Media stream server listening on :${opts.port} (ws + /transcription)`)
  return wss
}

/**
 * Write the finished call to the database.
 *
 * Upsert on telnyx_call_session_id rather than insert: the hangup webhook
 * (app/api/telnyx/webhook) may create the row first with call metadata this
 * process does not have, and this process holds the transcript that webhook
 * does not have. Whichever arrives first creates; the second fills in.
 */
async function persistCall(
  params: StreamParams,
  session: CallSession,
  transcript: TranscriptEntry[]
) {
  const supabase = createAdminClient()
  const duration = session.durationSeconds

  const { error } = await supabase.from('calls').upsert(
    {
      org_id: params.orgId,
      agent_id: params.agentId,
      phone_number_id: params.phoneNumberId,
      telnyx_call_control_id: params.callControlId,
      telnyx_call_session_id: params.callSessionId,
      caller_number: params.callerNumber,
      direction: params.direction,
      duration_seconds: duration,
      status: 'completed',
      transcript,
      cost_usd: Number(session.costUsd.toFixed(6)),
      ended_at: new Date().toISOString(),
    },
    { onConflict: 'telnyx_call_session_id', ignoreDuplicates: false }
  )

  if (error) {
    console.error(`[call ${params.callSessionId}] failed to persist:`, error.message)
    return
  }

  // Minutes are billed rounded up — a 10-second call still consumes a minute
  // of the plan allowance, matching how the plans are described to customers.
  const minutes = Math.max(1, Math.ceil(duration / 60))
  await supabase.rpc('increment_minutes_used', {
    p_org_id: params.orgId,
    p_minutes: minutes,
  })
}
