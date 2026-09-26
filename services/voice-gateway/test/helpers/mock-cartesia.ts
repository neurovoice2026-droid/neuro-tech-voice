import type { WebSocket } from 'ws'
import { parseMessage, startMockServer, type MockHttpServer } from './net'

// Cartesia TTS / STT / Agents WebSockets, replaying the message shapes recorded
// live in scratchpad/live (07-tts-ws, 08-stt-turns-ws, 09-stt-manual-ws):
// chunk {status_code 206, flush_id}, timestamps {word_timestamps}, flush_done
// twice per boundary, done {status_code 200}; errors per context keep the socket.

export interface TtsContextState {
  id: string
  transcripts: string[]
  cancelled: boolean
  ended: boolean
  bytesSent: number
  chain: Promise<void>
  outputFormat: { encoding?: string; sample_rate?: number }
}

export interface SttConnection {
  url: URL
  ws: WebSocket
  frames: Buffer[]
  texts: string[]
  send(message: Record<string, unknown>): void
}

export interface AgentConnection {
  url: URL
  apiKeyHeader: string | undefined
  ws: WebSocket
  received: Record<string, unknown>[]
  send(message: Record<string, unknown>): void
}

export interface MockCartesia {
  server: MockHttpServer
  ttsMessages: Record<string, unknown>[]
  ttsContexts: Map<string, TtsContextState>
  ttsConnections: number
  /** Return true to take over a TTS message (e.g. send an error instead of audio). */
  ttsOverride: ((msg: Record<string, unknown>, ctx: TtsContextState, send: (m: Record<string, unknown>) => void, ws: WebSocket) => boolean) | null
  ttsBytesPerChar: number
  ttsChunkDelayMs: number
  sttConnections: SttConnection[]
  onSttConnect: ((conn: SttConnection) => void) | null
  /** Manual endpoint: reply to `finalize` with this text (default ''). */
  manualFinalizeText: string
  agentConnections: AgentConnection[]
  onAgentConnect: ((conn: AgentConnection) => void) | null
  spokenText(): string
  close(): Promise<void>
}

const CHUNK_BYTES = 400

