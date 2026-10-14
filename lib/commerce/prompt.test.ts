import { describe, expect, it } from 'vitest'
import { DEFAULT_SCRIPTS, SAMPLE_SCRIPT_VALUES, buildCommerceAgentPrompt, renderScript, unknownScriptVariables } from './prompt'
import { readCommerceProfile } from './profile'

describe('commerce prompt', () => {
  it('builds a Romanian baseline that discloses the AI, covers every call reason and the opt-out tool', () => {
    const { system_prompt, first_message } = buildCommerceAgentPrompt({ storeName: 'Magazinul Exemplu', language: 'ro', tone: 'friendly', transferNumber: null, returnPolicyUrl: null, agentName: 'Maria' })
    for (const needle of ['asistent AI', 'cod_confirmation', 'abandoned_cart', 'order_follow_up', 'inbound', 'mark_do_not_call', 'record_cod_confirmation', 'record_callback_request', 'get_order_status', 'Nu inventezi']) {
      expect(system_prompt).toContain(needle)
    }
    expect(system_prompt).not.toMatch(/\{\{(ntv_|secret__|system__)/)
    expect(first_message).toMatch(/asistentul AI al magazinului Magazinul Exemplu/)
    // The stored first message opens inbound calls: it must not tell the caller "I am calling you about your order".
    expect(first_message).not.toMatch(/vă sun|aveți un minut/i)
    expect(first_message).toContain('Cu ce vă pot ajuta')
    expect(system_prompt).toContain('Nu poți transfera')
    const withTransfer = buildCommerceAgentPrompt({ storeName: 'X', language: 'ro', tone: 'formal', transferNumber: '+40712345678', returnPolicyUrl: 'https://x.ro/retur', agentName: 'Ana' })
    expect(withTransfer.first_message).not.toMatch(/vă sun|aveți un minut/i)
    expect(withTransfer.system_prompt).toContain('Transfer:')
    expect(withTransfer.system_prompt).toContain('https://x.ro/retur')
    expect(withTransfer.system_prompt).not.toContain('+40712345678')
  })

  it('only allows the typed variables and renders them server-side', () => {
    for (const t of Object.values(DEFAULT_SCRIPTS)) expect(unknownScriptVariables(t)).toEqual([])
    expect(unknownScriptVariables('Hi {{customer_name}} {{ntv_call_id}} {{ secret__x }}')).toEqual(['ntv_call_id', 'secret__x'])
    const text = renderScript(DEFAULT_SCRIPTS.cod_confirmation, SAMPLE_SCRIPT_VALUES)
    expect(text).toContain('comanda 10432')
    expect(text).toContain('189,90 lei')
    expect(text).not.toContain('{{')
    expect(renderScript('a {{unknown}} b', {})).toBe('a  b')
  })

  it('reads a stored profile leniently', () => {
    expect(readCommerceProfile(null).country).toBe('RO')
    const p = readCommerceProfile({ display_name: 'Shop', country: 'ro', currency: 'eur', transfer_number: 'bad', tone: 'formal' })
    expect(p).toMatchObject({ display_name: 'Shop', country: 'RO', currency: 'EUR', transfer_number: null, tone: 'formal' })
  })
})
