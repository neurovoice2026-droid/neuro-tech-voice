import type {
  CallControlRequest,
  FinalizeRequest,
  SessionRequest,
  ToolRequest,
  ToolResponse,
  VoiceEventRequest,
  VoiceSessionConfig,
} from '../../src/contracts'
import { INTERNAL_SIGNATURE_HEADER } from '../../src/contracts'
import { verifyInternalSignature } from '../../src/signing'
import { json, startMockServer, type MockHttpServer } from './net'

// The Next.js app's /api/voice/internal/* routes, as the gateway sees them.
// Every request's x-ntv-signature is verified; a bad one gets 401 and is recorded.

export interface MockApp {
  server: MockHttpServer
  sessions: SessionRequest[]
  tools: ToolRequest[]
  events: VoiceEventRequest[]
  callControls: (CallControlRequest & { at: number })[]
  finalizes: FinalizeRequest[]
  badSignatures: number
  sessionConfig: (req: SessionRequest) => VoiceSessionConfig | { status: number } | Promise<VoiceSessionConfig | { status: number }>
  toolHandler: (req: ToolRequest) => ToolResponse | Promise<ToolResponse>
  callControlHandler: (req: CallControlRequest) => { ok: boolean; error?: string }
  finalizeStatus: () => number
  close(): Promise<void>
}

export async function startMockApp(secret: string): Promise<MockApp> {
  const app = {
    sessions: [],
    tools: [],
    events: [],
    callControls: [],
    finalizes: [],
    badSignatures: 0,
    sessionConfig: () => ({ status: 404 }),
    toolHandler: () => ({ ok: true, result: 'done', action: null }),
    callControlHandler: () => ({ ok: true }),
    finalizeStatus: () => 202,
  } as unknown as MockApp

  app.server = await startMockServer({
    http: async (req, res, body) => {
      const path = (req.url ?? '').split('?')[0]
      if (!path.startsWith('/api/voice/internal/')) return json(res, 404, { error: { code: 'not_found', message: 'nope' } })
      const header = req.headers[INTERNAL_SIGNATURE_HEADER]
      if (!verifyInternalSignature(typeof header === 'string' ? header : null, body, secret)) {
        app.badSignatures += 1
        return json(res, 401, { error: { code: 'bad_signature', message: 'Invalid or expired signature.' } })
      }
      const parsed: unknown = JSON.parse(body)
      switch (path.slice('/api/voice/internal/'.length)) {
        case 'session': {
          const request = parsed as SessionRequest
          app.sessions.push(request)
          const result = await app.sessionConfig(request)
          if ('status' in result) return json(res, result.status, { error: { code: 'error', message: 'no' } })
          return json(res, 200, result)
        }
        case 'tools': {
          const request = parsed as ToolRequest
          app.tools.push(request)
          return json(res, 200, await app.toolHandler(request))
        }
        case 'events':
          app.events.push(parsed as VoiceEventRequest)
          res.writeHead(204).end()
          return
        case 'call-control': {
          const request = parsed as CallControlRequest
          app.callControls.push({ ...request, at: Date.now() })
          return json(res, 200, app.callControlHandler(request))
        }
        case 'finalize': {
          const status = app.finalizeStatus()
          if (status >= 400) return json(res, status, { error: { code: 'temporary', message: 'try again' } })
          app.finalizes.push(parsed as FinalizeRequest)
          return json(res, status, { ok: true })
        }
        default:
          return json(res, 404, { error: { code: 'not_found', message: 'nope' } })
      }
    },
  })
  app.close = () => app.server.close()
  return app
}