export async function startMockCartesia(): Promise<MockCartesia> {
  const mock = {
    ttsMessages: [],
    ttsContexts: new Map(),
    ttsConnections: 0,
    ttsOverride: null,
    ttsBytesPerChar: 40,
    ttsChunkDelayMs: 5,
    sttConnections: [],
    onSttConnect: null,
    manualFinalizeText: '',
    agentConnections: [],
    onAgentConnect: null,
  } as unknown as MockCartesia

  const handleTts = (ws: WebSocket) => {
    mock.ttsConnections += 1
    const send = (m: Record<string, unknown>) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m))
    }
    ws.on('message', (data) => {
      const msg = parseMessage(data)
      if (!msg) return
      mock.ttsMessages.push(msg)
      const id = String(msg.context_id ?? '')
      if (msg.cancel === true) {
        const ctx = mock.ttsContexts.get(id)
        if (!ctx || ctx.ended) {
          send({ type: 'error', context_id: id, done: true, error_code: null, status_code: 400, title: 'Invalid context ID', message: 'The requested context ID does not exist or may have already been cancelled.' })
          return
        }
        ctx.cancelled = true
        return
      }
      let ctx = mock.ttsContexts.get(id)
      if (!ctx) {
        ctx = { id, transcripts: [], cancelled: false, ended: false, bytesSent: 0, chain: Promise.resolve(), outputFormat: (msg.output_format ?? {}) as TtsContextState['outputFormat'] }
        mock.ttsContexts.set(id, ctx)
      }
      const state = ctx
      if (mock.ttsOverride?.(msg, state, send, ws)) return
      const transcript = typeof msg.transcript === 'string' ? msg.transcript : ''
      if (transcript) {
        state.transcripts.push(transcript)
        state.chain = state.chain.then(async () => {
          const bytesPerSecond = state.outputFormat.encoding === 'pcm_s16le' ? 32000 : 8000
          const total = Math.max(CHUNK_BYTES, transcript.length * mock.ttsBytesPerChar)
          const words = transcript.trim().split(/\s+/).filter(Boolean)
          const perWord = total / Math.max(1, words.length)
          let wordIndex = 0
          for (let offset = 0; offset < total; offset += CHUNK_BYTES) {
            if (state.cancelled) return
            const size = Math.min(CHUNK_BYTES, total - offset)
            const audio = Buffer.alloc(state.outputFormat.encoding === 'pcm_s16le' ? size - (size % 2) : size, 0x55)
            send({ type: 'chunk', context_id: id, status_code: 206, done: false, data: audio.toString('base64'), step_time: 1, flush_id: 0 })
            const before = state.bytesSent
            state.bytesSent += audio.length
            const ended: string[] = []
            const starts: number[] = []
            const ends: number[] = []
            while (wordIndex < words.length && (wordIndex + 1) * perWord <= offset + size) {
              ended.push(words[wordIndex])
              starts.push((before + wordIndex * 0) / bytesPerSecond)
              ends.push(((wordIndex + 1) * perWord) / bytesPerSecond)
              wordIndex++
            }
            if (ended.length) {
              send({ type: 'timestamps', context_id: id, status_code: 206, done: false, word_timestamps: { words: ended, start: starts, end: ends } })
            }
            await new Promise((r) => setTimeout(r, mock.ttsChunkDelayMs))
          }
        })
      }
      if (msg.continue === false) {
        state.chain = state.chain.then(() => {
          if (state.cancelled) return
          state.ended = true
          send({ type: 'flush_done', context_id: id, status_code: 206, done: false, data: '', step_time: 0, flush_id: 0, flush_done: true })
          send({ type: 'flush_done', context_id: id, status_code: 206, done: false, data: '', step_time: 0, flush_id: 1, flush_done: true })
          send({ type: 'done', context_id: id, status_code: 200, done: true })
        })
      }
    })
  }

  const handleStt = (ws: WebSocket, url: URL, manual: boolean) => {
    const conn: SttConnection = {
      url,
      ws,
      frames: [],
      texts: [],
      send: (m) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m))
      },
    }
    mock.sttConnections.push(conn)
    if (!manual) conn.send({ type: 'connected', request_id: 'req-test' })
    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        conn.frames.push(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer))
        return
      }
      const text = data.toString()
      conn.texts.push(text)
      if (!manual && text.includes('"close"')) setTimeout(() => ws.close(1000, 'Close message'), 20)
      if (manual && text === 'finalize') {
        const final = mock.manualFinalizeText
        setTimeout(() => {
          if (final) conn.send({ type: 'transcript', is_final: true, text: final, duration: 1.2, language: 'ro', words: [], request_id: 'req-test' })
          conn.send({ type: 'transcript', is_final: true, text: '', duration: 0.5, language: 'ro', request_id: 'req-test' })
          conn.send({ type: 'flush_done', is_final: false, request_id: 'req-test' })
        }, 30)
      }
      if (manual && text === 'close') {
        conn.send({ type: 'transcript', is_final: true, text: '', duration: 0.5, language: 'ro', request_id: 'req-test' })
        conn.send({ type: 'done', is_final: false, request_id: 'req-test' })
        setTimeout(() => ws.close(1000, 'Close message'), 10)
      }
    })
    mock.onSttConnect?.(conn)
  }

  const handleAgent = (ws: WebSocket, url: URL, apiKey: string | undefined) => {
    const conn: AgentConnection = {
      url,
      apiKeyHeader: apiKey,
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

  mock.server = await startMockServer({
    ws: (url) => {
      if (url.pathname === '/tts/websocket') return (ws) => handleTts(ws)
      if (url.pathname === '/stt/turns/websocket') return (ws) => handleStt(ws, url, false)
      if (url.pathname === '/stt/websocket') return (ws) => handleStt(ws, url, true)
      if (url.pathname.startsWith('/v1/agents/websocket/')) return (ws, req) => handleAgent(ws, url, req.headers['x-api-key'] as string | undefined)
      return null
    },
  })
  mock.spokenText = () =>
    [...mock.ttsContexts.values()]
      .map((c) => c.transcripts.join(''))
      .join(' | ')
  mock.close = () => mock.server.close()
  return mock
}
