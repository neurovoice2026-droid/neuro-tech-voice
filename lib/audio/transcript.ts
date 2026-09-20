// Live transcript for the in-browser test call, as a pure reducer over the
// gateway's browser messages (lib/voice/contracts.ts BrowserServerMessage).
//
// A bubble is "open" while it may still change: interim caller speech, or
// agent text still streaming in. Open bubbles are hidden from screen readers
// and announced once they close, so assistive tech reads each turn once
// instead of every partial update.
//
// Engines send agent text differently:
// - Our own Cartesia pipeline sends one sentence at a time as its audio starts
//   playing, tagged with the agent turn's id. After a barge-in (`clear`) it
//   sends the text the caller really heard for that turn, which replaces the
//   sentences on screen.
// - The ElevenLabs bridge sends a turn's text before its audio (so `clear`
//   finds an open bubble); the Managed Agent sends it once the turn ended, so
//   after a barge-in `clear` comes first and the heard part follows it.

export type TranscriptRole = 'user' | 'agent'

export interface TranscriptBubble {
  id: number
  role: TranscriptRole
  text: string
  open: boolean
  /** The caller talked over the agent before it finished. */
  interrupted: boolean
  /** The gateway's id for the agent turn this bubble shows, when it streams sentences. */
  turn?: number
}

export interface TranscriptState {
  bubbles: TranscriptBubble[]
  nextId: number
  /** A `clear` arrived with no agent text on screen: the agent text that follows it is the interrupted turn. */
  interruptPending: boolean
}

export type TranscriptAction =
  | { type: 'user'; text: string; final: boolean }
  /** `turn`: sentence of that agent turn; with `interrupted`, the text heard of it (replaces it). */
  | { type: 'agent'; text: string; turn?: number; interrupted?: boolean }
  /** Barge-in: the agent's current turn stops where it is. */
  | { type: 'interrupt' }
  /** Closes open bubbles of one role (the agent went quiet) or all of them (the call ended). */
  | { type: 'close'; role?: TranscriptRole }
  | { type: 'reset' }

/** Enough for a 3-minute test call; older bubbles scroll away. */
export const MAX_BUBBLES = 200

export const EMPTY_TRANSCRIPT: TranscriptState = { bubbles: [], nextId: 1, interruptPending: false }

const SENTENCE_END = /[.!?…:;,]$/
const CJK_END = /[。！？、，]$/

/**
 * Joins streamed agent text whether the gateway sends deltas (" I can", " help")
 * or the cumulative text so far ("I can", "I can help"). Sentence-sized chunks
 * without their own leading space get one; CJK text is joined as is.
 */
export function mergeStreamingText(previous: string, next: string): string {
  if (!previous) return next
  if (!next) return previous
  if (next.startsWith(previous)) return next
  if (/^\s/.test(next) || /\s$/.test(previous)) return previous + next
  if (CJK_END.test(previous)) return previous + next
  if (SENTENCE_END.test(previous)) return `${previous} ${next}`
  return previous + next
}

function closeAll(bubbles: TranscriptBubble[], role?: TranscriptRole): TranscriptBubble[] {
  let changed = false
  const out = bubbles.map((b) => {
    if (!b.open || (role && b.role !== role)) return b
    changed = true
    return { ...b, open: false }
  })
  return changed ? out : bubbles
}

function append(state: TranscriptState, bubble: Omit<TranscriptBubble, 'id'>, bubbles: TranscriptBubble[]): TranscriptState {
  const next = [...bubbles, { ...bubble, id: state.nextId }]
  return {
    bubbles: next.length > MAX_BUBBLES ? next.slice(next.length - MAX_BUBBLES) : next,
    nextId: state.nextId + 1,
    interruptPending: false,
  }
}

