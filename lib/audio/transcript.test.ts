import { describe, expect, it } from 'vitest'
import { EMPTY_TRANSCRIPT, MAX_BUBBLES, mergeStreamingText, transcriptReducer, type TranscriptAction, type TranscriptState } from './transcript'

function run(actions: TranscriptAction[], start: TranscriptState = EMPTY_TRANSCRIPT): TranscriptState {
  return actions.reduce(transcriptReducer, start)
}

function view(state: TranscriptState) {
  return state.bubbles.map((b) => ({ role: b.role, text: b.text, open: b.open, interrupted: b.interrupted }))
}

describe('mergeStreamingText', () => {
  it('handles deltas and cumulative updates', () => {
    expect(mergeStreamingText('', 'Hello')).toBe('Hello')
    expect(mergeStreamingText('Hello', ' there')).toBe('Hello there')
    expect(mergeStreamingText('I can', 'I can help')).toBe('I can help')
    expect(mergeStreamingText('Ha', ' ha')).toBe('Ha ha')
    expect(mergeStreamingText('Hello.', 'How can I help?')).toBe('Hello. How can I help?')
    expect(mergeStreamingText('こんにちは。', 'ご用件は？')).toBe('こんにちは。ご用件は？')
    expect(mergeStreamingText('Hel', 'lo')).toBe('Hello')
  })
})

