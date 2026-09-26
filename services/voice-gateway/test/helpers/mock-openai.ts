import { json, startMockServer, type MockHttpServer } from './net'

// A local stand-in for POST /v1/responses that streams scripted Responses API
// server-sent events. The real `openai` SDK is pointed at it via baseURL, so
// request building, SSE parsing and abort handling are exercised for real.

export type SseEvent = Record<string, unknown> & { type: string }

export interface ScriptedResponse {
  events?: SseEvent[]
  /** Delay before each event (ms). */
  delayMs?: number
  /** Return an HTTP error instead of a stream. */
  status?: number
  errorBody?: unknown
}

export interface RecordedRequest {
  body: Record<string, unknown>
  aborted: boolean
  completed: boolean
}

export interface MockOpenAI {
  server: MockHttpServer
  baseUrl: string
  requests: RecordedRequest[]
  queue: ScriptedResponse[]
  close(): Promise<void>
}

let seq = 0

const usage = (input = 120, cached = 40, output = 25) => ({
  input_tokens: input,
  input_tokens_details: { cached_tokens: cached },
  output_tokens: output,
  output_tokens_details: { reasoning_tokens: 0 },
  total_tokens: input + output,
})

function responseEnvelope(output: unknown[], u = usage()) {
  seq += 1
  return { id: `resp_${seq}`, object: 'response', status: 'completed', output, usage: u, model: 'gpt-5.6-luna', created_at: 1 }
}

function messageItem(text: string) {
  seq += 1
  return { type: 'message', id: `msg_${seq}`, status: 'completed', role: 'assistant', content: [{ type: 'output_text', text, annotations: [] }] }
}

function functionCallItem(name: string, args: Record<string, unknown>, callId: string) {
  seq += 1
  return { type: 'function_call', id: `fc_${seq}`, call_id: callId, name, arguments: JSON.stringify(args), status: 'completed' }
}

/** Text streamed in `pieces` deltas. */
export function textResponse(text: string, options: { pieces?: string[]; delayMs?: number; usage?: ReturnType<typeof usage> } = {}): ScriptedResponse {
  const item = messageItem(text)
  const pieces = options.pieces ?? text.match(/\S+\s*/g) ?? [text]
  return {
    delayMs: options.delayMs ?? 2,
    events: [
      { type: 'response.created', response: { ...responseEnvelope([]), status: 'in_progress' } },
      { type: 'response.output_item.added', output_index: 0, item: { ...item, content: [], status: 'in_progress' } },
      ...pieces.map((delta) => ({ type: 'response.output_text.delta', item_id: item.id, output_index: 0, content_index: 0, delta, logprobs: [] })),
      { type: 'response.output_text.done', item_id: item.id, output_index: 0, content_index: 0, text, logprobs: [] },
      { type: 'response.output_item.done', output_index: 0, item },
      { type: 'response.completed', response: responseEnvelope([item], options.usage) },
    ],
  }
}

/** Optional text followed by one function call. */
export function toolCallResponse(name: string, args: Record<string, unknown>, callId: string, options: { text?: string; usage?: ReturnType<typeof usage> } = {}): ScriptedResponse {
  const output: unknown[] = []
  const events: SseEvent[] = [{ type: 'response.created', response: { ...responseEnvelope([]), status: 'in_progress' } }]
  if (options.text) {
    const item = messageItem(options.text)
    output.push(item)
    events.push({ type: 'response.output_item.added', output_index: 0, item: { ...item, content: [] } })
    for (const delta of options.text.match(/\S+\s*/g) ?? []) {
      events.push({ type: 'response.output_text.delta', item_id: item.id, output_index: 0, content_index: 0, delta, logprobs: [] })
    }
    events.push({ type: 'response.output_item.done', output_index: 0, item })
  }
  const call = functionCallItem(name, args, callId)
  output.push(call)
  events.push({ type: 'response.output_item.added', output_index: output.length - 1, item: { ...call, arguments: '', status: 'in_progress' } })
  events.push({ type: 'response.function_call_arguments.done', item_id: call.id, output_index: output.length - 1, arguments: call.arguments })
  events.push({ type: 'response.output_item.done', output_index: output.length - 1, item: call })
  events.push({ type: 'response.completed', response: responseEnvelope(output, options.usage) })
  return { delayMs: 2, events }
}

export async function startMockOpenAI(): Promise<MockOpenAI> {
  const mock = { requests: [], queue: [] } as unknown as MockOpenAI
  mock.server = await startMockServer({
    http: async (req, res, body) => {
      if (req.method !== 'POST' || !(req.url ?? '').startsWith('/v1/responses')) return json(res, 404, { error: { message: 'not found' } })
      const record: RecordedRequest = { body: JSON.parse(body) as Record<string, unknown>, aborted: false, completed: false }
      mock.requests.push(record)
      const script = mock.queue.shift()
      if (!script) return json(res, 500, { error: { message: 'no scripted response left', type: 'server_error', code: 'server_error' } })
      if (script.status) return json(res, script.status, script.errorBody ?? { error: { message: 'scripted error', type: 'server_error', code: null } })
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
      let closed = false
      res.on('close', () => {
        if (!record.completed) record.aborted = true
        closed = true
      })
      let sequence = 0
      for (const event of script.events ?? []) {
        if (closed) return
        await new Promise((r) => setTimeout(r, script.delayMs ?? 0))
        if (closed) return
        res.write(`event: ${event.type}\ndata: ${JSON.stringify({ ...event, sequence_number: sequence++ })}\n\n`)
      }
      record.completed = true
      res.end()
    },
  })
  mock.baseUrl = `${mock.server.baseUrl}/v1`
  mock.close = () => mock.server.close()
  return mock
}