/** A sentence of a streamed agent turn, or (interrupted) the part of it the caller heard. */
function agentTurnText(state: TranscriptState, text: string, turn: number, interrupted: boolean): TranscriptState {
  const index = state.bubbles.findLastIndex((b) => b.role === 'agent' && b.turn === turn)
  if (interrupted) {
    const heard = text.trim()
    if (index === -1) {
      if (!heard) return state.interruptPending ? { ...state, interruptPending: false } : state
      return append(state, { role: 'agent', text: heard, open: false, interrupted: true, turn }, closeAll(state.bubbles, 'user'))
    }
    const bubbles = state.bubbles.slice()
    // Nothing of it was heard: the sentences on screen never reached the caller.
    if (!heard) bubbles.splice(index, 1)
    else bubbles[index] = { ...bubbles[index], text: heard, open: false, interrupted: true }
    return { ...state, bubbles, interruptPending: false }
  }
  if (!text.trim()) return state
  if (index !== -1) {
    // Later sentences of the same turn (it may have closed while a tool ran).
    const bubbles = state.bubbles.slice()
    const bubble = bubbles[index]
    bubbles[index] = { ...bubble, text: mergeStreamingText(bubble.text, text), open: !bubble.interrupted }
    return { ...state, bubbles, interruptPending: false }
  }
  return append(state, { role: 'agent', text: text.trimStart(), open: true, interrupted: false, turn }, closeAll(state.bubbles, 'user'))
}

/** A whole interrupted turn from an engine that sends text once the turn ended. */
function heardAfterClear(state: TranscriptState, text: string): TranscriptState {
  const heard = text.trim()
  const last = state.bubbles[state.bubbles.length - 1]
  if (last && last.role === 'agent' && last.open && last.turn === undefined) {
    if (!heard) return { ...state, interruptPending: false }
    const bubbles = [...state.bubbles.slice(0, -1), { ...last, text: heard, open: false, interrupted: true }]
    return { ...state, bubbles, interruptPending: false }
  }
  if (!heard) return state.interruptPending ? { ...state, interruptPending: false } : state
  return append(state, { role: 'agent', text: heard, open: false, interrupted: true }, closeAll(state.bubbles, 'user'))
}

export function transcriptReducer(state: TranscriptState, action: TranscriptAction): TranscriptState {
  switch (action.type) {
    case 'user': {
      const last = state.bubbles[state.bubbles.length - 1]
      // Caller speech means the agent's turn is over; a heard part can't follow it any more.
      const bubbles = closeAll(state.bubbles, 'agent')
      const base = state.interruptPending ? { ...state, interruptPending: false } : state
      if (last && last.role === 'user' && last.open) {
        // Interim results are cumulative for the current utterance.
        const updated = { ...last, text: action.text, open: !action.final }
        if (!updated.text.trim()) return { ...base, bubbles: bubbles.slice(0, -1) }
        return { ...base, bubbles: [...bubbles.slice(0, -1), updated] }
      }
      if (!action.text.trim()) return bubbles === state.bubbles && base === state ? state : { ...base, bubbles }
      return append(state, { role: 'user', text: action.text, open: !action.final, interrupted: false }, bubbles)
    }
    case 'agent': {
      if (action.turn !== undefined) return agentTurnText(state, action.text, action.turn, action.interrupted === true)
      if (action.interrupted) return heardAfterClear(state, action.text)
      if (!action.text) return state
      const last = state.bubbles[state.bubbles.length - 1]
      if (!state.interruptPending && last && last.role === 'agent' && last.open) {
        const updated = { ...last, text: mergeStreamingText(last.text, action.text) }
        return { ...state, bubbles: [...state.bubbles.slice(0, -1), updated] }
      }
      // The agent answering closes whatever the caller said before.
      const bubbles = closeAll(state.bubbles, 'user')
      if (!action.text.trim()) return bubbles === state.bubbles ? state : { ...state, bubbles }
      // Text right after a `clear` is the part of the interrupted turn the caller heard: already final.
      const interrupted = state.interruptPending
      return append(state, { role: 'agent', text: action.text.trimStart(), open: !interrupted, interrupted }, bubbles)
    }
    case 'interrupt': {
      const index = state.bubbles.findLastIndex((b) => b.role === 'agent' && b.open)
      if (index === -1) return state.interruptPending ? state : { ...state, interruptPending: true }
      const bubbles = state.bubbles.slice()
      bubbles[index] = { ...bubbles[index], open: false, interrupted: true }
      return { ...state, bubbles, interruptPending: false }
    }
    case 'close': {
      const bubbles = closeAll(state.bubbles, action.role)
      return bubbles === state.bubbles ? state : { ...state, bubbles }
    }
    case 'reset':
      return EMPTY_TRANSCRIPT
  }
}
