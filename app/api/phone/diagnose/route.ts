import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { phoneNumbers as elPhone, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

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
    .select('id, name, elevenlabs_agent_id, voice_id, voice_name, is_active')
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

  // Try to (re)link each number and capture the real error.
  const repair: unknown[] = []
  if (elConfigured() && agent?.elevenlabs_agent_id) {
    for (const n of numbers ?? []) {
      try {
        if (n.elevenlabs_phone_number_id) {
          await elPhone.update(n.elevenlabs_phone_number_id as string, { agent_id: agent.elevenlabs_agent_id as string })
          await supabase.from('phone_numbers').update({ agent_id: agent.id }).eq('id', n.id)
          repair.push({ number: n.number, action: 'assigned_agent', ok: true })
        } else if (n.twilio_sid && !String(n.twilio_sid).startsWith('mock')) {
          const imported = await elPhone.create({
            phone_number: n.number as string,
            label: `${org.id}-${n.number}`,
            agent_id: agent.elevenlabs_agent_id as string,
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
          repair.push({ number: n.number, action: 'imported_and_assigned', ok: true, phone_number_id: imported.phone_number_id })
        } else {
          repair.push({ number: n.number, action: 'skipped', ok: false, reason: 'no twilio_sid (mock number)' })
        }
      } catch (e) {
        repair.push({ number: n.number, action: 'error', ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }
  } else {
    report.repair_skipped = !agent?.elevenlabs_agent_id ? 'agent has no elevenlabs_agent_id' : 'elevenlabs not configured'
  }
  report.repair_results = repair

  return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
}
