import 'server-only'
// WebRTC conversation tokens for browser test sessions, verified against the
// official OpenAPI spec (2026-10):
//   GET /v1/convai/conversation/token?agent_id*&participant_name&branch_id&version_id&environment&debug_events_request
//     → TokenResponseModel {token*, conversation_id*}
// Every agent has platform_settings.auth.enable_auth on, so a browser can only
// open a session with a token minted here with the platform key.
//
// The token is a bearer credential for ONE conversation: it is never logged,
// never stored and returned to the signed-in owner only (Cache-Control:
// no-store). Each request mints a new conversation, so it is never retried
// (a retry after a lost response would leave an orphaned session).
// debug_events_request is never sent (editor-only debug events).

import { NO_RETRY } from '@/lib/voice-providers/http'
import { ProviderError } from '@/lib/voice-providers/errors'
import { req, T, type Ctx } from '../client'

export interface ELConversationToken {
  token: string
  conversation_id: string
}

/** Agent ids are opaque provider ids: reject anything that could alter the query. */
const AGENT_ID = /^[A-Za-z0-9_-]{1,128}$/
/** participant_name: our opaque, non-identifying label (never an email or a name). */
const PARTICIPANT = /^[A-Za-z0-9_-]{1,64}$/

export async function conversationToken(agentId: string, opts: { participantName?: string | null; ctx?: Ctx } = {}): Promise<ELConversationToken> {
  if (!AGENT_ID.test(agentId)) {
    throw new ProviderError({ system: 'elevenlabs', operation: 'conversation.token', code: 'validation', detail: 'invalid agent id' })
  }
  const participant = opts.participantName && PARTICIPANT.test(opts.participantName) ? opts.participantName : undefined
  const res = await req<Partial<ELConversationToken>>('conversation.token', '/v1/convai/conversation/token', {
    query: { agent_id: agentId, participant_name: participant },
    timeoutMs: T.read,
    retry: NO_RETRY,
    ctx: opts.ctx,
  })
  if (!res || typeof res.token !== 'string' || !res.token) {
    throw new ProviderError({ system: 'elevenlabs', operation: 'conversation.token', code: 'bad_response', detail: 'no token in response' })
  }
  // conversation_id is required by the spec; tolerate its absence (the post-call
  // webhook is then matched by the D classification path instead).
  const conversationId = typeof res.conversation_id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(res.conversation_id) ? res.conversation_id : ''
  return { token: res.token, conversation_id: conversationId }
}
