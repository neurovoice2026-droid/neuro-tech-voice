import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { agents as elAgents, phoneNumbers as elPhone, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

// Diagnostic + repair endpoint for phone routing. Open in the browser while
// logged in: it reports the DB + ElevenLabs state and tries to (re)link each
// number to the agent, surfacing the real ElevenLabs error if any.
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!org) return NextResponse.json({ error: 'No organization' }, { status: 404 })

  const { data: agent } = await supabase
    .from('agents')
    .select('id, name, elevenlabs_agent_id, voice_id, voice_name, is_active, system_prompt, first_message, language')
    .eq('org_id', org.id)
    .limit(1)
    .maybeSingle()

  const { data: numbers } = await supabase
    .from('phone_numbers')
    .select('id, number, twilio_sid, elevenlabs_phone_number_id, agent_id, is_active')
    .eq('org_id', org.id)

  const report: Record<string, unknown> = {
    elevenlabs_configured: elConfigured(),
    twilio_env: {
      account_sid_set: !!process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'your-twilio-account-sid',
      auth_token_set: !!process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_AUTH_TOKEN !== 'your-twilio-auth-token',
    },
    agent: agent ?? null,
    db_numbers: numbers ?? [],
  }

  // What does ElevenLabs actually have?
  if (elConfigured()) {
    try {
      const list = await elPhone.list()
      report.elevenlabs_phone_numbers = list.phone_numbers?.map((p) => ({
        phone_number_id: p.phone_number_id,
        phone_number: p.phone_number,
        agent_id: p.agent_id ?? null,
      })) ?? []
    } catch (e) {
      report.elevenlabs_list_error = e instanceof Error ? e.message : String(e)
    }
  }

  const repair: unknown[] = []
  let elAgentId: string | null = (agent?.elevenlabs_agent_id as string) ?? null

  // ── Step 1: create the ElevenLabs agent if it's missing ──────────────────
  if (elConfigured() && agent && !elAgentId) {
    const base = {
      agent: {
        prompt: { prompt: agent.system_prompt ?? `You are a helpful assistant.` },
        first_message: agent.first_message ?? 'Hello! How can I help you today?',
        language: agent.language ?? 'en',
      },
    }
    try {
      const created = await elAgents.create({
        name: agent.name,
        conversation_config: {
          ...base,
          ...(agent.voice_id ? { tts: { voice_id: agent.voice_id as string } } : {}),
        },
      })
      elAgentId = created.agent_id ?? null
      repair.push({ step: 'create_agent', ok: true, with_voice: !!agent.voice_id })
    } catch (e1) {
      // The voice is the usual culprit — retry with the default voice.
      try {
        const created = await elAgents.create({ name: agent.name, conversation_config: base })
        elAgentId = created.agent_id ?? null
        repair.push({ step: 'create_agent', ok: true, with_voice: false, voice_error: e1 instanceof Error ? e1.message : String(e1) })
      } catch (e2) {
        repair.push({ step: 'create_agent', ok: false, error: e2 instanceof Error ? e2.message : String(e2) })
      }
    }
    if (elAgentId) {
      await supabase.from('agents').update({ elevenlabs_agent_id: elAgentId, is_active: true }).eq('id', agent.id)
    }
  }

  // ── Step 2: link/import each number to the agent ─────────────────────────
  if (elConfigured() && agent && elAgentId) {
    const known = new Set(
      ((report.elevenlabs_phone_numbers as { phone_number_id: string }[] | undefined) ?? []).map((p) => p.phone_number_id)
    )
    for (const n of numbers ?? []) {
      try {
        // Assign if the number is present in this ElevenLabs account.
        if (n.elevenlabs_phone_number_id && known.has(n.elevenlabs_phone_number_id as string)) {
          await elPhone.update(n.elevenlabs_phone_number_id as string, { agent_id: elAgentId })
          await supabase.from('phone_numbers').update({ agent_id: agent.id }).eq('id', n.id)
          repair.push({ number: n.number, action: 'assigned_agent', ok: true })
        } else if (n.twilio_sid && !String(n.twilio_sid).startsWith('mock')) {
          // Not in this account (or import was stale) → (re)import fresh.
          const imported = await elPhone.create({
            phone_number: n.number as string,
            label: `${org.id}-${n.number}`,
            agent_id: elAgentId,
            provider_config: {
              twilio: {
                account_sid: process.env.TWILIO_ACCOUNT_SID!,
                auth_token: process.env.TWILIO_AUTH_TOKEN!,
                phone_number_sid: n.twilio_sid as string,
              },
            },
          })
          await supabase
            .from('phone_numbers')
            .update({ elevenlabs_phone_number_id: imported.phone_number_id, agent_id: agent.id })
            .eq('id', n.id)
          repair.push({ number: n.number, action: 'reimported_and_assigned', ok: true, phone_number_id: imported.phone_number_id })
        } else {
          repair.push({ number: n.number, action: 'skipped', ok: false, reason: 'mock/no twilio_sid' })
        }
      } catch (e) {
        repair.push({ number: n.number, action: 'error', ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }
  } else if (!elAgentId) {
    report.repair_note = 'Could not create/find an ElevenLabs agent — see repair_results for the error.'
  }

  report.repair_results = repair
  return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
}
