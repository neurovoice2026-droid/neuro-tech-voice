import { describe, expect, it } from 'vitest'
import type { Agent } from '@/types'
import { buildAgentUpdate, mergeAgentPatchBodies } from './agent-update'
import { agentPatchSchema } from './schemas'

const CURRENT: Pick<Agent, 'metadata' | 'working_hours' | 'cartesia_voice_id' | 'cartesia_voice_name'> = {
  metadata: { personality: 'Professional', pronunciation_dict_id: 'dict_1', outside_hours: { type: 'message', message: 'Closed', notify_email: '' } },
  working_hours: {
    monday: { start: '09:00', end: '18:00', enabled: true },
    tuesday: { start: '09:00', end: '18:00', enabled: true },
  },
  cartesia_voice_id: 'voice-1',
  cartesia_voice_name: 'Skylar',
}

function plan(body: unknown, verifiedName?: string) {
  return buildAgentUpdate(agentPatchSchema.parse(body), CURRENT, verifiedName)
}

describe('buildAgentUpdate', () => {
  it('copies plain fields and sanitises keyterms', () => {
    const { update, derived } = plan({ name: 'Mara', recording_notice: true, keyterms: ['Zenith', ' zenith ', 'Invisalign'] })
    expect(update).toEqual({ name: 'Mara', recording_notice: true, keyterms: ['Zenith', 'Invisalign'] })
    expect(derived.size).toBe(0)
  })

  it('merges metadata sub-keys into what is stored', () => {
    const behavior = {
      allow_interruptions: false,
      auto_end_call: true,
      auto_end_silence_seconds: 15,
      max_call_duration_enabled: true,
      max_call_duration_minutes: 20,
      record_calls: false,
      voicemail_detection: true,
    }
    const { update } = plan({ metadata: { behavior_settings: behavior } })
    expect(update.metadata).toEqual({ ...CURRENT.metadata, behavior_settings: behavior })
  })

  it('maps the legacy personality onto tone as a derived column', () => {
    const { update, derived } = plan({ metadata: { personality: 'Friendly' } })
    expect(update.tone).toBe('friendly')
    expect((update.metadata as Record<string, unknown>).personality).toBe('friendly')
    expect(derived.has('tone')).toBe(true)

    const explicit = plan({ tone: 'formal', metadata: { personality: 'Friendly' } })
    expect(explicit.update.tone).toBe('formal')
    expect(explicit.derived.has('tone')).toBe(false)
  })

  it('merges working hours per day', () => {
    const { update } = plan({ working_hours: { tuesday: { start: '10:00', end: '14:00', enabled: true } } })
    expect(update.working_hours).toEqual({
      monday: { start: '09:00', end: '18:00', enabled: true },
      tuesday: { start: '10:00', end: '14:00', enabled: true },
    })
  })

  it('takes the voice name from the request, else the verified provider name', () => {
    expect(plan({ cartesia_voice_id: 'voice-2' }, 'Daniel').update).toEqual({ cartesia_voice_id: 'voice-2', cartesia_voice_name: 'Daniel' })
    expect(plan({ cartesia_voice_id: 'voice-2', cartesia_voice_name: 'My Daniel' }, 'Daniel').update.cartesia_voice_name).toBe('My Daniel')
    // Re-sending the current voice without a name keeps the saved name.
    expect(plan({ cartesia_voice_id: 'voice-1' }).update).toEqual({ cartesia_voice_id: 'voice-1', cartesia_voice_name: 'Skylar' })
  })

  it('writes nothing for an empty body', () => {
    expect(plan({}).update).toEqual({})
    expect(plan({ metadata: {} }).update).toEqual({})
  })
})

describe('mergeAgentPatchBodies', () => {
  it('keeps both edits: later fields win, metadata keys and days merge', () => {
    const merged = mergeAgentPatchBodies<{ name?: string; tone?: string; metadata?: Record<string, unknown>; working_hours?: Record<string, unknown> }>(
      {
        name: 'Mara',
        metadata: { behavior_settings: { record_calls: false } },
        working_hours: { monday: { start: '09:00', end: '17:00', enabled: true } },
      },
      {
        name: 'Maria',
        tone: 'friendly',
        metadata: { outside_hours: { type: 'message', message: 'Closed', notify_email: '' } },
        working_hours: { tuesday: { start: '10:00', end: '16:00', enabled: true } },
      }
    )
    expect(merged).toEqual({
      name: 'Maria',
      tone: 'friendly',
      metadata: { behavior_settings: { record_calls: false }, outside_hours: { type: 'message', message: 'Closed', notify_email: '' } },
      working_hours: { monday: { start: '09:00', end: '17:00', enabled: true }, tuesday: { start: '10:00', end: '16:00', enabled: true } },
    })
    expect(mergeAgentPatchBodies<{ metadata?: Record<string, unknown> }>({ metadata: { a: 1 } }, {})).toEqual({ metadata: { a: 1 } })
  })
})
