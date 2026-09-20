import { describe, expect, it } from 'vitest'
import type { VoiceToolName } from '@/lib/voice/contracts'
import {
  CARTESIA_TOOL_PREFIX,
  TOOL_DEFINITIONS,
  VOICE_TOOL_NAMES,
  fromCartesiaToolName,
  toCartesiaClientTool,
  toOpenAITools,
  toolsFor,
  type ToolCapabilities,
} from './definitions'

const NO_CAPS: ToolCapabilities = { calendar: false, knowledge: false, sms: false, transfer: false, take_message: false, waitlist: false, lead_fields: false }
const ALL_CAPS: ToolCapabilities = { calendar: true, knowledge: true, sms: true, transfer: true, take_message: true, waitlist: true, lead_fields: true }

// Contract §4 parameter list: name → [type, enum?]
const EXPECTED: Record<VoiceToolName, Record<string, [unknown, string[]?]>> = {
  get_call_context: {},
  search_knowledge: { query: ['string'] },
  check_availability: {
    date_from: ['string'],
    date_to: [['string', 'null']],
    service: [['string', 'null']],
    time_of_day: ['string', ['any', 'morning', 'afternoon', 'evening']],
  },
  book_appointment: {
    start: ['string'],
    caller_name: ['string'],
    service: [['string', 'null']],
    notes: [['string', 'null']],
    send_sms_confirmation: ['boolean'],
  },
  find_booking: {},
  reschedule_appointment: { booking_id: ['string'], new_start: ['string'] },
  cancel_appointment: { booking_id: ['string'] },
  add_to_waitlist: { caller_name: [['string', 'null']], service: [['string', 'null']], preferred_times: [['string', 'null']] },
  send_sms: { message: ['string'] },
  take_message: {
    recipient: [['string', 'null']],
    caller_name: [['string', 'null']],
    callback_number: [['string', 'null']],
    message: ['string'],
    urgency: ['string', ['normal', 'urgent']],
  },
  notify_team: { summary: ['string'], urgency: ['string', ['normal', 'urgent']] },
  transfer_call: { reason: ['string'], contact: [['string', 'null']] },
  save_lead_details: {
    name: [['string', 'null']],
    email: [['string', 'null']],
    need: [['string', 'null']],
    budget: [['string', 'null']],
    timing: [['string', 'null']],
    notes: [['string', 'null']],
  },
  end_call: { reason: ['string'] },
}

describe('TOOL_DEFINITIONS', () => {
  it('defines exactly the contract tools, keyed by name', () => {
    expect(Object.keys(TOOL_DEFINITIONS).sort()).toEqual(Object.keys(EXPECTED).sort())
    for (const [key, def] of Object.entries(TOOL_DEFINITIONS)) expect(def.name).toBe(key)
  })

  it.each(Object.keys(EXPECTED) as VoiceToolName[])('%s has the contract parameters', (name) => {
    const { properties } = TOOL_DEFINITIONS[name].parameters
    expect(Object.keys(properties).sort()).toEqual(Object.keys(EXPECTED[name]).sort())
    for (const [prop, [type, enumValues]] of Object.entries(EXPECTED[name])) {
      expect(properties[prop].type, `${name}.${prop}`).toEqual(type)
      expect(properties[prop].enum, `${name}.${prop}`).toEqual(enumValues)
    }
  })

  it.each(Object.keys(EXPECTED) as VoiceToolName[])('%s is a strict schema', (name) => {
    const { parameters, description } = TOOL_DEFINITIONS[name]
    expect(parameters.type).toBe('object')
    expect(parameters.additionalProperties).toBe(false)
    expect([...parameters.required].sort()).toEqual(Object.keys(parameters.properties).sort())
    for (const prop of Object.values(parameters.properties)) {
      if (Array.isArray(prop.type)) expect(prop.type[1]).toBe('null')
      if (prop.enum) expect(prop.type).toBe('string')
      expect(prop.description?.length ?? 0).toBeGreaterThan(0)
      expect(prop.description!.length).toBeLessThanOrEqual(1000)
    }
    expect(description.length).toBeGreaterThan(60)
    expect(description.length).toBeLessThanOrEqual(2000)
  })

  it('marks tools that act outside the call as side-effecting', () => {
    const effects = VOICE_TOOL_NAMES.filter((n) => TOOL_DEFINITIONS[n].side_effects)
    expect(effects.sort()).toEqual(
      ['book_appointment', 'reschedule_appointment', 'cancel_appointment', 'add_to_waitlist', 'send_sms', 'take_message', 'notify_team', 'transfer_call', 'save_lead_details'].sort()
    )
  })

  it('tells the model to get confirmation before booking, changing or cancelling', () => {
    for (const name of ['book_appointment', 'reschedule_appointment', 'cancel_appointment'] as const) {
      expect(TOOL_DEFINITIONS[name].description).toMatch(/only after/i)
    }
  })
})

