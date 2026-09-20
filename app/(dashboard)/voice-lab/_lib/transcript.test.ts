import { describe, expect, it } from 'vitest'
import { baseFileName, buildCues, clockLabel, joinWords, srtTimestamp, toPlainText, toSrt, type TranscriptWord } from './transcript'

function words(list: [string, number, number][]): TranscriptWord[] {
  return list.map(([word, start, end]) => ({ word, start, end }))
}

describe('srtTimestamp / clockLabel', () => {
  it('formats SRT timestamps', () => {
    expect(srtTimestamp(0)).toBe('00:00:00,000')
    expect(srtTimestamp(61.25)).toBe('00:01:01,250')
    expect(srtTimestamp(3661.5)).toBe('01:01:01,500')
    expect(srtTimestamp(-1)).toBe('00:00:00,000')
    expect(srtTimestamp(NaN)).toBe('00:00:00,000')
  })

  it('formats clock labels', () => {
    expect(clockLabel(5)).toBe('0:05')
    expect(clockLabel(75.9)).toBe('1:15')
    expect(clockLabel(3725)).toBe('1:02:05')
  })
})

describe('buildCues', () => {
  it('splits after sentence ends and long pauses', () => {
    const cues = buildCues(
      words([
        ['Hello', 0, 0.4],
        ['there.', 0.5, 0.9],
        ['How', 1.0, 1.2],
        ['are', 1.25, 1.4],
        ['you', 3.0, 3.3],
      ])
    )
    expect(cues.map((c) => c.text)).toEqual(['Hello there.', 'How are', 'you'])
    expect(cues[0]).toMatchObject({ index: 1, start: 0, end: 0.9 })
    expect(cues[2]).toMatchObject({ index: 3, start: 3.0, end: 3.3 })
  })

  it('caps cue length by words and duration', () => {
    const many = words(Array.from({ length: 30 }, (_, i) => [`w${i}`, i * 0.3, i * 0.3 + 0.2] as [string, number, number]))
    const cues = buildCues(many)
    expect(cues.every((c) => c.text.split(' ').length <= 12)).toBe(true)
    expect(cues.every((c) => c.end - c.start <= 7)).toBe(true)
    expect(cues.map((c) => c.text).join(' ').split(' ')).toHaveLength(30)
  })

  it('ignores empty or broken words', () => {
    const cues = buildCues([
      { word: ' ', start: 0, end: 1 },
      { word: 'ok', start: NaN, end: 1 },
      { word: 'fine', start: 1, end: 1.2 },
    ])
    expect(cues.map((c) => c.text)).toEqual(['fine'])
  })

  it('joins Japanese and Chinese without spaces', () => {
    expect(joinWords(['こんにちは', '世界'], 'ja')).toBe('こんにちは世界')
    expect(joinWords(['Bună', 'ziua'], 'ro')).toBe('Bună ziua')
  })
})

describe('exports', () => {
  const sample = words([
    ['Good', 0, 0.3],
    ['morning.', 0.35, 0.8],
    ['Welcome', 1.0, 1.5],
  ])

  it('builds a valid SRT document', () => {
    expect(toSrt(sample)).toBe('1\n00:00:00,000 --> 00:00:00,800\nGood morning.\n\n2\n00:00:01,000 --> 00:00:01,500\nWelcome\n')
    expect(toSrt([])).toBe('')
  })

  it('builds plain text with one line per cue, or the raw text without words', () => {
    expect(toPlainText('Good morning. Welcome', sample)).toBe('Good morning.\nWelcome\n')
    expect(toPlainText('  Just text  ', [])).toBe('Just text\n')
  })

  it('derives safe download names', () => {
    expect(baseFileName('Interview #2.mp3')).toBe('Interview 2')
    expect(baseFileName('../../etc/passwd')).toBe('etcpasswd')
    expect(baseFileName(null)).toBe('transcript')
  })
})
