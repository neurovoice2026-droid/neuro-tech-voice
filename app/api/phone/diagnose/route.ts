import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { phoneNumbers as elPhone, isConfigured as elConfigured } from '@/lib/elevenlabs/client'
import { createAgentWithFallback } from '@/lib/elevenlabs/create-agent'
import { getTwilioClient } from '@/lib/twilio/client'
import { ensureTwilioVoiceWebhook } from '@/lib/phone/webhook'

// Diagnostic + repair endpoint for phone routing. Open in the browser while
// logged in: it reports the DB + ElevenLabs state and tries to (re)link each
// number to the agent, surfacing the real ElevenLabs error if any.
export async function GET(request: Request) {
  const supabase = await createClient()

  // ?reconnect=1 → delete + re-import numbers so ElevenLabs reconfigures the
  // Twilio voice webhook (fixes numbers imported before an agent existed).
  const reconnect = new URL(request.url).searchParams.get('reconnect') === '1'

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
      report.elevenlabs_phone_numbers = list.map((p) => ({
        phone_number_id: p.phone_number_id,
        phone_number: p.phone_number,
        agent_id: p.agent_id ?? null,
      }))
    } catch (e) {
      report.elevenlabs_list_error = e instanceof Error ? e.message : String(e)
    }
  }

  const repair: unknown[] = []
  let elAgentId: string | null = (agent?.elevenlabs_agent_id as string) ?? null

  // ── Step 1: create the ElevenLabs agent if it's missing ──────────────────
  if (elConfigured() && agent && !elAgentId) {
    const result = await createAgentWithFallback({
      name: agent.name,
      system_prompt: agent.system_prompt,
      first_message: agent.first_message,
      language: agent.language,
      voice_id: agent.voice_id,
    })
    elAgentId = result.agent_id
    repair.push({ step: 'create_agent', ok: !!elAgentId, voice_error: result.voiceError, error: result.error })
    if (elAgentId) {
      await supabase.from('agents').update({ elevenlabs_agent_id: elAgentId, is_active: true }).eq('id', agent.id)
    }
  }

  // ── Step 2: link each number to the agent ────────────────────────────────
  if (elConfigured() && agent && elAgentId) {
    for (const n of numbers ?? []) {
      // Force reconnect: drop the existing EL number so it can be re-imported
      // fresh (which makes ElevenLabs reconfigure the Twilio voice webhook).
      if (reconnect && n.elevenlabs_phone_number_id) {
        try {
          await elPhone.delete(n.elevenlabs_phone_number_id as string)
          repair.push({ number: n.number, action: 'deleted_for_reconnect', ok: true })
        } catch (e) {
          repair.push({ number: n.number, action: 'delete_failed', ok: false, error: e instanceof Error ? e.message : String(e) })
        }
        await supabase.from('phone_numbers').update({ elevenlabs_phone_number_id: null }).eq('id', n.id)
        n.elevenlabs_phone_number_id = null
      }

      // 1) The number already has an ElevenLabs id → just assign the agent.
      if (n.elevenlabs_phone_number_id) {
        try {
          await elPhone.update(n.elevenlabs_phone_number_id as string, { agent_id: elAgentId })
          await supabase.from('phone_numbers').update({ agent_id: agent.id }).eq('id', n.id)
          repair.push({ number: n.number, action: 'assigned_agent', ok: true })
          continue
        } catch (e) {
          repair.push({ number: n.number, action: 'assign_failed', ok: false, error: e instanceof Error ? e.message : String(e) })
          // fall through to import attempt only if it's a "not found"
        }
      }
      // 2) No id (or stale) → import from Twilio.
      if (n.twilio_sid && !String(n.twilio_sid).startsWith('mock')) {
        try {
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
          repair.push({ number: n.number, action: 'imported_and_assigned', ok: true, phone_number_id: imported.phone_number_id })
        } catch (e) {
          repair.push({ number: n.number, action: 'import_error', ok: false, error: e instanceof Error ? e.message : String(e) })
        }
      }
    }
  } else if (!elAgentId) {
    report.repair_note = 'Could not create/find an ElevenLabs agent — see repair_results for the error.'
  }

  report.repair_results = repair

  // ── Step 2b: point the Twilio number's voice webhook at ElevenLabs so
  // inbound calls actually route to the assigned agent. This is what the
  // native integration is supposed to do automatically on import, but doesn't
  // reliably. Runs every time now (not just ?reconnect=1) since it's cheap
  // and idempotent - purchase/link already do this for new numbers, this is
  // what fixes numbers that were imported before that existed.
  if ((report.twilio_env as { account_sid_set: boolean }).account_sid_set) {
    const webhookResults: unknown[] = []
    for (const n of numbers ?? []) {
      if (!n.twilio_sid || String(n.twilio_sid).startsWith('mock')) continue
      try {
        await ensureTwilioVoiceWebhook(n.twilio_sid as string)
        webhookResults.push({ number: n.number, ok: true })
      } catch (e) {
        webhookResults.push({ number: n.number, ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }
    report.twilio_webhook_set = webhookResults
  }

  // ── Step 3: inspect the Twilio number's actual voice routing ─────────────
  // If voiceUrl is empty, Twilio has no instructions for inbound calls, so the
  // call just fails silently even though ElevenLabs has the agent assigned.
  const twSidSet = (report.twilio_env as { account_sid_set: boolean }).account_sid_set
  if (twSidSet) {
    const twInfo: unknown[] = []
    for (const n of numbers ?? []) {
      if (!n.twilio_sid || String(n.twilio_sid).startsWith('mock')) continue
      try {
        const tw = await getTwilioClient().incomingPhoneNumbers(n.twilio_sid as string).fetch()
        twInfo.push({
          number: n.number,
          status: tw.status,
          voiceUrl: tw.voiceUrl || null,
          voiceMethod: tw.voiceMethod || null,
          voiceApplicationSid: tw.voiceApplicationSid || null,
          voiceReceiveMode: (tw as unknown as { voiceReceiveMode?: string }).voiceReceiveMode ?? null,
          capabilities: tw.capabilities,
          trunkSid: (tw as unknown as { trunkSid?: string }).trunkSid ?? null,
        })
      } catch (e) {
        twInfo.push({ number: n.number, error: e instanceof Error ? e.message : String(e) })
      }
    }
    report.twilio_numbers = twInfo
  }

  return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
}
