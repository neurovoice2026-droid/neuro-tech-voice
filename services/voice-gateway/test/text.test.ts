import { describe, expect, it } from 'vitest'
import { conversationSoFar, escapeDynamicVariableSyntax } from '../src/engines/elevenlabs-agent'
import { SentenceChunker } from '../src/text/chunker'
import { FILLER_PHRASES, GOODBYE_SILENCE, RESUME_AFTER_HANDOFF, STILL_THERE, WRAP_UP, localized } from '../src/text/phrases'
import { looksLikeVoicemail } from '../src/text/voicemail'

function chunkAll(deltas: string[]): string[] {
  const chunker = new SentenceChunker()
  const out: string[] = []
  for (const d of deltas) out.push(...chunker.push(d))
  out.push(...chunker.flush())
  return out
}

describe('sentence chunker', () => {
  it('emits whole sentences with their trailing space, verbatim', () => {
    const text = 'Hello there! How can I help you today? We are open until five. '
    const deltas = text.match(/.{1,4}/gs)!
    const pieces = chunkAll(deltas)
    expect(pieces).toEqual(['Hello there! ', 'How can I help you today? ', 'We are open until five. '])
    expect(pieces.join('')).toBe(text)
  })

  it('keeps decimals, times, abbreviations and initials intact', () => {
    const text = 'The price is 3.50 lei. Dr. Popescu sees patients at 10:30 a.m. on Mondays. Ask for J. Smith, e.g. at the desk. '
    const pieces = chunkAll(text.split(''))
    expect(pieces).toEqual(['The price is 3.50 lei. ', 'Dr. Popescu sees patients at 10:30 a.m. on Mondays. ', 'Ask for J. Smith, e.g. at the desk. '])
  })

  it('waits for what follows a period before deciding', () => {
    const chunker = new SentenceChunker()
    expect(chunker.push('It costs 3.')).toEqual([])
    expect(chunker.push('5 euros. Next')).toEqual(['It costs 3.5 euros. '])
    expect(chunker.flush()).toEqual(['Next'])
  })

  it('splits a long first sentence at its first clause so speech starts sooner (PERF-07)', () => {
    const reply = "Thanks for calling Bright Smile Dental, this is Ava, and I'd be happy to help you book, change or cancel an appointment today?"
    const chunker = new SentenceChunker()
    const out: string[] = []
    let firstAt = -1
    const tokens = reply.match(/.{1,4}/gs)!
    tokens.forEach((token, index) => {
      const pieces = chunker.push(token)
      if (pieces.length > 0 && firstAt === -1) firstAt = index + 1
      out.push(...pieces)
    })
    out.push(...chunker.flush())
    // Before: nothing until the '?' (all 32 tokens). Now the first clause after 50 characters goes out early.
    expect(firstAt).toBeGreaterThan(0)
    expect(firstAt).toBeLessThan(tokens.length / 2)
    expect(out[0]).toBe('Thanks for calling Bright Smile Dental, this is Ava, ')
    expect(out.join('')).toBe(reply)
    // Later run-ons in the same output keep the long threshold.
    expect(out.slice(1).every((p) => p.length >= 60 || p === out.at(-1))).toBe(true)
  })

  it('keeps short first sentences whole and numbers like "12, 50" together', () => {
    expect(chunkAll(['Sure, one moment. ', 'We open at nine.'])).toEqual(['Sure, one moment. ', 'We open at nine.'])
    const chunker = new SentenceChunker()
    expect(chunker.push('The consultation fee for a first visit is usually 12, ')).toEqual([])
    expect(chunker.push('50 lei in total. ')).toEqual(['The consultation fee for a first visit is usually 12, 50 lei in total. '])
    // Each flush (a new tool hop) makes the next piece a first piece again.
    const again = new SentenceChunker()
    again.push('Hello. ')
    expect(again.push(`${'word '.repeat(12)}and more, still going on`)).toEqual([])
    again.flush()
    expect(again.push(`${'word '.repeat(12)}and more, still going on`)).toEqual(['word word word word word word word word word word word word and more, '])
  })

  it('splits CJK sentences without spaces and long run-ons at a clause', () => {
    expect(chunkAll(['您好。', '请问有什么可以帮您？'])).toEqual(['您好。', '请问有什么可以帮您？'])
    const runOn = `${'word '.repeat(40)}and then, ${'more '.repeat(20)}`
    const pieces = chunkAll([runOn])
    expect(pieces.length).toBeGreaterThan(1)
    expect(pieces.join('')).toBe(runOn)
  })
})