describe('toolsFor', () => {
  it('always includes get_call_context, and end_call only for the self-run pipeline', () => {
    expect(toolsFor(NO_CAPS, 'cartesia_self').map((t) => t.name)).toEqual(['get_call_context', 'end_call'])
    expect(toolsFor(NO_CAPS, 'cartesia_managed').map((t) => t.name)).toEqual(['get_call_context'])
    expect(toolsFor(NO_CAPS, 'elevenlabs').map((t) => t.name)).toEqual(['get_call_context'])
  })

  it('maps each capability to its tools', () => {
    const only = (caps: Partial<ToolCapabilities>) => toolsFor({ ...NO_CAPS, ...caps }, 'cartesia_managed').map((t) => t.name).slice(1)
    expect(only({ knowledge: true })).toEqual(['search_knowledge'])
    expect(only({ calendar: true })).toEqual(['check_availability', 'book_appointment', 'find_booking', 'reschedule_appointment', 'cancel_appointment'])
    expect(only({ waitlist: true })).toEqual(['add_to_waitlist'])
    expect(only({ sms: true })).toEqual(['send_sms'])
    expect(only({ take_message: true })).toEqual(['take_message', 'notify_team'])
    expect(only({ transfer: true })).toEqual(['transfer_call'])
    expect(only({ lead_fields: true })).toEqual(['save_lead_details'])
  })

  it('returns every tool in a stable order when everything is enabled', () => {
    expect(toolsFor(ALL_CAPS, 'cartesia_self').map((t) => t.name)).toEqual(VOICE_TOOL_NAMES)
    expect(toolsFor(ALL_CAPS, 'cartesia_self')).toEqual(toolsFor({ ...ALL_CAPS }, 'cartesia_self'))
  })
})

describe('toOpenAITools', () => {
  const tools = toOpenAITools(toolsFor(ALL_CAPS, 'cartesia_self'))

  it('produces flat strict function tools', () => {
    expect(tools).toHaveLength(VOICE_TOOL_NAMES.length)
    for (const tool of tools) {
      expect(tool.type).toBe('function')
      expect(tool.strict).toBe(true)
      expect(tool).not.toHaveProperty('function')
      const def = TOOL_DEFINITIONS[tool.name as VoiceToolName]
      expect(tool.description).toBe(def.description)
      const params = tool.parameters as { type: string; properties: Record<string, unknown>; required: string[]; additionalProperties: boolean }
      expect(params.type).toBe('object')
      expect(params.additionalProperties).toBe(false)
      expect([...params.required].sort()).toEqual(Object.keys(params.properties).sort())
      expect(params.properties).toEqual(def.parameters.properties)
    }
  })

  it('returns copies, so callers cannot corrupt the shared definitions', () => {
    const params = tools.find((t) => t.name === 'take_message')!.parameters as { required: string[]; properties: Record<string, { enum?: string[] }> }
    params.required.pop()
    params.properties.urgency.enum!.push('whenever')
    expect(TOOL_DEFINITIONS.take_message.parameters.required).toContain('urgency')
    expect(TOOL_DEFINITIONS.take_message.parameters.properties.urgency.enum).toEqual(['normal', 'urgent'])
  })
})

describe('toCartesiaClientTool', () => {
  it.each(VOICE_TOOL_NAMES)('converts %s into a valid client tool', (name) => {
    const def = TOOL_DEFINITIONS[name]
    const tool = toCartesiaClientTool(def)
    expect(tool.type).toBe('client')
    expect(tool.name).toBe(`${CARTESIA_TOOL_PREFIX}${name}`)
    expect(tool.name).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/)
    expect(tool.description).toBe(def.description)
    expect(tool.pre_tool_speech).toBe(def.pre_tool_speech ? 'force' : 'auto')
    expect(tool.execution_mode).toBe('immediate')
    expect(tool.expects_response).toBe(true)
    expect(tool.response_timeout_secs).toBe(15)
    expect(tool.parameters.type).toBe('object')
    expect(JSON.stringify(tool)).not.toContain('"null"')
    expect(tool.parameters).not.toHaveProperty('additionalProperties')

    const properties = tool.parameters.properties ?? {}
    expect(Object.keys(properties).sort()).toEqual(Object.keys(def.parameters.properties).sort())
    for (const [key, param] of Object.entries(properties)) {
      expect(['string', 'integer', 'number', 'boolean']).toContain(param.type)
      if (param.enum) expect(param.type).toBe('string')
      expect(param.description).toBe(def.parameters.properties[key].description)
    }
    const nonNullable = Object.entries(def.parameters.properties)
      .filter(([, prop]) => !Array.isArray(prop.type))
      .map(([key]) => key)
    expect(tool.parameters.required).toEqual(nonNullable)
  })

  it('keeps enums and drops nullable fields from required', () => {
    const tool = toCartesiaClientTool(TOOL_DEFINITIONS.take_message)
    expect(tool.parameters.required).toEqual(['message', 'urgency'])
    expect(tool.parameters.properties?.urgency).toMatchObject({ type: 'string', enum: ['normal', 'urgent'] })
    expect(tool.parameters.properties?.callback_number.type).toBe('string')
  })
})

describe('fromCartesiaToolName', () => {
  it('maps prefixed names back and rejects everything else', () => {
    for (const name of VOICE_TOOL_NAMES) expect(fromCartesiaToolName(toCartesiaClientTool(TOOL_DEFINITIONS[name]).name)).toBe(name)
    expect(fromCartesiaToolName('end_call')).toBeNull()
    expect(fromCartesiaToolName('ntv_unknown')).toBeNull()
    expect(fromCartesiaToolName('ntv_constructor')).toBeNull()
    expect(fromCartesiaToolName('')).toBeNull()
  })
})
