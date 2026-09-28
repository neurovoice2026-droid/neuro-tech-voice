import { Agent, fetch as undiciFetch } from 'undici'

// Outbound HTTPS from the gateway: OpenAI Responses requests and the signed
// calls to the app. Node's built-in fetch closes an idle keep-alive socket
// after 4 s when the server sends no Keep-Alive hint, and a caller's turns
// are usually further apart than that (the reply plays, the caller answers,
// turn detection waits), so every turn would pay a fresh TCP + TLS handshake
// before the first token. One shared pool keeps those connections warm.
//
// 30 s stays well inside the idle timeouts of api.openai.com and Vercel; a
// socket the server closed anyway fails before any output, and the LLM loop
// retries that once while nothing has been spoken.

export const KEEP_ALIVE_MS = 30_000

const agent = new Agent({
  keepAliveTimeout: KEEP_ALIVE_MS,
  keepAliveMaxTimeout: 5 * 60_000,
  connections: 64,
})

/** fetch with the gateway's keep-alive pool; same signature as the global fetch. */
export const keepAliveFetch: typeof fetch = (input, init) =>
  undiciFetch(input as Parameters<typeof undiciFetch>[0], {
    ...(init as Parameters<typeof undiciFetch>[1]),
    dispatcher: agent,
  }) as unknown as Promise<Response>