describe('gateway phrases (shared with the app)', () => {
  it('has every line in English and Romanian', () => {
    for (const map of [STILL_THERE, GOODBYE_SILENCE, WRAP_UP, RESUME_AFTER_HANDOFF]) {
      expect(localized(map, 'en')).toBeTruthy()
      expect(localized(map, 'ro')).toBeTruthy()
      expect(localized(map, 'xx')).toBe(map.en)
    }
    expect(FILLER_PHRASES.ro.length).toBeGreaterThan(0)
  })
})

describe('voicemail heuristic', () => {
  it('recognises greeting-machine wording in several languages and not normal answers', () => {
    expect(looksLikeVoicemail("Hi, you've reached Maria. Please leave a message after the tone.")).toBe(true)
    expect(looksLikeVoicemail('Abonatul apelat nu este disponibil. Vă rugăm să lăsați un mesaj după semnalul sonor.')).toBe(true)
    expect(looksLikeVoicemail('Bonjour, vous êtes sur la messagerie vocale de Paul.')).toBe(true)
    expect(looksLikeVoicemail('Hallo, bitte hinterlassen Sie eine Nachricht nach dem Signalton.')).toBe(true)
    expect(looksLikeVoicemail('Hello?')).toBe(false)
    expect(looksLikeVoicemail('Da, alo, cine este?')).toBe(false)
  })

  it('does not hang up on a person who says someone is not available', () => {
    expect(looksLikeVoicemail("Sorry, she's not available right now, who's calling?")).toBe(false)
    expect(looksLikeVoicemail('Hi, John is not available at the moment, can I take a message?')).toBe(false)
    expect(looksLikeVoicemail('Nu este disponibil acum, cu cine vorbesc?')).toBe(false)
    expect(looksLikeVoicemail("Il n'est pas disponible, c'est de la part de qui ?")).toBe(false)
    expect(looksLikeVoicemail('He can’t come to the phone right now.')).toBe(false)
  })

  it('still recognises carrier and machine announcements that say "not available"', () => {
    expect(looksLikeVoicemail('The person you are calling is not available. Please try again later.')).toBe(true)
    expect(looksLikeVoicemail('The number you have dialed is not available.')).toBe(true)
    expect(looksLikeVoicemail('Numărul apelat nu poate fi contactat. Vă rugăm să reveniți mai târziu.')).toBe(true)
    expect(looksLikeVoicemail('Der Teilnehmer ist zurzeit nicht erreichbar.')).toBe(true)
    expect(looksLikeVoicemail('Il cliente da lei chiamato non è raggiungibile.')).toBe(true)
  })
})

describe('ElevenLabs handoff text', () => {
  it('escapes dynamic-variable braces in customer text', () => {
    expect(escapeDynamicVariableSyntax('Hi {{name}}, price {{ price }}')).toBe('Hi { {name} }, price { { price } }')
    expect(escapeDynamicVariableSyntax('no braces {here}')).toBe('no braces {here}')
  })

  it('summarises the last 20 turns with roles and interruptions', () => {
    const turns = Array.from({ length: 25 }, (_, i) => ({ role: i % 2 ? ('user' as const) : ('agent' as const), message: `line ${i}`, time_in_call_secs: i }))
    turns[24] = { ...turns[24], interrupted: true } as (typeof turns)[number]
    const summary = conversationSoFar(turns)
    expect(summary.split('\n')).toHaveLength(20)
    expect(summary.startsWith('Caller: line 5')).toBe(true)
    expect(summary.endsWith('Agent: line 24 (interrupted)')).toBe(true)
  })
})
