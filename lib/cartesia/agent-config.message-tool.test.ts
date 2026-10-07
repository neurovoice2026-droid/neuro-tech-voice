import { describe, expect, it } from 'vitest'
import { buildCartesiaAgentConfig, messageToolDefinition } from './agent-config'
import { makeAgentSpec } from '@/tests/helpers/agent-spec'

const SECRET = 'tool-secret-0123456789abcdef0123456789'

describe('Cartesia take_message tool (slice B2 parity)', () => {
  const tool = messageToolDefinition('https://app.example/api/telephony/tools/cartesia-message', SECRET)

  it('posts to our URL with the bearer secret only in authentication', () => {
    const schema = tool.api_schema as Record<string, unknown>
    expect(tool).toMatchObject({ type: 'webhook', name: 'take_message', execution_mode: 'immediate', pre_tool_speech: 'force' })
    expect(schema).toMatchObject({ url: 'https://app.example/api/telephony/tools/cartesia-message', method: 'POST' })
    expect(schema.authentication).toEqual({ mode: 'bearer', token: { type: 'secret', secret_value: SECRET } })
    expect(JSON.stringify(tool).split(SECRET).length - 1).toBe(1)
  })

  it('the call is identified by system variables; the model provides only the message', () => {
    const body = (tool.api_schema as { request_body_schema: { properties: Record<string, Record<string, unknown>>; required: string[] } }).request_body_schema
    expect(body.properties.called_number).toEqual({ type: 'string', dynamic_variable: 'system__called_number' })
    expect(body.properties.caller_number).toEqual({ type: 'string', dynamic_variable: 'system__caller_id' })
    for (const p of ['caller_name', 'callback_number', 'reason', 'urgency']) expect(body.properties[p].description).toEqual(expect.any(String))
    expect(body.properties.urgency.enum).toEqual(['normal', 'urgent'])
    expect(body.required).toEqual(['reason', 'urgency'])
    expect(Object.keys(body.properties)).not.toContain('org_id')
  })

  it('is attached next to the context tool when present', () => {
    const spec = makeAgentSpec()
    expect(buildCartesiaAgentConfig(spec, 'voice', { contextToolId: 'ctx', messageToolId: 'msg' }).tools).toEqual([{ id: 'ctx' }, { id: 'msg' }])
    expect(buildCartesiaAgentConfig(spec, 'voice', { contextToolId: null, messageToolId: 'msg' }).tools).toEqual([{ id: 'msg' }])
    expect(buildCartesiaAgentConfig(spec, 'voice', { contextToolId: 'ctx' }).tools).toEqual([{ id: 'ctx' }])
  })
})
