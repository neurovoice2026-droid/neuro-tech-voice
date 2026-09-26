import type { WebSocket } from 'ws'
import { json, parseMessage, startMockServer, type MockHttpServer } from './net'

// ElevenLabs: signed-URL endpoint + agent conversation socket, the multi-context
// TTS socket and the Scribe realtime STT socket.

export interface ElevenAgentConnection {
  url: URL
  ws: WebSocket
  received: Record<string, unknown>[]
  send(message: Record<string, unknown>): void
}

export interface ElevenTtsConnection {
  url: URL
  apiKeyHeader: string | undefined
  messages: Record<string, unknown>[]
}

export interface ElevenSttConnection {
  url: URL
  ws: WebSocket
  chunks: Record<string, unknown>[]
  send(message: Record<string, unknown>): void
}

export interface MockElevenLabs {
  server: MockHttpServer
  signedUrlRequests: { agentId: string | null; apiKey: string | undefined }[]
  agentConnections: ElevenAgentConnection[]
  onAgentConnect: ((conn: ElevenAgentConnection) => void) | null
  ttsConnections: ElevenTtsConnection[]
  sttConnections: ElevenSttConnection[]
  onSttConnect: ((conn: ElevenSttConnection) => void) | null
  ttsText(): string
  close(): Promise<void>
}

export async function startMockElevenLabs(): Promise<MockElevenLabs> {
  const mock = {
    signedUrlRequests: [],
    agentConnections: [],
    onAgentConnect: null,
    ttsConnections: [],
    sttConnections: [],
    onSttConnect: null,
  } as unknown as MockElevenLabs

  const handleTts = (ws: WebSocket, url: URL, apiKey: string | undefined) => {
    const conn: ElevenTtsConnection = { url, apiKeyHeader: apiKey, messages: [] }
    mock.ttsConnections.push(conn)
    const pcm = url.searchParams.get('output_format') === 'pcm_16000'
    const chains = new Map<string, Promise<void>>()
    const closed = new Set<string>()
    ws.on('message', (data) => {
      const msg = parseMessage(data)
      if (!msg) return
      conn.messages.push(msg)
      const id = String(msg.context_id ?? '')
      const chain = chains.get(id) ?? Promise.resolve()
      if (typeof msg.text === 'string' && msg.text.trim()) {
        const text = msg.text
        chains.set(
          id,
          chain.then(async () => {
            if (closed.has(id) && msg.close_context) return
            const bytes = Math.max(320, text.length * (pcm ? 80 : 40))
            for (let offset = 0; offset < bytes; offset += 400) {
              const size = Math.min(400, bytes - offset)
              if (ws.readyState !== ws.OPEN) return
              ws.send(JSON.stringify({ audio: Buffer.alloc(pcm ? size - (size % 2) : size, 0x33).toString('base64'), contextId: id, isFinal: null }))
              await new Promise((r) => setTimeout(r, 3))
            }
          })
        )
      }
      if (msg.close_context === true) {
        closed.add(id)
        chains.set(
          id,
          (chains.get(id) ?? Promise.resolve()).then(() => {
            if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ isFinal: true, contextId: id }))
          })
        )
      }
    })
  }

  mock.server = await startMockServer({
    http: (req, res) => {
      const url = new URL(req.url ?? '/', 'http://mock.local')
      if (req.method === 'GET' && url.pathname === '/v1/convai/conversation/get-signed-url') {
        const agentId = url.searchParams.get('agent_id')
        mock.signedUrlRequests.push({ agentId, apiKey: req.headers['xi-api-key'] as string | undefined })
        return json(res, 200, { signed_url: `${mock.server.wsBaseUrl}/v1/convai/conversation?agent_id=${agentId}&token=signed-test-token` })
      }
      return json(res, 404, { detail: { status: 'not_found', message: 'not found' } })
    },
    ws: (url) => {
      if (url.pathname === '/v1/convai/conversation') {
        return (ws) => {
          const conn: ElevenAgentConnection = {
            url,
            ws,
            received: [],
            send: (m) => {
              if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m))
            },
          }
          mock.agentConnections.push(conn)
          ws.on('message', (data) => {
            const msg = parseMessage(data)
            if (msg) conn.received.push(msg)
          })
          mock.onAgentConnect?.(conn)
        }
      }
      if (/^\/v1\/text-to-speech\/[^/]+\/multi-stream-input$/.test(url.pathname)) {
        return (ws, req) => handleTts(ws, url, req.headers['xi-api-key'] as string | undefined)
      }
      if (url.pathname === '/v1/speech-to-text/realtime') {
        return (ws) => {
          const conn: ElevenSttConnection = {
            url,
            ws,
            chunks: [],
            send: (m) => {
              if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m))
            },
          }
          mock.sttConnections.push(conn)
          conn.send({ message_type: 'session_started', session_id: 'sess_test', config: {} })
          ws.on('message', (data) => {
            const msg = parseMessage(data)
            if (msg) conn.chunks.push(msg)
          })
          mock.onSttConnect?.(conn)
        }
      }
      return null
    },
  })
  mock.ttsText = () =>
    mock.ttsConnections
      .flatMap((c) => c.messages)
      .map((m) => (typeof m.text === 'string' ? m.text : ''))
      .join('')
  mock.close = () => mock.server.close()
  return mock
}