describe('transcriptReducer', () => {
  it('updates interim caller speech in place and closes it when final', () => {
    const state = run([
      { type: 'user', text: 'I would', final: false },
      { type: 'user', text: 'I would like to book', final: false },
      { type: 'user', text: 'I would like to book a table.', final: true },
    ])
    expect(view(state)).toEqual([{ role: 'user', text: 'I would like to book a table.', open: false, interrupted: false }])
  })

  it('streams agent text into one bubble until the caller speaks', () => {
    const state = run([
      { type: 'agent', text: 'Hello!' },
      { type: 'agent', text: ' How can I help?' },
      { type: 'user', text: 'Book', final: false },
    ])
    expect(view(state)).toEqual([
      { role: 'agent', text: 'Hello! How can I help?', open: false, interrupted: false },
      { role: 'user', text: 'Book', open: true, interrupted: false },
    ])
  })

  it('marks the agent turn interrupted on barge-in and starts a new bubble after', () => {
    const state = run([
      { type: 'agent', text: 'Our opening hours are' },
      { type: 'interrupt' },
      { type: 'agent', text: 'Sure.' },
    ])
    expect(view(state)).toEqual([
      { role: 'agent', text: 'Our opening hours are', open: false, interrupted: true },
      { role: 'agent', text: 'Sure.', open: true, interrupted: false },
    ])
  })

  it('marks the heard part interrupted when it arrives after the clear (Cartesia pipeline order)', () => {
    const state = run([
      { type: 'user', text: 'What are your hours?', final: true },
      { type: 'interrupt' },
      { type: 'agent', text: 'We open at nine and' },
      { type: 'user', text: 'Sorry, on Sunday?', final: false },
      { type: 'agent', text: 'On Sunday we are closed.' },
    ])
    expect(view(state)).toEqual([
      { role: 'user', text: 'What are your hours?', open: false, interrupted: false },
      { role: 'agent', text: 'We open at nine and', open: false, interrupted: true },
      { role: 'user', text: 'Sorry, on Sunday?', open: false, interrupted: false },
      { role: 'agent', text: 'On Sunday we are closed.', open: true, interrupted: false },
    ])
    expect(state.interruptPending).toBe(false)
  })

  it('forgets a clear when nothing was heard before the caller spoke', () => {
    const state = run([
      { type: 'interrupt' },
      { type: 'user', text: 'Hello?', final: true },
      { type: 'agent', text: 'Hi, how can I help?' },
    ])
    expect(view(state)).toEqual([
      { role: 'user', text: 'Hello?', open: false, interrupted: false },
      { role: 'agent', text: 'Hi, how can I help?', open: true, interrupted: false },
    ])
  })

  it('keeps the heard part apart from the agent turn that finished before it', () => {
    const state = run([
      { type: 'agent', text: 'Welcome to Acme.' },
      { type: 'close', role: 'agent' },
      { type: 'interrupt' },
      { type: 'agent', text: 'Our prices start' },
    ])
    expect(view(state)).toEqual([
      { role: 'agent', text: 'Welcome to Acme.', open: false, interrupted: false },
      { role: 'agent', text: 'Our prices start', open: false, interrupted: true },
    ])
  })

  it('builds one bubble per streamed agent turn from its sentences (cartesia_self)', () => {
    const state = run([
      { type: 'agent', text: 'Hello, thanks for calling.', turn: 1 },
      { type: 'user', text: 'Hi, are you open', final: false },
      { type: 'user', text: 'Hi, are you open on Sunday?', final: true },
      { type: 'agent', text: 'Let me check.', turn: 2 },
      // A tool ran long enough for the idle close; the turn's next sentence joins the same bubble.
      { type: 'close', role: 'agent' },
      { type: 'agent', text: 'We are closed on Sundays.', turn: 2 },
    ])
    expect(state.bubbles.map((b) => ({ role: b.role, text: b.text, open: b.open, turn: b.turn }))).toEqual([
      { role: 'agent', text: 'Hello, thanks for calling.', open: false, turn: 1 },
      { role: 'user', text: 'Hi, are you open on Sunday?', open: false, turn: undefined },
      { role: 'agent', text: 'Let me check. We are closed on Sundays.', open: true, turn: 2 },
    ])
  })

  it('replaces a streamed turn with the part the caller heard after a barge-in', () => {
    const state = run([
      { type: 'user', text: 'What do you offer?', final: true },
      { type: 'agent', text: 'We offer cleanings and whitening.', turn: 4 },
      { type: 'agent', text: 'We also do fillings and crowns.', turn: 4 },
      { type: 'interrupt' },
      { type: 'agent', text: 'We offer cleanings and whitening. We also do', turn: 4, interrupted: true },
      { type: 'user', text: 'How much is a cleaning?', final: true },
      { type: 'agent', text: 'A cleaning is 200 lei.', turn: 5 },
    ])
    expect(view(state)).toEqual([
      { role: 'user', text: 'What do you offer?', open: false, interrupted: false },
      { role: 'agent', text: 'We offer cleanings and whitening. We also do', open: false, interrupted: true },
      { role: 'user', text: 'How much is a cleaning?', open: false, interrupted: false },
      // Not taken for the interrupted part: the turn id says it's a new turn.
      { role: 'agent', text: 'A cleaning is 200 lei.', open: true, interrupted: false },
    ])
    expect(state.interruptPending).toBe(false)
  })

  it('removes a streamed turn the caller heard none of, and ignores late sentences of it', () => {
    const cut = run([
      { type: 'agent', text: 'Our prices start at', turn: 7 },
      { type: 'interrupt' },
      { type: 'agent', text: '', turn: 7, interrupted: true },
    ])
    expect(cut.bubbles).toHaveLength(0)
    expect(cut.interruptPending).toBe(false)
    // A heard part whose sentences never reached the screen still shows, already closed.
    const unseen = run([{ type: 'interrupt' }, { type: 'agent', text: 'Sure, one', turn: 8, interrupted: true }])
    expect(view(unseen)).toEqual([{ role: 'agent', text: 'Sure, one', open: false, interrupted: true }])
  })

  it('marks a whole interrupted turn from an engine without turn ids', () => {
    const managed = run([{ type: 'interrupt' }, { type: 'agent', text: 'We open at nine and', interrupted: true }])
    expect(view(managed)).toEqual([{ role: 'agent', text: 'We open at nine and', open: false, interrupted: true }])
    const bridged = run([{ type: 'agent', text: 'Our opening hours are nine to five.' }, { type: 'agent', text: 'Our opening hours are', interrupted: true }])
    expect(view(bridged)).toEqual([{ role: 'agent', text: 'Our opening hours are', open: false, interrupted: true }])
  })

  it('ignores empty text and drops an interim bubble that became empty', () => {
    expect(run([{ type: 'user', text: '  ', final: true }]).bubbles).toHaveLength(0)
    expect(run([{ type: 'agent', text: '' }]).bubbles).toHaveLength(0)
    expect(run([{ type: 'user', text: 'uh', final: false }, { type: 'user', text: '', final: true }]).bubbles).toHaveLength(0)
  })

  it('keeps consecutive final caller segments as separate bubbles', () => {
    const state = run([
      { type: 'user', text: 'Hi.', final: true },
      { type: 'user', text: 'Are you open?', final: true },
    ])
    expect(state.bubbles.map((b) => b.text)).toEqual(['Hi.', 'Are you open?'])
  })

  it('close can target the agent only', () => {
    const state = run([
      { type: 'agent', text: 'Hello' },
      { type: 'user', text: 'Hi', final: false },
    ])
    const reopened = transcriptReducer(state, { type: 'agent', text: 'One moment' })
    const closed = transcriptReducer({ ...reopened, bubbles: [...reopened.bubbles, { id: 99, role: 'user', text: 'wait', open: true, interrupted: false }] }, { type: 'close', role: 'agent' })
    expect(closed.bubbles.map((b) => [b.role, b.open])).toEqual([['agent', false], ['user', false], ['agent', false], ['user', true]])
  })

  it('close finishes every open bubble, reset empties', () => {
    const open = run([{ type: 'agent', text: 'Hello' }])
    const closed = transcriptReducer(open, { type: 'close' })
    expect(closed.bubbles.every((b) => !b.open)).toBe(true)
    expect(transcriptReducer(closed, { type: 'close' })).toBe(closed)
    expect(transcriptReducer(closed, { type: 'reset' })).toEqual(EMPTY_TRANSCRIPT)
  })

  it('caps the history and keeps ids unique', () => {
    const actions: TranscriptAction[] = []
    for (let i = 0; i < MAX_BUBBLES + 10; i++) actions.push({ type: 'user', text: `line ${i}`, final: true })
    const state = run(actions)
    expect(state.bubbles).toHaveLength(MAX_BUBBLES)
    expect(state.bubbles[state.bubbles.length - 1].text).toBe(`line ${MAX_BUBBLES + 9}`)
    expect(new Set(state.bubbles.map((b) => b.id)).size).toBe(MAX_BUBBLES)
  })
})
